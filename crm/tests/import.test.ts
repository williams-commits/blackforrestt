import test from "node:test";
import assert from "node:assert/strict";
import { prisma, repContext, managerContext } from "./helpers";
import { startImport, validateImport } from "../src/server/imports/csvImport";
import { parseCsv } from "../src/server/imports/sheets";

/** Import engine: validation, strategies, error capture, CSV parsing. */
const MAPPING = { First: "firstName", Last: "lastName", Email: "email", Ext: "externalId" };
const MATCH = { email: true, phone: false, externalId: true };

test("validation flags bad emails, missing required fields, and duplicates", async () => {
  const rep = await repContext();
  // Find a lead in the REP's scope so duplicate matching can see it
  const existing = await prisma.lead.findFirstOrThrow({
    where: { deletedAt: null, assignedUserId: rep.userId },
  });
  const result = await validateImport(rep, {
    objectType: "LEAD",
    mapping: MAPPING,
    matchRules: MATCH,
    rows: [
      { First: "Ok", Last: "Row", Email: "ok@example.com", Ext: "IT-1" },
      { First: "Bad", Last: "Email", Email: "not-an-email", Ext: "IT-2" },
      { First: "", Last: "NoFirst", Email: "x@example.com", Ext: "IT-3" },
      { First: "Dup", Last: "Row", Email: existing.email ?? undefined, Ext: "IT-4" },
    ],
  });
  assert.equal(result.summary.errorRows >= 2, true, "bad email + missing first name flagged");
  assert.equal(result.summary.duplicateRows >= 1, true, "duplicate against existing lead found");
});

