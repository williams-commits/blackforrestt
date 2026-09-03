# CRM Module — Architecture & Phase 1 Design

Status: **design review draft** — no implementation yet.

A standalone CRM platform for sales/relationship management, hosted on its own
subdomain, isolated from the Black Forest trading platform. Salesforce is the
architectural and UX reference, not a template — terminology, interface, and
product identity are original.

**Call-center scope has been removed** from this design. No telephony, call
queues, agent workspace, call records, or dispositions. The CRM is a
sales/relationship-management system: leads, contacts, accounts, customers,
opportunities, activities, campaigns, imports, reporting.

---

## 1. Product scope

### In scope

- Lead, contact, account/company, and customer management
- Lead lifecycle with configurable statuses and conversion workflow
- Opportunities with configurable multi-pipeline support (list + kanban)
- Unified activity timeline: tasks, notes, appointments, system events
- Assignment of records to users and teams
- Campaigns with membership tracking
- Tags, custom fields, saved list views
- CSV import wizard with validation, duplicate detection, and error reporting;
  Google Sheets import behind a source-provider abstraction
- Global search, list views with filtering/sorting/bulk actions
- Role-based dashboards and flexible reporting with export
- Own RBAC, teams, data-visibility scopes, audit log, notifications, files
- Duplicate prevention and data normalization as first-class features

### Out of scope (removed)

- Call-center operations (queues, agent states, dispositions, telephony of any
  kind). Calls are not logged as activities. If a call-center is added later,
  it should be a separate module writing `ActivityEvent` rows, not a retrofit.

### Relationship to the trading platform

The CRM **never writes to the trading platform database**. The only bridge:

- Customer records can be linked to a registered platform user
  (`platformUserId`) after email/phone matching is confirmed by an operator.
- A later phase adds a small read-only internal API on the platform
  (service-token authenticated) so the CRM can render a client-360 panel
  (KYC status, balance, recent payments) for linked customers.

---

## 2. Architecture

| Concern | Decision |
| --- | --- |
| Module | Self-contained Next.js 15 app in `crm/` — own package.json, tsconfig, Prisma schema, Dockerfile. No npm workspaces; zero changes to the platform root. |
| Stack | Next.js 15 App Router, React 19, TypeScript, Tailwind 4, TanStack Query + Zustand, Zod, Prisma, PostgreSQL 17, Redis. Same stack as the platform — one mental model. |
| Database | Second database on the existing `postgres:17` container (e.g. `blckforest_crm`). Own schema + migration history. |
| Auth | Own Auth.js v5 instance, own staff user table, cookies scoped to the CRM subdomain, separate `AUTH_SECRET`, `AUTH_URL=https://crm.<domain>`. |
| Authorization | Centralized server-side permission module (mirrors platform `src/server/admin.ts` + `adminPolicy.ts`). Route handlers call `requirePermission(...)`; row visibility is applied by a scope resolver in the query layer. Never enforced in UI. |
| Hosting | New `crm` compose service on the `backend` network; Caddy site block `crm.<domain> → reverse_proxy crm:3000` rendered via `deploy/render-caddy.sh` + `CRM_DOMAIN` env; TLS automatic. Local dev on port 3100. |
| Files | MinIO (already in the stack) via S3 presigned uploads; storage access behind an object-storage interface. |
| Background jobs | DB-backed job rows (`ImportJob`, report runs) processed by a worker process in the CRM container. Imports never block an HTTP request. Redis-based queues only if/when DB polling becomes a bottleneck. |
| Observability | Structured JSON logging (requests, authz failures, job lifecycle), `/api/health`, error tracking hook point. |

## 3. Domain model

Conventions: every table has `id` (cuid), `createdAt`, `updatedAt` unless noted.
Soft delete (`deletedAt`) on the four core objects (Lead, Contact, Account,
Customer); other tables hard-delete. All money amounts stored as integer minor
units plus currency code.

### 3.1 Identity & structure

- **User** — staff only (email, passwordHash, name, status, lastLoginAt).
  Distinct population from trading-platform clients.
- **Role** (configurable) + **RolePermission** — seeded with the six built-in
  roles below; permissions are code-level constants referenced by name.
- **Team** — name, leaderId, parentTeamId (hierarchy for manager scope);
  **TeamMembership** (userId, teamId).
