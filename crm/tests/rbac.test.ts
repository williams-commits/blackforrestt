import test from "node:test";
import assert from "node:assert/strict";
import { prisma, repContext, viewerContext, managerContext, adminContext, assertThrows, makeLead } from "./helpers";
import { ROLE_DEFINITIONS } from "../src/server/permissions";
import { listLeads, createLead, getLead, updateLead, softDeleteLead, bulkLeads } from "../src/server/records/leads";
import { createTask } from "../src/server/records/tasks";
import { createNote } from "../src/server/records/notes";
import { createAppointment } from "../src/server/records/appointments";
import { linkTag } from "../src/server/records/tags";
import { subjectPermission } from "../src/server/records/subjects";
import { convertLead } from "../src/server/records/conversion";
import { ALL_PERMISSIONS, PERMISSION_CATEGORIES } from "../src/server/permissions";

/**
 * Authorization + scope suite: the permission matrix and row visibility
 * enforced at the SERVICE layer (where every route delegates).
 */
test("viewer can read but not create leads", async () => {
  const viewer = await viewerContext();
  const readable = await listLeads(viewer, { page: 1, pageSize: 25 }, { assignment: "all" });
  assert.ok(readable.total > 0, "viewer (ORG scope) sees leads");
  // Permission enforcement happens at the route layer via requirePermission
  // (services enforce data SCOPE; routes enforce PERMISSIONS). The contract:
  // the viewer's permission set lacks every *_CREATE.
  assert.equal(viewer.permissions.includes("LEADS_CREATE"), false, "viewer lacks LEADS_CREATE");
  assert.equal(viewer.permissions.includes("CONTACTS_CREATE"), false, "viewer lacks CONTACTS_CREATE");
  assert.equal(viewer.permissions.some((permission) => permission.endsWith("_CREATE")), false);
  assert.equal(viewer.permissions.some((permission) => permission.endsWith("_DELETE")), false);
});

test("rep scope is OWN — cannot read or mutate another rep's lead", async () => {
  const rep = await repContext();
  const rep2 = await (await import("./helpers")).rep2Context();
  const rep2Lead = await makeLead(rep2, "scope");

  // invisible in the list
  const list = await listLeads(rep, { page: 1, pageSize: 100 }, { assignment: "all" });
  assert.equal(list.rows.some((row) => row.id === rep2Lead), false, "rep2's lead hidden from rep");

  await assertThrows(() => getLead(rep, rep2Lead), 404, "rep reading rep2's lead");
  await assertThrows(() => updateLead(rep, rep2Lead, { firstName: "Hacked" }), 404, "rep editing rep2's lead");
  await assertThrows(() => softDeleteLead(rep, rep2Lead), 404, "rep deleting rep2's lead");

  await prisma.lead.delete({ where: { id: rep2Lead } });
});

test("manager without the record-control permissions cannot classify or assign team leads", async () => {
  const rep = await repContext();
  const manager = await managerContext();
  const admin = await adminContext();
  const lead = await makeLead(rep, "mgr-bulk");

  const managerList = await listLeads(manager, { page: 1, pageSize: 100 }, { assignment: "all" });
  assert.equal(managerList.rows.some((row) => row.id === lead), true, "manager sees team lead");

  const status = await prisma.recordStatus.findFirstOrThrow({ where: { appliesTo: "LEAD", name: "Contacted" } });
  await assertThrows(
    () => bulkLeads({ ...manager, permissions: manager.permissions.filter((permission) => permission !== "LEADS_CHANGE_STATUS") }, { action: "status", ids: [lead], statusId: status.id }),
    403,
    "manager bulk status",
  );
  const result = await bulkLeads(admin, { action: "status", ids: [lead], statusId: status.id });
  assert.equal(result.affected, 1);

  await assertThrows(
    () => bulkLeads({ ...manager, permissions: manager.permissions.filter((permission) => permission !== "LEADS_ASSIGN") }, { action: "assign", ids: [lead], assignedUserId: rep.userId, assignedTeamId: null }),
    403,
    "manager bulk assign",
  );

  await prisma.lead.delete({ where: { id: lead } });
});

