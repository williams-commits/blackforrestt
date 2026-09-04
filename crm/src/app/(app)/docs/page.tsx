import Link from "next/link";
import { auth } from "@/auth";
import { prisma } from "@/server/db";
import { permissionsForRoleKey } from "@/server/permissions";

export const dynamic = "force-dynamic";

export const metadata = { title: "Documentation" };

/* ═══════════════════════════════════════════════════════════════════
   HELPERS
   ═══════════════════════════════════════════════════════════════════ */

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="card scroll-mt-20">
      <div className="card-header">
        <h2 className="card-title">{title}</h2>
      </div>
      <div className="card-body space-y-3" style={{ fontSize: "var(--text-md)", lineHeight: 1.6 }}>
        {children}
      </div>
    </section>
  );
}

function SubSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="mb-1.5 text-[15px] font-semibold" style={{ color: "var(--text-primary)" }}>{title}</h3>
      <div className="text-[14px]" style={{ color: "var(--text-secondary)" }}>{children}</div>
    </div>
  );
}

function PermTable({ permissions }: { permissions: string[] }) {
  const groups: Record<string, string[]> = {};
  for (const perm of permissions) {
    const prefix = perm.split("_")[0];
    if (!groups[prefix]) groups[prefix] = [];
    groups[prefix].push(perm);
  }
  return (
    <div className="flex flex-wrap gap-1.5">
      {permissions.map((perm) => (
        <span key={perm} className="badge badge-neutral" style={{ fontSize: "10px" }}>{perm}</span>
      ))}
    </div>
  );
}

function StepList({ steps }: { steps: string[] }) {
  return (
    <ol className="ml-4 list-decimal space-y-1 text-[14px]" style={{ color: "var(--text-secondary)" }}>
      {steps.map((step, i) => <li key={i}>{step}</li>)}
    </ol>
  );
}