- **AuditLog** — append-only: actorId, action, objectType, objectId, before
  JSONB, after JSONB, ip. Mirrors the platform `AuditEvent` pattern. No update
  or delete paths exist in code.

### 3.2 Core records

- **Lead** — firstName, lastName, company, email, phone, secondaryPhone,
  country, region, source, campaignId, statusId → **LeadStatus** (configurable
  table: name, order, category ∈ open/converted/lost/invalid), score, priority,
  assignedUserId, assignedTeamId, lastContactAt, nextFollowUpAt, externalId
  (unique), customFields JSONB. Conversion outputs: convertedContactId,
  convertedCustomerId, convertedOpportunityId, convertedAt.
- **Account** (company) — name, industry, size, revenue, website, address
  fields, ownerUserId, teamId, customFields JSONB.
- **Contact** — a person; accountId (nullable), ownerUserId, leadSource,
  campaignId, statusId, email/phone, customFields JSONB.
- **Customer** — a contact elevated to active-client status; 1:1 optional link
  to Contact, plus `platformUserId` (nullable) for the platform bridge.
- **Opportunity** — name, accountId, contactId, ownerUserId, pipelineId,
  stageId → **PipelineStage**, value, currency, probability, expectedCloseDate,
  source, status ∈ open/won/lost, customFields JSONB.
- **Pipeline** (configurable, multiple) + **PipelineStage** (name, order,
  probability, type ∈ open/won/lost). Stages are rows, never enums.
- **Campaign** — name, description, source, status, start/end dates,
  ownerUserId; **CampaignMember** — subjectType/subjectId, status,
  respondedAt.
- **Tag** (unique name, color) + **TagLink** (subjectType/subjectId, tagId).

### 3.3 Activities & timeline

- **Task** — title, description, ownerUserId, dueAt, priority, status ∈
  Open/InProgress/Completed/Cancelled, subjectType/subjectId.
- **Note** — body, authorUserId, subjectType/subjectId.
- **Appointment** — title, startAt, endAt, locationOrLink, status,
  ownerUserId, subjectType/subjectId.
- **ActivityEvent** — append-only denormalized timeline row written by the
  service layer on every meaningful mutation and record creation: subjectType,
  subjectId, kind (created/assigned/status_changed/note_added/task_completed/
  imported/…), actorUserId, payload JSONB. Record pages render the timeline
  from this table; typed tables remain the source of truth for filtering.
  This mirrors the platform's audit philosophy and keeps the timeline query
  O(index) instead of a multi-table union.

Polymorphic references (`subjectType`/`subjectId`) are constrained in the
service layer (whitelist of object types) and indexed as
`(subjectType, subjectId, createdAt)`.

### 3.4 Configuration (DB, never hard-coded)

LeadStatus, Pipeline/PipelineStage, Tag, **CustomFieldDef** (objectType, key,
label, fieldType ∈ text/number/currency/boolean/date/datetime/select/
multiselect/phone/email/url, options JSONB, required, order), **SavedView**
(user, objectType, name, filters/sort/columns JSONB, shared).

**Custom-field storage strategy:** values live in the subject's `customFields`
JSONB column, validated against `CustomFieldDef` at write time. Tradeoff vs.
EAV: simpler queries and fewer joins; ad-hoc filtering uses JSONB operators
with expression indexes added on demand. Accepted tradeoff, documented here.

### 3.5 Import system

- **ImportJob** — source ∈ csv/sheets, objectType, status ∈ draft/mapping/
  validating/running/completed/failed/cancelled, strategy ∈
  create/update/upsert, mapping JSONB, matchRules JSONB (email/phone/
  externalId), counts (created/updated/skipped/duplicates/errors), fileKey,
  startedAt/finishedAt, progress.
- **ImportError** — jobId, rowNumber, raw data JSONB, message. Downloadable as
  CSV; no imported row is ever silently discarded.
- **ImportMapping** — saved reusable column mappings per source/objectType.
- Google Sheets access is isolated behind an `ImportSourceProvider` interface;
  the CSV adapter ships first, the Sheets adapter (OAuth/service account)
  plugs in without touching import logic.

### 3.6 Platform, misc

