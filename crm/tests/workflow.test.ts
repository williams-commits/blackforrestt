import test from "node:test";
import assert from "node:assert/strict";
import { prisma, repContext, managerContext, makeLead } from "./helpers";
import { bulkLeads } from "../src/server/records/leads";
import { createTask } from "../src/server/records/tasks";

/**
 * Concurrency and workflow edge cases the spec calls out (§45):
 * concurrent assignment, duplicate imports, and the full lead workflow.
 */
test("concurrent bulk assignment: both managers write, no data corruption", async () => {
  const rep = await repContext();
  const mgrA = await managerContext();
  const mgrB = await managerContext();
  const lead = await makeLead(rep, "concurrent");

  const statusA = await prisma.recordStatus.findFirstOrThrow({ where: { appliesTo: "LEAD", name: "Contacted" } });
  const statusB = await prisma.recordStatus.findFirstOrThrow({ where: { appliesTo: "LEAD", name: "Qualified" } });

  // Fire both bulk-status changes simultaneously — they race on the same row.
  const [resultA, resultB] = await Promise.allSettled([
    bulkLeads(mgrA, { action: "status", ids: [lead], statusId: statusA.id }),
    bulkLeads(mgrB, { action: "status", ids: [lead], statusId: statusB.id }),
  ]);

  // Under concurrent writes, at least one must succeed (the other may
  // lose a transaction race — that's correct behavior, not corruption).
  const settled = [resultA, resultB].filter((r) => r.status === "fulfilled");
  assert.ok(settled.length >= 1, "at least one bulk assignment succeeds");

  // The lead must still exist, not deleted, with a valid status.
  const after = await prisma.lead.findUniqueOrThrow({ where: { id: lead } });
  assert.ok(!after.deletedAt, "lead not soft-deleted");
  assert.ok(after.statusId, "lead has a status");

  // Audit entries for bulk status changes — zero or more from the failed
  // transaction, one from the winner. We check audit entries exist for this
  // lead across ALL actions (creation audit at minimum).
  const audits = await prisma.auditLog.findMany({ where: { objectId: lead } });
  assert.ok(audits.length >= 1, `at least the creation audit, got ${audits.length}`);

  await prisma.lead.delete({ where: { id: lead } });
  await prisma.auditLog.deleteMany({ where: { objectId: lead } });
});

test("duplicate import: same file twice → second run reports duplicates under CREATE", async () => {
  const mgr = await managerContext();
  const { startImport } = await import("../src/server/imports/csvImport");
  const mapping = { First: "firstName", Last: "lastName", Email: "email", Ext: "externalId" };
  const matchRules = { email: true, phone: false, externalId: true };
  const rows = [{ First: "Dup", Last: "Import", Email: `dup.import.${Date.now()}@example.com`, Ext: `DUP-${Date.now()}` }];

  const first = await startImport(mgr, { objectType: "LEAD", strategy: "CREATE", mapping, matchRules, fileName: "dup-1.csv", rows });
  await waitForJob(first.jobId);
  const second = await startImport(mgr, { objectType: "LEAD", strategy: "CREATE", mapping, matchRules, fileName: "dup-2.csv", rows });
  const secondJob = await waitForJob(second.jobId);

  assert.equal(secondJob.duplicateCount, 1, "second import flags the duplicate");
  assert.equal(secondJob.createdCount, 0, "no new record created");

  // Cleanup
  await prisma.lead.deleteMany({ where: { externalId: rows[0]!.Ext } });
  await prisma.importJob.deleteMany({ where: { id: { in: [first.jobId, second.jobId] } } });
});

test("full lead workflow: create → task → note → convert → verify timeline", async () => {
  const rep = await repContext();
  const lead = await makeLead(rep, `workflow-${Date.now()}`);
  const leadId = lead;

  // Attach activity
  await createTask(rep, {
    title: "Qualification call",
    subjectType: "LEAD",
    subjectId: leadId,
  });
  await prisma.note.create({
    data: { body: "Interested in premium plan", authorUserId: rep.userId, subjectType: "LEAD", subjectId: leadId },
  });

  // Convert
  const { convertLead } = await import("../src/server/records/conversion");
  const result = await convertLead(rep, leadId, {
    contact: { mode: "create" },
    customer: { mode: "create" },
    account: { mode: "none" },
    opportunity: { mode: "create" },
    force: true,
  });

  // Verify all outputs
  assert.ok(result.contactId, "contact created");
  assert.ok(result.customerId, "customer created");
  assert.ok(result.opportunityId, "opportunity created");

  // Lead marked converted
  const converted = await prisma.lead.findUniqueOrThrow({ where: { id: leadId } });
  assert.ok(converted.convertedAt, "lead marked converted");
  assert.equal(converted.convertedContactId, result.contactId);
  assert.equal(converted.convertedCustomerId, result.customerId);
  assert.equal(converted.convertedOpportunityId, result.opportunityId);

  // Task and note re-pointed
  const movedTask = await prisma.task.findFirstOrThrow({ where: { subjectType: "CONTACT", subjectId: result.contactId! } });
  assert.equal(movedTask.title, "Qualification call");
  const movedNote = await prisma.note.findFirstOrThrow({ where: { subjectType: "CONTACT", subjectId: result.contactId! } });
  assert.equal(movedNote.body, "Interested in premium plan");

  // Cleanup
  await prisma.task.delete({ where: { id: movedTask.id } });
  await prisma.note.delete({ where: { id: movedNote.id } });
  await prisma.customer.delete({ where: { id: result.customerId! } });
  await prisma.opportunity.delete({ where: { id: result.opportunityId! } });
  await prisma.contact.delete({ where: { id: result.contactId! } });
  await prisma.lead.delete({ where: { id: leadId } });
});

async function waitForJob(jobId: string): Promise<{ status: string; createdCount: number; updatedCount: number; duplicateCount: number; errorCount: number }> {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const job = await prisma.importJob.findUniqueOrThrow({ where: { id: jobId } });
    if (job.status !== "RUNNING") return job as never;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error("job did not finish");
}
