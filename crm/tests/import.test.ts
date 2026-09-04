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
  const existing = await prisma.lead.findFirstOrThrow({ where: { deletedAt: null } });
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