test("rep without LEADS_ASSIGN cannot bulk assign; forced create self-assigns", async () => {
  const rep = await repContext();
  const lead = await makeLead(rep, "self-assign");
  await assertThrows(
    () => bulkLeads(rep, { action: "assign", ids: [lead], assignedUserId: null, assignedTeamId: null }),
    403,
    "rep bulk assign",
  );
  const fetched = await getLead(rep, lead);
  assert.equal(fetched.assignedUserId, rep.userId, "created lead is self-assigned");
  await prisma.lead.delete({ where: { id: lead } });
});

test("duplicate guard: create with matching email returns 409 + matches", async () => {
  const rep = await repContext();
  const existing = await makeLead(rep, "dup-guard");
  await assertThrows(
    () => createLead(rep, { firstName: "Dup", lastName: "Attempt", email: "test.dup-guard@example.com" }),
    409,
    "duplicate create",
  );
  await prisma.lead.delete({ where: { id: existing } });
});

test("role definitions expose independent administrator controls", () => {
  const superAdmin = ROLE_DEFINITIONS.find((role) => role.key === "SUPER_ADMIN")!;
  const admin = ROLE_DEFINITIONS.find((role) => role.key === "ADMIN")!;
  const lowerRoles = ROLE_DEFINITIONS.filter((role) => !["SUPER_ADMIN", "ADMIN"].includes(role.key));
  for (const permission of admin.permissions) {
    assert.ok(superAdmin.permissions.includes(permission), `SUPER_ADMIN missing ${permission}`);
  }
  for (const permission of ["LEADS_ASSIGN", "LEADS_CHANGE_STATUS", "LEADS_MANAGE_TAGS"] as const) {
    assert.ok(admin.permissions.includes(permission), `ADMIN missing ${permission}`);
    assert.ok(superAdmin.permissions.includes(permission), `SUPER_ADMIN missing ${permission}`);
    assert.ok(lowerRoles.some((role) => role.permissions.includes(permission)), `${permission} should be explicitly available to working roles`);
  }
});

test("activity permissions are independent from lead edit", async () => {
  const rep = await repContext();
  const leadId = await makeLead(rep, "independent-actions");
  const permissions = [
    ...rep.permissions.filter((permission) => permission !== "LEADS_EDIT"),
    "LEADS_CHANGE_STATUS" as const,
    "LEADS_MANAGE_TAGS" as const,
  ];
  const actor = { ...rep, permissions };

  const task = await createTask(actor, { title: "Independent task", subjectType: "LEAD", subjectId: leadId });
  const note = await createNote(actor, { body: "Independent note", subjectType: "LEAD", subjectId: leadId });
  const appointment = await createAppointment(actor, {
    title: "Independent appointment",
    startAt: new Date(Date.now() + 60_000),
    subjectType: "LEAD",
    subjectId: leadId,
  });
  assert.equal(actor.permissions.includes("LEADS_EDIT"), false);
  assert.ok(task.id && note.id && appointment.id);

  const status = await prisma.recordStatus.findFirstOrThrow({ where: { appliesTo: "LEAD", name: "Contacted" } });
  await updateLead(actor, leadId, { statusId: status.id });

  const tag = await prisma.tag.findFirstOrThrow();
  const tagActor = { ...actor, permissions: [...actor.permissions, "TAGS_ASSIGN"] as never };
  await linkTag(tagActor, { tagId: tag.id, subjectType: "LEAD", subjectId: leadId });

  await prisma.appointment.delete({ where: { id: appointment.id } });
  await prisma.note.delete({ where: { id: note.id } });
  await prisma.task.delete({ where: { id: task.id } });
  await prisma.tagLink.deleteMany({ where: { tagId: tag.id, subjectId: leadId } });
  await prisma.lead.delete({ where: { id: leadId } });
});

test("unlinked task creation still requires TASKS_CREATE", async () => {
  const rep = await repContext();
  const actor = { ...rep, permissions: rep.permissions.filter((permission) => permission !== "TASKS_CREATE") };
  await assertThrows(
    () => createTask(actor, { title: "Denied task" }),
    403,
    "task create without TASKS_CREATE",
  );
  assert.equal(subjectPermission("LEAD", "CREATE_TASK"), "LEADS_CREATE_TASK");
});