- **Notification** — recipientUserId, type (assigned/new_task/overdue_task/
  import_done/import_failed/system), payload JSONB, readAt; channel fan-out
  designed so email/SMS/push adapters can be added (in-app + email first;
  email reuses platform-grade delivery patterns).
- **File/Attachment** — filename, mimeType, size, storageKey, uploaderUserId,
  subjectType/subjectId.
- **MergeRecord** — primaryId, mergedId, snapshot JSONB (lead/contact merge
  tooling).

### 3.7 Key indexes

leads(email), leads(phone), leads(statusId), leads(assignedUserId),
leads(createdAt), leads(updatedAt), leads(externalId unique);
contacts(email); accounts(name); opportunities(pipelineId, stageId,
ownerUserId, status); tasks(ownerUserId, dueAt, status);
activityEvent(subjectType, subjectId, createdAt); auditLog(actorUserId,
createdAt); trigram (pg_trgm) indexes on name/email/phone columns for search.

### 3.8 Data normalization (all write paths, not just imports)

Emails lowercased/trimmed; phones normalized to E.164; names trimmed; countries
stored as ISO codes. Duplicate matching keys: normalized email, normalized
phone, externalId. Interactive create/edit and lead conversion run the same
duplicate check as imports — near-matches are surfaced for confirmation, never
silently created.

---

## 4. RBAC

Built-in roles (superset ordering): **Super Admin ⊇ Admin ⊇ Manager ⊇
Team Lead ⊇ Rep ⊇ Viewer**. "Agent" terminology is dropped with the call
center; front-line sales users are **Reps**.

Permission constants (enforced server-side; groups shown):

- Core objects (leads, contacts, accounts, customers, opportunities, tasks,
  campaigns, notes/appointments): `*_READ`, `*_CREATE`, `*_EDIT`, `*_DELETE`,
  `*_EXPORT`, plus `LEADS_IMPORT`, `LEADS_ASSIGN`
- Files: `FILES_READ`, `FILES_UPLOAD`, `FILES_DELETE`
- Admin: `USERS_MANAGE`, `TEAMS_MANAGE`, `SETTINGS_MANAGE` (statuses,
  pipelines, custom fields, tags), `IMPORTS_MANAGE`, `AUDIT_VIEW`,
  `REPORTS_VIEW`, `DASHBOARDS_VIEW`
- Super Admin only: `ROLES_MANAGE`

| Permission | Viewer | Rep | Team Lead | Manager | Admin | Super Admin |
| --- | --- | --- | --- | --- | --- | --- |
| READ (core) | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ |
| CREATE / EDIT (core) | — | ✔ | ✔ | ✔ | ✔ | ✔ |
| DELETE (core) | — | — | ✔ | ✔ | ✔ | ✔ |
| ASSIGN | — | — | ✔ | ✔ | ✔ | ✔ |
| EXPORT | — | own rows | ✔ | ✔ | ✔ | ✔ |
| IMPORT | — | — | — | ✔ | ✔ | ✔ |
| REPORTS / DASHBOARDS | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ |
| USERS / TEAMS manage | — | — | — | — | ✔ | ✔ |
| SETTINGS manage | — | — | — | — | ✔ | ✔ |
| ROLES manage | — | — | — | — | — | ✔ |
| AUDIT view | — | — | — | — | ✔ | ✔ |