function BulletList({ items }: { items: string[] }) {
  return (
    <ul className="ml-4 list-disc space-y-1 text-[14px]" style={{ color: "var(--text-secondary)" }}>
      {items.map((item, i) => <li key={i}>{item}</li>)}
    </ul>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   ROLE DATA
   ═══════════════════════════════════════════════════════════════════ */

const ROLE_DOCS = [
  {
    key: "REP",
    name: "Rep",
    scope: "Own records only",
    description: "Front-line sales representative. Works their own leads and opportunities from first contact to close.",
    canDo: [
      "Create, edit, and view their own leads, contacts, accounts, and customers",
      "Create and manage their own opportunities in any pipeline",
      "Create tasks, notes, and appointments on records they own",
      "Send emails from record pages (when SMTP is configured)",
      "View reports and dashboards (scoped to their own data)",
      "Export their own records to CSV",
      "Attach files to records they can see",
      "Import leads (requires LEADS_IMPORT permission)",
    ],
    cannotDo: [
      "See other reps' leads or opportunities",
      "Delete records (requires Team Lead or above)",
      "Assign records to other users",
      "Manage teams, roles, statuses, or system settings",
      "View the audit log",
    ],
    workflow: [
      "Navigate to Leads → use the \"My Leads\" view tab to see your assigned leads",
      "Click a lead to open the record page with the highlights panel",
      "Use the Activity Composer in the timeline sidebar to log notes, create tasks, or schedule appointments",
      "Change lead status inline by clicking the status badge in the list view",
      "When a lead is qualified, click \"Convert\" to create a contact, customer, and opportunity",
      "Track deals on the Opportunities board — drag cards between stages",
      "Use Tasks with the \"Today\" filter to manage your daily follow-ups",
    ],
    tips: [
      "Press `/` anywhere to jump to global search",
      "Press `Alt+N` then a letter to quickly create records (L=Lead, C=Contact, T=Task)",
      "Use the density toggle on list pages to see more rows at once",
      "Save your favorite filter combinations as Saved Views",
    ],
  },
  {
    key: "TEAM_LEAD",
    name: "Team Lead",
    scope: "Team records",
    description: "Leads a sales team. Sees and manages all records assigned to team members.",
    canDo: [
      "Everything a Rep can do, plus:",
      "View and edit all leads, contacts, accounts, and customers assigned to team members",
      "Delete records owned by team members",
      "Bulk assign leads to team members",
      "Merge duplicate leads",
      "Import leads and manage import jobs",
      "Add tags to records",
    ],
    cannotDo: [
      "See records outside their team (unless also assigned to them)",
      "Manage users, teams, or system settings",
      "View the audit log",
      "Create or modify pipelines",
    ],
    workflow: [
      "Use the \"All Leads\" view to see the entire team's pipeline",
      "Select multiple leads with checkboxes → use the bulk action bar to assign to team members",
      "When two reps create the same lead, select both → click \"Merge selected\" to combine them",
      "Monitor team follow-ups on the Tasks page with \"Everyone (in my scope)\" filter",
      "Run the \"Leads by assignee\" report to see team productivity",
    ],
    tips: [
      "Select exactly 2 leads to see the \"Merge selected\" option",
      "Use bulk tag to organize leads into campaigns or categories",
      "The \"Recently Added\" view shows what your team created today",
    ],
  },
  {
    key: "MANAGER",
    name: "Manager",
    scope: "Team hierarchy",
    description: "Manages multiple teams and the full sales hierarchy. Has import and organizational oversight.",
    canDo: [
      "Everything a Team Lead can do, plus:",
      "See records across all teams in their hierarchy",
      "Import data (leads, contacts, accounts, customers) via CSV and Google Sheets",
      "Manage import jobs and retry failed imports",
      "Create and manage campaigns",
      "Full pipeline management (create, edit, delete pipelines and stages)",
    ],
    cannotDo: [
      "Manage users or assign roles",
      "View the audit log",
      "Modify system settings",
    ],
    workflow: [
      "Run reports with full hierarchy scope to compare team performance",
      "Use the report builder to create custom reports grouped by any field",
      "Monitor pipeline health on the Opportunities board across all pipelines",
      "Set up campaigns to track lead attribution and conversion",
      "Import large datasets via the Import wizard (CSV or published Google Sheets)",
    ],
    tips: [
      "The report builder supports time-bucket grouping (by day, week, or month)",
      "Export any report to CSV for offline analysis",
      "Use the \"Pipeline by owner\" report to identify coaching opportunities",
    ],
  },
  {
    key: "ADMIN",
    name: "Admin",
    scope: "All records",
    description: "Full organizational access. Manages users, teams, roles, configuration, and the audit trail.",
    canDo: [
      "Everything a Manager can do, plus:",
      "View and manage ALL records in the organization",
      "Create, edit, suspend, and delete user accounts",
      "Create and manage teams (hierarchy, membership, leadership)",
      "View and modify role permission matrices",
      "Manage lead/contact/customer statuses",
      "Manage tags and custom fields",
      "Create and manage custom object types",
      "View the audit log",
      "Manage system settings and integrations",
    ],
    cannotDo: [
      "Modify Super Admin permissions (fixed for security)",
    ],
    workflow: [
      "Navigate to Administration → each section has its own page in the sidebar",
      "Users & Teams: create accounts, assign roles, manage team membership",
      "Roles & Permissions: toggle individual permissions per role via checkboxes",
      "Statuses: add, rename, reorder, or set defaults for lead/contact/customer statuses",
      "Custom Fields: define typed fields (text, number, select, etc.) on any object",
      "Audit Log: searchable, paginated record of all administrative and data changes",
      "Integrations: view platform bridge and email notification status",
    ],
    tips: [
      "Custom objects (Properties, Vendors, etc.) are created under Administration → Custom Objects",
      "Role changes take effect immediately — no restart needed",
      "The audit log records IP addresses, before/after values, and timestamps",
      "Deactivate pipelines instead of deleting when they have opportunities",
    ],
  },
  {
    key: "SUPER_ADMIN",
    name: "Super Admin",
    scope: "All records, full control",
    description: "Unrestricted access including role permission management. The last line of administrative authority.",
    canDo: [
      "Everything an Admin can do, plus:",
      "Modify role permission matrices (including Admin role permissions)",
      "Cannot be locked out — Super Admin permissions are fixed",
    ],
    cannotDo: [],
    workflow: [
      "Use Roles & Permissions to fine-tune what each role can do",
      "The Super Admin role itself cannot be modified — this prevents accidental lockout",
    ],
    tips: [
      "You cannot demote your own Super Admin account (safety guardrail)",
      "You cannot suspend your own account (safety guardrail)",
    ],
  },
  {
    key: "VIEWER",
    name: "Viewer",
    scope: "All records (read-only)",
    description: "Read-only access for observers, auditors, and stakeholders who need visibility without edit rights.",
    canDo: [
      "View all leads, contacts, accounts, customers, and opportunities",
      "View tasks, notes, and appointments on any record",
      "Run reports and view dashboards",
      "Use global search",
    ],
    cannotDo: [
      "Create, edit, or delete any record",
      "Create tasks, notes, or appointments",
      "Send emails",
      "Import or export data",
      "Attach files",
      "Access the Administration section",
    ],
    workflow: [
      "Use global search (`/` key) to find any record",
      "Browse records via sidebar navigation",
      "Run prebuilt or custom reports for analysis",
    ],
    tips: [
      "Viewers see everything but cannot change anything — ideal for compliance audits",
    ],
  },
];

/* ═══════════════════════════════════════════════════════════════════
   FEATURE DOCS
   ═══════════════════════════════════════════════════════════════════ */

const FEATURE_DOCS = [
  {
    id: "leads",
    title: "Leads",
    description: "Manage prospective customers from first contact through qualification and conversion.",
    topics: [
      { name: "Creating a lead", content: "Click \"New Lead\" on the Leads page or use `Alt+N` then `L`. Fill in name, email, phone, company, and source. If the email or phone matches an existing lead, you'll see a duplicate warning with links to review before creating." },
      { name: "Converting a lead", content: "Open a qualified lead → click \"Convert\" in the header. The system checks for duplicate contacts and customers. Choose to create new records or link existing ones. Open tasks and notes automatically move to the new contact. An optional opportunity is created in the default pipeline." },
      { name: "Changing status", content: "Click the status badge directly in the table (inline edit) or use the Edit form. Statuses are configurable by admins (Administration → Statuses)." },
      { name: "Merging duplicates", content: "Select exactly 2 leads in the list view → click \"Merge selected\" → choose which record survives. Timeline events are copied, notes and tasks re-pointed, and a snapshot is stored for recovery." },
      { name: "Bulk actions", content: "Select multiple rows with checkboxes → use the bulk action bar to assign, change status, add tags, create tasks, or delete." },
    ],
  },
  {
    id: "opportunities",
    title: "Opportunities & Pipelines",
    description: "Track deals through configurable sales pipelines with kanban and list views.",
    topics: [
      { name: "Pipeline board", content: "The board shows opportunities as cards grouped by pipeline stage. Drag cards between stages or use the dropdown on each card. Moving to a Won/Lost stage automatically sets the close date and probability." },
      { name: "Multiple pipelines", content: "Admins can create multiple pipelines (e.g., \"Standard Sales\" and \"Enterprise Deals\"). Switch between them using the pipeline selector. Each pipeline has its own configurable stages." },
      { name: "Creating opportunities", content: "Click \"New Opportunity\" or convert a lead with the \"Create opportunity\" option. Link to accounts and contacts for relationship tracking." },
      { name: "Aggregates", content: "The board header shows open count, total pipeline value, weighted value (value × probability), and win rate." },
    ],
  },
  {
    id: "activities",
    title: "Tasks, Notes & Appointments",
    description: "Track all interactions with records through a unified activity system.",
    topics: [
      { name: "Activity Composer", content: "Found on every record page in the timeline sidebar. Three compact actions: Note (quick text capture), Task (title + due date), Schedule (title + date/time). No page navigation needed." },
      { name: "Task filters", content: "The Tasks page supports filters for status, due date (Overdue, Today, Next 7 days), and ownership. Use \"My tasks\" vs \"Everyone\" to switch between personal and team views." },
      { name: "Timeline", content: "Every record shows a timeline of all activities with colored dots (green=task, blue=status change, amber=email, gray=system). Timestamps are relative (\"2h ago\", \"3d ago\")." },
      { name: "Overdue notifications", content: "Tasks past their due date automatically generate overdue notifications when you view the Notifications panel. Each task only notifies once (tracked by the overdueNotifiedAt field)." },
    ],
  },
  {
    id: "imports",
    title: "Importing Data",
    description: "Bulk-load leads, contacts, accounts, or customers from CSV files or Google Sheets.",
    topics: [
      { name: "CSV import", content: "Navigate to Import → select \"CSV file\" → upload → preview → map columns to CRM fields → validate (checks required fields, email/phone format, duplicates) → choose strategy (Create/Update/Upsert) → run. Progress shows in real-time." },
      { name: "Google Sheets import", content: "Publish your sheet to the web (File → Share → Publish to web → CSV), then paste the link. The system fetches and parses the sheet automatically." },
      { name: "Duplicate handling", content: "Configure matching rules (email, phone, external ID). With \"Create\" strategy, duplicates are skipped and reported. With \"Upsert\", duplicates update the existing record." },
      { name: "Error reports", content: "After import, download a CSV of all failed rows with the reason for each failure. Nothing is silently discarded." },
      { name: "Retry", content: "Any completed import can be retried — the original data is re-validated and re-run as a new job." },
    ],
  },
  {
    id: "search",
    title: "Search & Saved Views",
    description: "Fast global search across all CRM data with configurable list views.",
    topics: [
      { name: "Global search", content: "Press `/` anywhere to focus the search bar. Results are grouped by type (leads, contacts, accounts, customers, opportunities, tasks, notes). Press Enter for the full results page." },
      { name: "Saved views", content: "On any list page, configure filters and search → type a name → click \"Save view\". Saved views appear in the \"Saved Views\" dropdown and persist across sessions." },
      { name: "View tabs", content: "Preset tabs on every list page: \"All Records\", \"My Records\", \"Recently Added\", and \"Unassigned\" (leads only). Switch between them instantly." },
    ],
  },
  {
    id: "reports",
    title: "Reports & Dashboards",
    description: "Reusable reporting engine with prebuilt and custom reports.",
    topics: [
      { name: "Prebuilt reports", content: "10 ready-to-run reports: leads by source/assignee, lead funnel, new leads over time, conversions by campaign, pipeline by stage/owner, won over time, win rate by pipeline, task throughput." },
      { name: "Report builder", content: "Click \"Build a report\" to create custom reports. Choose object, date field, group-by field, and optional time bucket (day/week/month). Results respect your data scope." },
      { name: "Export", content: "Any report can be exported to CSV with one click. Exports respect permissions — you can only export data you can see." },
      { name: "Dashboard", content: "The Home page shows KPI cards (open leads, conversions, pipeline value, won this month, tasks, activity) and notification feed — all scope-aware." },
    ],
  },
  {
    id: "email",
    title: "Email",
    description: "Send emails directly from record pages and receive email notifications.",
    topics: [
      { name: "Sending from a record", content: "Open any lead, contact, or customer with an email address → click the \"Email\" button in the header. The modal pre-fills the recipient, lets you write a subject and body, and optionally creates a follow-up task." },
      { name: "Email notifications", content: "When SMTP is configured, you'll receive email notifications for: lead assignments, task assignments, overdue tasks, and import completion/failure." },
      { name: "Configuration", content: "Admins configure SMTP in the environment (SMTP_URL, SMTP_FROM). Status is visible under Administration → Integrations." },
    ],
  },
  {
    id: "admin",
    title: "Administration",
    description: "Complete system configuration and governance.",
    topics: [
      { name: "Users & Teams", content: "Create user accounts with role assignment and team membership. Create teams with hierarchy (parent/child). Assign team leaders. Suspend or activate accounts." },
      { name: "Roles & Permissions", content: "Visual permission matrix — toggle any permission for any role. Super Admin is fixed. Changes take effect immediately." },
      { name: "Statuses", content: "Add, rename, reorder, or delete lead/contact/customer statuses. Set defaults. Statuses with records cannot be deleted." },
      { name: "Custom Fields", content: "Define typed fields on any object: text, number, currency, boolean, date, datetime, select, multi-select, phone, email, URL. Values are validated on every write." },
      { name: "Custom Objects", content: "Create entirely new record types (Properties, Vendors, etc.) with their own field schemas. Records are JSONB documents validated against the definition." },
      { name: "Tags", content: "Global tag registry with colors. Tags can be attached to any record and used for bulk categorization." },
      { name: "Audit Log", content: "Searchable, append-only log of all administrative and data changes. Records actor, action, object, before/after values, timestamp, and IP address." },
    ],
  },
  {
    id: "platform-bridge",
    title: "Platform Bridge",
    description: "Read-only integration with the Black Forest trading platform.",
    topics: [
      { name: "Linking customers", content: "On a Customer record, click \"Look up platform user by email\" → confirm the match → click \"Link\". The system verifies the platform user exists via a live lookup." },
      { name: "Client 360 view", content: "Once linked, the Customer page shows a read-only panel with the platform user's account state, KYC status, wallet balances, and recent payment requests." },
      { name: "Unlinking", content: "Admins can unlink a customer from the platform at any time. The bridge is strictly read-only — the CRM can never write to the platform." },
    ],
  },
];

/* ═══════════════════════════════════════════════════════════════════
   TEAM DATA (fetched from DB)
   ═══════════════════════════════════════════════════════════════════ */

interface TeamDoc {
  id: string;
  name: string;
  leader: { name: string } | null;
  parent: { name: string } | null;
  members: Array<{ id: string; name: string; role: { name: string; key: string } }>;
}

async function getTeams(): Promise<TeamDoc[]> {
  const teams = await prisma.team.findMany({
    orderBy: { name: "asc" },
    include: {
      leader: { select: { name: true } },
      parent: { select: { name: true } },
      memberships: {
        include: {
          user: {
            select: {
              id: true,
              name: true,
              status: true,
              role: { select: { name: true, key: true } },
            },
          },
        },
      },
    },
  });
  return teams.map((team) => ({
    id: team.id,
    name: team.name,
    leader: team.leader,
    parent: team.parent,
    members: team.memberships
      .filter((m) => m.user.status === "ACTIVE")
      .map((m) => ({
        id: m.user.id,
        name: m.user.name,
        role: m.user.role,
      })),
  }));
}

/* ═══════════════════════════════════════════════════════════════════
   PAGE COMPONENT
   ═══════════════════════════════════════════════════════════════════ */

export default async function DocsPage() {
  const session = await auth();
  const currentUser = session?.user?.id
    ? await prisma.user.findUnique({
        where: { id: session.user.id },
        select: {
          name: true,
          email: true,
          role: {
            select: {
              key: true,
              name: true,
              scope: true,
              permissions: { select: { permission: true } },
            },
          },
          memberships: {
            include: {
              team: {
                select: { id: true, name: true },
              },
            },
          },
        },
      })
    : null;

  const teams = await getTeams();
  const userPermissions = currentUser?.role.permissions.map((p) => p.permission) ?? [];
  const userTeams = currentUser?.memberships.map((m) => m.team.name) ?? [];
  const currentRoleDoc = ROLE_DOCS.find((r) => r.key === currentUser?.role.key);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      {/* Breadcrumb */}
      <nav className="breadcrumb no-print" aria-label="Breadcrumb">
        <Link href="/">Home</Link><span className="breadcrumb-sep">/</span>
        <span className="breadcrumb-current">Documentation</span>
      </nav>

      {/* Page header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Documentation</h1>
          <p className="page-subtitle">
            User guides, role permissions, team structure, and feature reference
          </p>
        </div>
      </div>

      {/* Table of contents */}
      <div className="card">
        <div className="card-header"><h2 className="card-title">Contents</h2></div>
        <div className="card-body">
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            <a href="#my-profile" className="text-[14px] font-medium hover:underline" style={{ color: "var(--brand-700)" }}>My Profile & Role</a>
            <a href="#user-roles" className="text-[14px] font-medium hover:underline" style={{ color: "var(--brand-700)" }}>User Roles Guide</a>
            <a href="#teams" className="text-[14px] font-medium hover:underline" style={{ color: "var(--brand-700)" }}>Teams Directory</a>
            {FEATURE_DOCS.map((doc) => (
              <a key={doc.id} href={`#${doc.id}`} className="text-[14px] font-medium hover:underline" style={{ color: "var(--brand-700)" }}>
                {doc.title}
              </a>
            ))}
            <a href="#shortcuts" className="text-[14px] font-medium hover:underline" style={{ color: "var(--brand-700)" }}>Keyboard Shortcuts</a>
            <a href="#faq" className="text-[14px] font-medium hover:underline" style={{ color: "var(--brand-700)" }}>FAQ</a>
          </div>
        </div>
      </div>

      {/* ── My Profile ── */}
      {currentUser && (
        <Section id="my-profile" title="My Profile & Role">
          <div className="flex flex-wrap items-start gap-4">
            <span
              className="avatar avatar-lg"
              style={{
                background: "var(--brand)",
                color: "var(--text-inverse)",
                width: 48,
                height: 48,
                fontSize: "16px",
              }}
            >
              {currentUser.name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase()}
            </span>
            <div className="flex-1">
              <p className="text-[18px] font-bold" style={{ color: "var(--text-primary)" }}>
                {currentUser.name}
              </p>
              <p className="text-[13px]" style={{ color: "var(--text-secondary)" }}>
                {currentUser.email}
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                <span className="badge badge-brand">{currentUser.role.name}</span>
                <span className="badge badge-neutral">Scope: {currentUser.role.scope.toLowerCase()}</span>
                {userTeams.map((team) => (
                  <span key={team} className="badge badge-info">Team: {team}</span>
                ))}
              </div>
            </div>
          </div>
          {currentRoleDoc && (
            <div className="mt-4 space-y-3">
              <SubSection title="What you can do">
                <BulletList items={currentRoleDoc.canDo} />
              </SubSection>
              {currentRoleDoc.cannotDo.length > 0 && (
                <SubSection title="What you cannot do">
                  <BulletList items={currentRoleDoc.cannotDo} />
                </SubSection>
              )}
              <SubSection title="Your permissions">
                <PermTable permissions={userPermissions} />
              </SubSection>
            </div>
          )}
        </Section>
      )}

      {/* ── User Roles Guide ── */}
      <Section id="user-roles" title="User Roles Guide">
        <p className="text-[14px]" style={{ color: "var(--text-secondary)" }}>
          The CRM uses role-based access control (RBAC) with six roles in a hierarchy.
          Each role has a data scope that determines which records are visible, plus specific permissions.
        </p>
        {ROLE_DOCS.map((role) => (
          <div key={role.key} className="rounded-lg border p-4" style={{ borderColor: "var(--border-default)" }}>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-[16px] font-bold" style={{ color: "var(--text-primary)" }}>{role.name}</h3>
              <span className="badge badge-neutral">Scope: {role.scope}</span>
            </div>
            <p className="mt-1 text-[14px]" style={{ color: "var(--text-secondary)" }}>{role.description}</p>

            <div className="mt-3 grid gap-4 sm:grid-cols-2">
              <div>
                <p className="mb-1 text-[12px] font-semibold uppercase tracking-wider" style={{ color: "var(--success)" }}>✓ Can do</p>
                <BulletList items={role.canDo.slice(0, 6)} />
                {role.canDo.length > 6 && (
                  <p className="mt-1 text-[12px]" style={{ color: "var(--text-tertiary)" }}>+{role.canDo.length - 6} more…</p>
                )}
              </div>
              {role.cannotDo.length > 0 && (
                <div>
                  <p className="mb-1 text-[12px] font-semibold uppercase tracking-wider" style={{ color: "var(--error)" }}>✗ Cannot do</p>
                  <BulletList items={role.cannotDo.slice(0, 5)} />
                </div>
              )}
            </div>

            <details className="mt-3">
              <summary className="cursor-pointer text-[13px] font-medium" style={{ color: "var(--brand-700)" }}>
                View {role.name} workflow guide
              </summary>
              <div className="mt-2 space-y-3">
                <SubSection title="Typical workflow">
                  <StepList steps={role.workflow} />
                </SubSection>
                {role.tips.length > 0 && (
                  <SubSection title="Tips">
                    <BulletList items={role.tips} />
                  </SubSection>
                )}
              </div>
            </details>

            <details className="mt-2">
              <summary className="cursor-pointer text-[13px] font-medium" style={{ color: "var(--brand-700)" }}>
                View all {role.name} permissions
              </summary>
              <div className="mt-2">
                <PermTable permissions={[...permissionsForRoleKey(role.key as never)]} />
              </div>
            </details>
          </div>
        ))}
      </Section>

      {/* ── Teams Directory ── */}
      <Section id="teams" title="Teams Directory">
        <p className="text-[14px]" style={{ color: "var(--text-secondary)" }}>
          Teams organize users into working groups. Data visibility follows team membership:
          Reps see their own records, Team Leads see their team&#39;s records, and Managers see all teams in their hierarchy.
        </p>
        {teams.length === 0 ? (
          <p className="text-[14px]" style={{ color: "var(--text-tertiary)" }}>No teams configured yet.</p>
        ) : (
          teams.map((team) => (
            <div key={team.id} className="rounded-lg border p-4" style={{ borderColor: "var(--border-default)" }}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="text-[16px] font-bold" style={{ color: "var(--text-primary)" }}>
                    {team.name}
                    {team.parent && (
                      <span className="ml-2 text-[12px] font-normal" style={{ color: "var(--text-tertiary)" }}>
                        under {team.parent.name}
                      </span>
                    )}
                  </h3>
                  <p className="text-[13px]" style={{ color: "var(--text-secondary)" }}>
                    Led by {team.leader?.name ?? "—"} · {team.members.length} member{team.members.length === 1 ? "" : "s"}
                  </p>
                </div>
              </div>
              {team.members.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {team.members.map((member) => (
                    <div
                      key={member.id}
                      className="flex items-center gap-2 rounded-full border px-3 py-1.5"
                      style={{ borderColor: "var(--border-default)" }}
                    >
                      <span
                        className="avatar avatar-sm"
                        style={{
                          background: `hsl(${member.name.length * 37 % 360}, 60%, 45%)`,
                          color: "white",
                        }}
                      >
                        {member.name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase()}
                      </span>
                      <div className="leading-tight">
                        <p className="text-[13px] font-medium" style={{ color: "var(--text-primary)" }}>{member.name}</p>
                        <p className="text-[10px]" style={{ color: "var(--text-tertiary)" }}>{member.role.name}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))
        )}
      </Section>

      {/* ── Feature Guides ── */}
      {FEATURE_DOCS.map((feature) => (
        <Section key={feature.id} id={feature.id} title={feature.title}>
          <p className="text-[14px]" style={{ color: "var(--text-secondary)" }}>{feature.description}</p>
          {feature.topics.map((topic) => (
            <details key={topic.name} className="rounded-md border p-3" style={{ borderColor: "var(--border-default)" }}>
              <summary className="cursor-pointer text-[14px] font-medium" style={{ color: "var(--text-primary)" }}>
                {topic.name}
              </summary>
              <p className="mt-2 text-[14px]" style={{ color: "var(--text-secondary)" }}>{topic.content}</p>
            </details>
          ))}
        </Section>
      ))}

      {/* ── Keyboard Shortcuts ── */}
      <Section id="shortcuts" title="Keyboard Shortcuts">
        <div className="overflow-x-auto">
          <table className="table">
            <thead>
              <tr><th>Shortcut</th><th>Action</th><th>Context</th></tr>
            </thead>
            <tbody>
              {[
                { key: "/", action: "Focus global search", context: "Anywhere" },
                { key: "Alt+N", action: "Open quick actions menu", context: "Anywhere" },
                { key: "L", action: "New Lead", context: "Quick actions menu" },
                { key: "C", action: "New Contact", context: "Quick actions menu" },
                { key: "U", action: "New Customer", context: "Quick actions menu" },
                { key: "A", action: "New Account", context: "Quick actions menu" },
                { key: "T", action: "New Task", context: "Quick actions menu" },
                { key: "I", action: "Import data", context: "Quick actions menu" },
                { key: "Enter", action: "Open focused record", context: "Table row" },
                { key: "Tab", action: "Navigate between elements", context: "Anywhere" },
                { key: "Escape", action: "Close modal/dialog", context: "Any dialog" },
              ].map((shortcut) => (
                <tr key={shortcut.key}>
                  <td><kbd className="rounded border px-2 py-0.5 text-[12px] font-mono" style={{ borderColor: "var(--border-strong)", background: "var(--bg-subtle)" }}>{shortcut.key}</kbd></td>
                  <td>{shortcut.action}</td>
                  <td style={{ color: "var(--text-tertiary)" }}>{shortcut.context}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      {/* ── FAQ ── */}
      <Section id="faq" title="Frequently Asked Questions">
        {[
          { q: "Why can't I see certain leads?", a: "Your data scope determines visibility. Reps only see their own leads; Team Leads see team members' leads; Managers and Admins see all. Ask your admin if you need broader access." },
          { q: "How do I change a lead's status quickly?", a: "Click the status badge directly in the table (leads list view). A dropdown appears — select the new status and it saves immediately." },
          { q: "What happens when I convert a lead?", a: "The lead is marked as Converted and linked to the new/existing contact, customer, and opportunity. Open tasks and notes move to the contact. The lead's timeline is preserved." },
          { q: "Can I undo a merge?", a: "Merges store a full snapshot in the MergeRecord table. An admin can recover the merged record's data, but the operation is not reversible from the UI." },
          { q: "Why is the Email button not showing?", a: "The Email button only appears on records that have an email address. Additionally, SMTP must be configured (check Administration → Integrations)." },
          { q: "How do I import from Google Sheets?", a: "In Google Sheets: File → Share → Publish to web → select CSV format. Copy the link. In the CRM: Import → select \"Google Sheet\" → paste the link → Load sheet." },
          { q: "What does \"Upsert\" mean in imports?", a: "Upsert means: if a matching record exists (by email, phone, or external ID), update it. If not, create a new one." },
          { q: "How do I create a custom report?", a: "Navigate to Reports → \"Build a report\" → choose object, date field, group-by field, and optional time bucket → Run." },
          { q: "Can I export data I can't see?", a: "No. Exports respect your data scope — you can only export records you have permission to view." },
          { q: "What is the Platform Bridge?", a: "A read-only integration that links CRM customers to trading platform users. Once linked, you can view the platform user's account state, KYC status, wallet balances, and recent payments." },
          { q: "How do I add a custom field to Leads?", a: "Administration → Custom Fields → add a field with a key (camelCase), label, and type. The field appears in lead forms and is validated on every write." },
          { q: "What are Custom Objects?", a: "Admin-defined record types beyond the standard leads/contacts/accounts/customers. Examples: Properties, Vendors, Equipment. Each has its own field schema stored as JSON." },
        ].map((faq) => (
          <details key={faq.q} className="rounded-md border p-3" style={{ borderColor: "var(--border-default)" }}>
            <summary className="cursor-pointer text-[14px] font-medium" style={{ color: "var(--text-primary)" }}>
              {faq.q}
            </summary>
            <p className="mt-2 text-[14px]" style={{ color: "var(--text-secondary)" }}>{faq.a}</p>
          </details>
        ))}
      </Section>
    </div>
  );
}