test("independent action permissions deny only their own operation", async () => {
  const rep = await repContext();
  const leadId = await makeLead(rep, "independent-denials");
  const status = await prisma.recordStatus.findFirstOrThrow({ where: { appliesTo: "LEAD", name: "Contacted" } });
  const potentialStatus = await prisma.potentialStatus.findFirstOrThrow({ where: { isDefault: true } });
  const tag = await prisma.tag.findFirstOrThrow();
  const without = (permission: string) => ({ ...rep, permissions: rep.permissions.filter((entry) => entry !== permission) });

  await assertThrows(() => createNote(without("LEADS_ADD_NOTE"), { body: "Denied", subjectType: "LEAD", subjectId: leadId }), 403, "note permission");
  await assertThrows(() => createAppointment(without("LEADS_SCHEDULE_APPOINTMENT"), { title: "Denied", startAt: new Date(Date.now() + 60_000), subjectType: "LEAD", subjectId: leadId }), 403, "appointment permission");
  await assertThrows(() => updateLead(without("LEADS_CHANGE_STATUS"), leadId, { statusId: status.id }), 403, "status permission");
  await assertThrows(() => updateLead(without("LEADS_CHANGE_POTENTIAL_STATUS"), leadId, { potentialStatusId: potentialStatus.id }), 403, "potential status permission");
  await assertThrows(() => linkTag(without("LEADS_MANAGE_TAGS"), { tagId: tag.id, subjectType: "LEAD", subjectId: leadId }), 403, "tag assignment permission");
  await assertThrows(() => updateLead(without("LEADS_ASSIGN"), leadId, { assignedUserId: rep.userId }), 403, "assignment permission");
  await assertThrows(() => convertLead(without("LEADS_CONVERT"), leadId, { contact: { mode: "create" }, customer: { mode: "none" }, account: { mode: "none" }, opportunity: { mode: "none" } }), 403, "conversion permission");

  assert.ok(PERMISSION_CATEGORIES.some((category) => category.permissions.some((permission) => permission.key === "LEADS_EXPORT")), "lead export is categorized");
  assert.ok(PERMISSION_CATEGORIES.some((category) => category.permissions.some((permission) => permission.key === "RECORD_STATUS_CREATE")), "record status permissions are categorized");
  assert.ok(PERMISSION_CATEGORIES.some((category) => category.permissions.some((permission) => permission.key === "POTENTIAL_STATUS_CREATE")), "potential status permissions are categorized");
  assert.ok(PERMISSION_CATEGORIES.some((category) => category.permissions.some((permission) => permission.key === "TAGS_CREATE")), "tag permissions are categorized");
  assert.equal(subjectPermission("OPPORTUNITY", "CREATE_TASK"), "OPPORTUNITIES_CREATE_TASK");

  await prisma.lead.delete({ where: { id: leadId } });
});

// ── Generic bulk actions: per-action permission model ──────────────────────
// Regression: routes used to blanket-require <OBJECT>_EDIT, so a status-only
// user got "Forbidden — LEADS_EDIT permission required" on bulk status
// changes. The service is now the per-action authority (ASSIGN, CHANGE_STATUS,
// MANAGE_TAGS, CREATE_TASK, DELETE) — these tests pin that contract.
import { bulkRecords } from "../src/server/records/bulk";

test("bulk status change requires CHANGE_STATUS, not EDIT", async () => {
  const rep = await repContext();
  const lead = await makeLead(rep, "bulk-status-perm");
  const status = await prisma.recordStatus.findFirstOrThrow({ where: { appliesTo: "LEAD", name: "Contacted" } });

  // Status-only user (no LEADS_EDIT) CAN bulk-status — the reported bug.
  const statusOnly = { ...rep, permissions: rep.permissions.filter((permission) => permission !== "LEADS_EDIT") };
  const result = await bulkRecords(statusOnly, "leads", { action: "status", ids: [lead], statusId: status.id });
  assert.equal(result.affected, 1, "status-only user bulk-statuses");

  // EDIT without CHANGE_STATUS cannot bulk-status. (Explicit sets: the DB
  // role matrix is admin-editable, so never assume what the seed granted.)
  const editorOnly = { ...rep, permissions: [...new Set([...rep.permissions, "LEADS_EDIT" as const])].filter((permission) => permission !== "LEADS_CHANGE_STATUS") };
  await assertThrows(
    () => bulkRecords(editorOnly, "leads", { action: "status", ids: [lead], statusId: status.id }),
    403,
    "editor without CHANGE_STATUS bulk status",
  );

  await prisma.lead.delete({ where: { id: lead } });
});