**Data-visibility scopes** (row-level, applied centrally in the query layer by
combining the actor's role scope with record ownership): `OWN` (Rep) → `TEAM`
(Team Lead) → `HIERARCHY` (Manager: team subtree) → `ORG` (Admin+). Exports
respect the same scope — a user can never export rows they cannot read.

## 5. API design

Conventions: `/api/v1/*`, zod-validated inputs, uniform envelope
(`data` + `meta{page,pageSize,total}`), error envelope
(`error{code,message,fieldErrors?}`), server-side filtering/sorting/pagination
on every list endpoint, permission + scope check in every handler.

| Group | Routes |
| --- | --- |
| Auth | `/api/auth/*` (Auth.js) |
| Org | `/api/users`, `/api/teams`, `/api/roles` |
| Leads | `/api/leads`, `/api/leads/[id]`, `/api/leads/[id]/convert`, `/api/leads/bulk` (assign/status/tag/delete), `/api/leads/duplicates` |
| Contacts / Accounts / Customers | CRUD + bulk, same shape as leads |
| Opportunities | CRUD, `/api/opportunities/[id]/stage`, board endpoint for kanban |
| Pipelines | `/api/pipelines`, `/api/pipelines/[id]/stages`, `/api/lead-statuses` |
| Activities | `/api/tasks`, `/api/notes`, `/api/appointments`, `/api/timeline?subjectType&subjectId` |
| Campaigns | `/api/campaigns`, `/api/campaigns/[id]/members` |
| Config | `/api/tags`, `/api/custom-fields`, `/api/views` (saved views) |
| Import | `/api/imports` (create), `/api/imports/preview`, `/api/imports/[id]` (status/progress), `/api/imports/[id]/errors.csv`, `/api/imports/mappings` |
| Insights | `/api/search?q=`, `/api/reports/run`, `/api/dashboards/me`, `/api/dashboards/overview` |
| Ops | `/api/notifications`, `/api/files` (presigned), `/api/audit`, `/api/settings`, `/api/health` |

## 6. UI / navigation

Desktop-first, information-dense but organized; split-view record workspace;
keyboard-friendly; responsive on mobile.

Navigation: **Home** (role dashboard) · **Leads** · **Contacts** ·
**Customers** · **Accounts** · **Opportunities** · **Tasks** · **Campaigns** ·
**Reports** · **Administration** (users, teams, roles, pipelines, statuses,
custom fields, tags, imports, settings, audit).

Record detail layout (consistent for every object): header (name, status,
owner, priority, primary actions) → overview (details, tags, custom fields) →
activity timeline → related records. Global quick actions: create lead /
contact / task / note, schedule follow-up, import.

i18n: English-first; strings centralized so next-intl can be adopted later if
the CRM needs to match the platform's languages.

## 7. Build phases (call-center scope removed)

1. **Foundation** — `crm/` scaffold, auth, roles/permissions/teams, audit,
   settings, health, hosting skeleton (compose + Caddy + DNS).
2. **Core records** — leads, contacts, accounts, customers; list views with
   filtering/sorting/pagination/bulk actions; record detail pages.
3. **Activities** — tasks, notes, appointments, ActivityEvent timeline,
   notifications.
4. **Conversion** — duplicate matching, merge tooling, lead conversion with
   history preservation.
5. **Opportunities** — configurable pipelines, list + kanban, stage flow.
6. **Import** — async CSV wizard (preview → map → validate → dedupe → run →
   error report); Sheets adapter; import admin screens.
7. **Config & campaigns** — tags, custom fields admin, campaign membership.
8. **Search & views** — global search (Postgres trigram behind a SearchService
   interface), saved views.
9. **Dashboards & reporting** — role dashboards; report builder (filters,
   grouping, aggregation, export) on reusable reporting infrastructure.
10. **Platform bridge** — customer↔platform-user linking + read-only internal
    client-360 API.
11. **Hardening & QA** — security review, rate limiting, load checks on large
    datasets, seed-data polish, production runbook.

MVP boundary: end of phase 5 (a team can manage leads through won/lost).
Phases 6–9 add operational depth; phase 10 connects it to the trading platform.

## 8. Testing

`node:test` integration suites against a real Postgres (compose), following
repo conventions. Minimum coverage: CRUD per object; the full RBAC × scope
matrix (unauthorized access must fail closed); duplicate detection; large
import (100k rows) without blocking; duplicate/concurrent imports; lead
conversion preserving history; timeline integrity; audit immutability;
export scope enforcement; critical UI flows via the platform's e2e pattern.

## 9. Seed data

Roles, teams (with hierarchy), users for each role, ~500 leads across
statuses/sources/campaigns, accounts + contacts, opportunities in every stage,
tasks due today/overdue, two campaigns — so dashboards and list views are
meaningful on first run.

## 10. Open decisions (non-blocking, defaults noted)

1. Subdomain: `crm.agilefgs.com`
2. Opportunity currency: single org currency initially, per-record currency
   field deferred (default: yes).
3. Reporting depth in phase 9: prebuilt report library first vs. user-buildable
   reports (default: prebuilt library + export first).
4. Sheets adapter timing: phase 6 alongside CSV, or right after (default:
   right after).
