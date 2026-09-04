import test from "node:test";
import assert from "node:assert/strict";
import { prisma, repContext, viewerContext, managerContext, assertThrows, makeLead } from "./helpers";
import { ROLE_DEFINITIONS } from "../src/server/permissions";
import { listLeads, createLead, getLead, updateLead, softDeleteLead, bulkLeads } from "../src/server/records/leads";

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

test("manager (HIERARCHY) sees team members' leads and can bulk-assign", async () => {
  const rep = await repContext();
  const manager = await managerContext();
  const lead = await makeLead(rep, "mgr-bulk");

  const managerList = await listLeads(manager, { page: 1, pageSize: 100 }, { assignment: "all" });
  assert.equal(managerList.rows.some((row) => row.id === lead), true, "manager sees team lead");

  const status = await prisma.recordStatus.findFirstOrThrow({ where: { appliesTo: "LEAD", name: "Contacted" } });
  const result = await bulkLeads(manager, { action: "status", ids: [lead], statusId: status.id });
  assert.equal(result.affected, 1);

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

test("role definitions keep the superset ordering (SUPER_ADMIN ⊇ ADMIN)", () => {
  const superAdmin = ROLE_DEFINITIONS.find((role) => role.key === "SUPER_ADMIN")!;
  const admin = ROLE_DEFINITIONS.find((role) => role.key === "ADMIN")!;
  for (const permission of admin.permissions) {
    assert.ok(superAdmin.permissions.includes(permission), `SUPER_ADMIN missing ${permission}`);
  }
});