test("bulk tag requires MANAGE_TAGS regardless of EDIT", async () => {
  const rep = await repContext();
  const lead = await makeLead(rep, "bulk-tag-perm");
  const tag = await prisma.tag.create({ data: { name: `perm-${Date.now()}` } });

  // EDIT but no MANAGE_TAGS → denied (explicit set: don't trust the seed).
  const editorOnly = { ...rep, permissions: rep.permissions.filter((permission) => permission !== "LEADS_MANAGE_TAGS") };
  await assertThrows(
    () => bulkRecords(editorOnly, "leads", { action: "tag", ids: [lead], tagId: tag.id }),
    403,
    "editor without MANAGE_TAGS bulk tag",
  );

  // Tags-only user (no EDIT) → allowed.
  const tagsOnly = { ...rep, permissions: [...rep.permissions, "LEADS_MANAGE_TAGS" as const] };
  const result = await bulkRecords(tagsOnly, "leads", { action: "tag", ids: [lead], tagId: tag.id });
  assert.equal(result.affected, 1, "tags-capability user bulk-tags");

  await prisma.lead.delete({ where: { id: lead } });
  await prisma.tag.delete({ where: { id: tag.id } });
});

test("bulk task requires the object's CREATE_TASK, not EDIT", async () => {
  const rep = await repContext();
  const lead = await makeLead(rep, "bulk-task-perm");

  // REP holds LEADS_CREATE_TASK by default → allowed even with EDIT removed.
  const taskOnly = { ...rep, permissions: rep.permissions.filter((permission) => permission !== "LEADS_EDIT") };
  const created = await bulkRecords(taskOnly, "leads", { action: "task", ids: [lead], title: "Bulk task check" });
  assert.equal(created.affected, 1, "task-capability user bulk-creates tasks");

  // Without LEADS_CREATE_TASK → denied (this action previously had NO check).
  const noTask = { ...rep, permissions: rep.permissions.filter((permission) => permission !== "LEADS_CREATE_TASK") };
  await assertThrows(
    () => bulkRecords(noTask, "leads", { action: "task", ids: [lead], title: "Should fail" }),
    403,
    "user without CREATE_TASK bulk task",
  );

  // Cross-object: CONTACTS_CREATE_TASK governs the contacts endpoint.
  const contact = await prisma.contact.create({
    data: { firstName: "Bulk", lastName: "Perm", ownerUserId: rep.userId },
  });
  const noContactTask = { ...rep, permissions: rep.permissions.filter((permission) => permission !== "CONTACTS_CREATE_TASK") };
  await assertThrows(
    () => bulkRecords(noContactTask, "contacts", { action: "task", ids: [contact.id], title: "Should fail" }),
    403,
    "user without CONTACTS_CREATE_TASK bulk task",
  );
  const withContactTask = { ...rep, permissions: [...rep.permissions, "CONTACTS_CREATE_TASK" as const] };
  const contactResult = await bulkRecords(withContactTask, "contacts", { action: "task", ids: [contact.id], title: "Contact task" });
  assert.equal(contactResult.affected, 1);

  await prisma.contact.delete({ where: { id: contact.id } });
  await prisma.lead.delete({ where: { id: lead } });
});

test("every permission is visible in the roles editor categories", () => {
  // Regression: FILES_*, USERS_MANAGE, TEAMS_MANAGE, IMPORTS_MANAGE,
  // DASHBOARDS_VIEW and ROLES_MANAGE were grantable but rendered nowhere —
  // "Disable all" silently kept them.
  const categorized = new Set(PERMISSION_CATEGORIES.flatMap((category) => category.permissions.map(({ key }) => key)));
  for (const permission of ALL_PERMISSIONS) {
    assert.ok(categorized.has(permission), `${permission} missing from PERMISSION_CATEGORIES (invisible in roles UI)`);
  }
});

type ScopedContextLike = Parameters<typeof updateLead>[0];

// ── Status × potential-status independence matrix ───────────────────────────
// Admin can toggle each permission independently; the backend must enforce
// exactly the toggled capability — never one in place of the other, and never
// a fallthrough that silently allows both.
import { updateContact } from "../src/server/records/contacts";
import { updateAccount } from "../src/server/records/accounts";
import { updateCustomer } from "../src/server/records/customers";

const WITHOUT = (permissions: readonly string[], remove: string) => permissions.filter((p) => p !== remove);
const WITH = (permissions: readonly string[], add: string) => [...new Set([...permissions, add])];