test("CREATE import job: rows written, duplicates skipped, per-row errors recorded", async () => {
  const manager = await managerContext();
  const { jobId } = await startImport(manager, {
    objectType: "LEAD",
    strategy: "CREATE",
    mapping: MAPPING,
    matchRules: MATCH,
    fileName: "test-create.csv",
    rows: [
      { First: "Import", Last: "Works", Email: "import.works@example.com", Ext: "IT-CREATE-1" },
      { First: "Bad", Last: "Row", Email: "nope", Ext: "IT-CREATE-2" },
    ],
  });
  // The job runs detached; poll briefly like the UI does.
  let job: { status: string; createdCount: number; errorCount: number } | null = null;
  for (let attempt = 0; attempt < 20; attempt += 1) {
    job = await prisma.importJob.findUniqueOrThrow({ where: { id: jobId } });
    if (job.status !== "RUNNING") break;
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
  assert.equal(job!.status, "COMPLETED");
  assert.equal(job!.createdCount, 1);
  assert.equal(job!.errorCount, 1);
  const errors = await prisma.importError.findMany({ where: { jobId } });
  assert.equal(errors.length, 1, "error row recorded with raw data");
  await prisma.lead.deleteMany({ where: { externalId: "IT-CREATE-1" } });
  await prisma.importError.deleteMany({ where: { jobId } });
  await prisma.importJob.delete({ where: { id: jobId } });
});

test("UPSERT strategy updates matched rows", async () => {
  const manager = await managerContext();
  const seed = await startImport(manager, {
    objectType: "LEAD",
    strategy: "CREATE",
    mapping: MAPPING,
    matchRules: MATCH,
    fileName: "upsert-seed.csv",
    rows: [{ First: "Upsert", Last: "Seed", Email: "upsert.seed@example.com", Ext: "IT-UP-1" }],
  });
  await waitForJob(seed.jobId);
  const run = await startImport(manager, {
    objectType: "LEAD",
    strategy: "UPSERT",
    mapping: MAPPING,
    matchRules: MATCH,
    fileName: "upsert-run.csv",
    rows: [{ First: "Upsert", Last: "Updated", Email: "upsert.seed@example.com", Ext: "IT-UP-1" }],
  });
  const finished = await waitForJob(run.jobId);
  assert.equal(finished.updatedCount, 1);
  assert.equal(finished.createdCount, 0);
  await prisma.lead.deleteMany({ where: { externalId: "IT-UP-1" } });
  await prisma.importJob.deleteMany({ where: { id: { in: [seed.jobId, run.jobId] } } });
});

async function waitForJob(jobId: string): Promise<{ status: string; createdCount: number; updatedCount: number; errorCount: number }> {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const job = await prisma.importJob.findUniqueOrThrow({ where: { id: jobId } });
    if (job.status !== "RUNNING") return job as never;
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
  throw new Error("job did not finish");
}

/** RFC-4180 parser used by the Sheets provider. */
test("CSV parser handles quotes, commas, and CRLF", () => {
  const parsed = parseCsv('Name,Note\n"Doe, John","said ""hi"""\r\nPlain,Row\r\n');
  assert.deepEqual(parsed.columns, ["Name", "Note"]);
  assert.equal(parsed.rows[0]!.Name, "Doe, John");
  assert.equal(parsed.rows[0]!.Note, 'said "hi"');
  assert.equal(parsed.rows.length, 2);
});

test("default source fills rows without a source; mapped column wins; updates untouched", async () => {
  const rep = await repContext();
  const manager = await managerContext();
  const mapping = { First: "firstName", Last: "lastName", Email: "email", Ext: "externalId", Src: "source" };
  const match = { email: true, phone: false, externalId: true };

  // Validation preview reflects the default on rows with no source cell,
  // and keeps a mapped non-empty value.
  const validation = await validateImport(rep, {
    objectType: "LEAD",
    mapping,
    matchRules: match,
    defaults: { source: "WEB_FORM" },
    rows: [
      { First: "No", Last: "Source", Email: "default.none@example.com", Ext: "DEF-SRC-1" },
      { First: "Has", Last: "Source", Email: "default.some@example.com", Ext: "DEF-SRC-2", Src: "REFERRAL" },
    ],
  });
  const noSource = validation.transformed[0]!;
  const hasSource = validation.transformed[1]!;
  assert.equal(noSource.data.source, "WEB_FORM", "default applied when row has no source");
  assert.deepEqual(noSource.defaultsApplied, ["source"]);
  assert.equal(hasSource.data.source, "REFERRAL", "mapped column wins over default");
  assert.equal(hasSource.defaultsApplied, undefined, "no default marker for mapped value");

  // CREATE writes the default; a later UPDATE of the same record must NOT
  // overwrite its source with the default.
  const { jobId } = await startImport(manager, {
    objectType: "LEAD",
    strategy: "CREATE",
    mapping,
    matchRules: match,
    defaults: { source: "WEB_FORM" },
    fileName: "test-default-source.csv",
    rows: [{ First: "Default", Last: "Source", Email: "default.create@example.com", Ext: "DEF-SRC-3" }],
  });
  let job: { status: string; createdCount: number } | null = null;
  for (let attempt = 0; attempt < 20; attempt += 1) {
    job = await prisma.importJob.findUniqueOrThrow({ where: { id: jobId } });
    if (job.status !== "RUNNING") break;
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
  assert.equal(job!.status, "COMPLETED");
  const created = await prisma.lead.findUniqueOrThrow({ where: { externalId: "DEF-SRC-3" } });
  assert.equal(created.source, "WEB_FORM", "created row carries default source");

  // Upsert-update with a default must leave the stored source alone.
  await startImport(manager, {
    objectType: "LEAD",
    strategy: "UPSERT",
    mapping,
    matchRules: match,
    defaults: { source: "PARTNER_EVENT" },
    fileName: "test-default-update.csv",
    rows: [{ First: "Default", Last: "Updated", Email: "default.create@example.com", Ext: "DEF-SRC-3" }],
  });
  let updated: { source: string; lastName: string } | null = null;
  for (let attempt = 0; attempt < 30; attempt += 1) {
    updated = await prisma.lead.findUniqueOrThrow({ where: { externalId: "DEF-SRC-3" } });
    if (updated.lastName === "Updated") break;
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
  assert.equal(updated!.lastName, "Updated", "upsert updated the record");
  assert.equal(updated!.source, "WEB_FORM", "default never overwrites an existing record's source");

  await prisma.lead.deleteMany({ where: { externalId: { in: ["DEF-SRC-1", "DEF-SRC-2", "DEF-SRC-3"] } } });
  // Error rows FK-reference their job — clear them before removing the jobs.
  const jobs = await prisma.importJob.findMany({ where: { fileKey: { in: ["test-default-source.csv", "test-default-update.csv"] } }, select: { id: true } });
  for (const { id } of jobs) {
    await prisma.importError.deleteMany({ where: { jobId: id } });
    await prisma.importJob.delete({ where: { id } });
  }
});
