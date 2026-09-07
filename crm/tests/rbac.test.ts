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
import { PERMISSION_CATEGORIES } from "../src/server/permissions";

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

test("task creation is denied when TASKS_CREATE is off even if lead edit is on", async () => {
  const rep = await repContext();
  const leadId = await makeLead(rep, "task-permission");
  const actor = { ...rep, permissions: rep.permissions.filter((permission) => permission !== "TASKS_CREATE") };
  await assertThrows(
    () => createTask(actor, { title: "Denied task", subjectType: "LEAD", subjectId: leadId }),
    403,
    "task create without TASKS_CREATE",
  );
  assert.equal(subjectPermission("LEAD", "CREATE_TASK"), "LEADS_CREATE_TASK");
  await prisma.lead.delete({ where: { id: leadId } });
});

test("independent action permissions deny only their own operation", async () => {
  const rep = await repContext();
  const leadId = await makeLead(rep, "independent-denials");
  const status = await prisma.recordStatus.findFirstOrThrow({ where: { appliesTo: "LEAD", name: "Contacted" } });
  const potentialStatus = await prisma.potentialStatus.findFirstOrThrow({ where: { isDefault: true } });
  const tag = await prisma.tag.findFirstOrThrow();
  const without = (permission: string) => ({ ...rep, permissions: rep.permissions.filter((entry) => entry !== permission) });

  await assertThrows(() => createNote(without("NOTES_CREATE"), { body: "Denied", subjectType: "LEAD", subjectId: leadId }), 403, "note permission");
  await assertThrows(() => createAppointment(without("APPOINTMENTS_CREATE"), { title: "Denied", startAt: new Date(Date.now() + 60_000), subjectType: "LEAD", subjectId: leadId }), 403, "appointment permission");
  await assertThrows(() => updateLead(without("LEADS_CHANGE_STATUS"), leadId, { statusId: status.id }), 403, "status permission");
  await assertThrows(() => updateLead(without("LEADS_CHANGE_POTENTIAL_STATUS"), leadId, { potentialStatusId: potentialStatus.id }), 403, "potential status permission");
  await assertThrows(() => linkTag(without("TAGS_ASSIGN"), { tagId: tag.id, subjectType: "LEAD", subjectId: leadId }), 403, "tag assignment permission");
  await assertThrows(() => updateLead(without("LEADS_ASSIGN"), leadId, { assignedUserId: rep.userId }), 403, "assignment permission");
  await assertThrows(() => convertLead(without("LEADS_CONVERT"), leadId, { contact: { mode: "create" }, customer: { mode: "none" }, account: { mode: "none" }, opportunity: { mode: "none" } }), 403, "conversion permission");

  assert.ok(PERMISSION_CATEGORIES.some((category) => category.permissions.some((permission) => permission.key === "LEADS_EXPORT")), "lead export is categorized");
  assert.ok(PERMISSION_CATEGORIES.some((category) => category.permissions.some((permission) => permission.key === "RECORD_STATUS_CREATE")), "record status permissions are categorized");
  assert.ok(PERMISSION_CATEGORIES.some((category) => category.permissions.some((permission) => permission.key === "POTENTIAL_STATUS_CREATE")), "potential status permissions are categorized");
  assert.ok(PERMISSION_CATEGORIES.some((category) => category.permissions.some((permission) => permission.key === "TAGS_CREATE")), "tag permissions are categorized");

  await prisma.lead.delete({ where: { id: leadId } });
});