test("record status and potential status are enforced independently (leads)", async () => {
  const rep = await repContext();
  const lead = await makeLead(rep, "status-matrix");
  const status = await prisma.recordStatus.findFirstOrThrow({ where: { appliesTo: "LEAD", name: "Contacted" } });
  const potential = await prisma.potentialStatus.findFirstOrThrow({ where: { isDefault: true } });
  const other = await prisma.potentialStatus.findFirstOrThrow({ where: { isDefault: false } });

  // Permission sets are applied to a copy of the actor's context — the
  // scope fields (userId/teamIds) must always stay intact.
  const as = (permissions: string[]): ScopedContextLike => ({ ...rep, permissions });

  // Combo A: status OFF, potential ON → status denied, potential allowed.
  const comboA = as(WITH(WITHOUT(rep.permissions, "LEADS_CHANGE_STATUS"), "LEADS_CHANGE_POTENTIAL_STATUS"));
  await assertThrows(() => updateLead(comboA, lead, { statusId: status.id }), 403, "A: status denied");
  await updateLead(comboA, lead, { potentialStatusId: other.id }); // A: potential allowed

  // Combo B: status ON, potential OFF → status allowed, potential denied.
  const comboB = as(WITH(WITHOUT(rep.permissions, "LEADS_CHANGE_POTENTIAL_STATUS"), "LEADS_CHANGE_STATUS"));
  await updateLead(comboB, lead, { statusId: status.id }); // B: status allowed
  await assertThrows(() => updateLead(comboB, lead, { potentialStatusId: potential.id }), 403, "B: potential denied");

  // Combo C: both OFF → both denied.
  const comboC = as(WITHOUT(WITHOUT(rep.permissions, "LEADS_CHANGE_STATUS"), "LEADS_CHANGE_POTENTIAL_STATUS"));
  await assertThrows(() => updateLead(comboC, lead, { statusId: status.id }), 403, "C: status denied");
  await assertThrows(() => updateLead(comboC, lead, { potentialStatusId: other.id }), 403, "C: potential denied");

  await prisma.lead.delete({ where: { id: lead } });
});

test("record status permission is enforced per module", async () => {
  const rep = await repContext();
  const leadStatus = await prisma.recordStatus.findFirstOrThrow({ where: { appliesTo: "LEAD", name: "Contacted" } });

  const contact = await prisma.contact.create({ data: { firstName: "Matrix", lastName: "Contact", ownerUserId: rep.userId } });
  const account = await prisma.account.create({ data: { name: "Matrix Account", ownerUserId: rep.userId } });
  const customer = await prisma.customer.create({ data: { firstName: "Matrix", lastName: "Customer", ownerUserId: rep.userId } });
  const byApplies = async (applies: string) => prisma.recordStatus.findFirstOrThrow({ where: { appliesTo: applies, isDefault: false } });

  for (const [name, prefix, update, row, statusRow] of [
    ["contacts", "CONTACTS", updateContact, contact, await byApplies("CONTACT")] as const,
    ["accounts", "ACCOUNTS", updateAccount, account, await byApplies("ACCOUNT")] as const,
    ["customers", "CUSTOMERS", updateCustomer, customer, await byApplies("CUSTOMER")] as const,
  ]) {
    const run = update as unknown as (ctx: ScopedContextLike, id: string, input: Record<string, unknown>) => Promise<unknown>;
    // OFF (even with EDIT): denied.
    const off = { ...rep, permissions: WITHOUT(rep.permissions, `${prefix}_CHANGE_STATUS`) };
    await assertThrows(() => run(off, row.id, { statusId: statusRow.id }), 403, `${name}: status denied when off`);
    // ON (without EDIT): allowed.
    const on = { ...rep, permissions: WITHOUT(WITH(rep.permissions, `${prefix}_CHANGE_STATUS`), `${prefix}_EDIT`) };
    await run(on, row.id, { statusId: statusRow.id });
    // Cross-module: another object's CHANGE_STATUS does not unlock this one.
    const cross = { ...rep, permissions: WITH(WITHOUT(rep.permissions, `${prefix}_CHANGE_STATUS`), "LEADS_CHANGE_STATUS") };
    await assertThrows(() => run(cross, row.id, { statusId: statusRow.id }), 403, `${name}: cross-object permission does not unlock`);
    void leadStatus;
  }

  await prisma.customer.delete({ where: { id: customer.id } });
  await prisma.account.delete({ where: { id: account.id } });
  await prisma.contact.delete({ where: { id: contact.id } });
});
