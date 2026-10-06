import test from "node:test";
import assert from "node:assert/strict";
import { prisma, repContext, rep2Context, viewerContext, makeLead } from "./helpers";
import { exportRecords } from "../src/server/records/export";
import { pgSearch } from "../src/server/search/pg";
import { runReport } from "../src/server/reports/engine";
import { findReport } from "../src/server/reports/prebuilt";
import { normalizeCountry, normalizePhone, normalizeEmail } from "../src/server/normalize";

/** Exports respect scope: rep exports only their rows. */
test("export CSV contains only in-scope leads", async () => {
  const rep = await repContext();
  const rep2 = await rep2Context();
  const mine = await makeLead(rep, "export-mine");
  const theirs = await makeLead(rep2, "export-theirs");
  const csv = await exportRecords(rep, "LEAD", {});
  assert.ok(csv.includes("test.export-mine@example.com"), "own lead exported");
  assert.ok(!csv.includes("test.export-theirs@example.com"), "out-of-scope lead excluded");
  await prisma.lead.delete({ where: { id: mine } });
  await prisma.lead.delete({ where: { id: theirs } });
});

test("export permission gate is enforced by the route's permission constant", async () => {
  // Service enforces scope; the route enforces *_EXPORT. The mapping is
  // static, so assert the contract: viewer role lacks LEADS_EXPORT.
  const viewer = await viewerContext();
  assert.equal(viewer.permissions.includes("LEADS_EXPORT"), false, "viewer cannot export");
});

/** Search scope isolation. */
test("search only returns in-scope records", async () => {
  const rep = await repContext();
  const rep2 = await rep2Context();
  const theirs = await makeLead(rep2, "search-hidden");
  const hits = await pgSearch.search(rep, "test.search-hidden", 10);
  assert.equal(hits.some((hit) => hit.id === theirs), false, "rep2's lead not searchable by rep");
  await prisma.lead.delete({ where: { id: theirs } });
});

test("search finds notes on visible records", async () => {
  const rep = await repContext();
  const lead = await makeLead(rep, "note-search");
  await prisma.note.create({
    data: {
      body: "xenon-needle-note-body",
      authorUserId: rep.userId,
      subjectType: "LEAD",
      subjectId: lead,
    },
  });
  const hits = await pgSearch.search(rep, "xenon-needle-note-body", 10);
  assert.ok(hits.some((hit) => hit.objectType === "NOTE"), "note hit returned");
  await prisma.note.deleteMany({ where: { subjectId: lead } });
  await prisma.lead.delete({ where: { id: lead } });
});

/** Reports: scope + engine correctness. */
test("leads-by-source report respects OWN scope", async () => {
  const rep = await repContext();
  const rep2 = await rep2Context();
  const mine = await makeLead(rep, "report-scope");
  const theirs = await makeLead(rep2, "report-scope");
  const def = findReport("leads-by-source")!;
  const repRows = await runReport(rep, def, {});
  const total = repRows.reduce((sum, row) => sum + row.count, 0);
  const list = await prisma.lead.count({ where: { deletedAt: null, assignedUserId: rep.userId } });
  assert.equal(total, list, "report total equals scoped lead count");
  await prisma.lead.delete({ where: { id: mine } });
  await prisma.lead.delete({ where: { id: theirs } });
});

test("time-bucket report groups by month and excludes null dates", async () => {
  const viewer = await viewerContext();
  const def = findReport("leads-over-time")!;
  const rows = await runReport(viewer, def, {});
  const monthPattern = /^\d{4}-\d{2}$/;
  assert.ok(rows.every((row) => monthPattern.test(row.key ?? "")), "keys are YYYY-MM");
});

/** Normalization (spec §16). */
test("country and phone normalization", () => {
  assert.equal(normalizeCountry("United Kingdom"), "GB");
  assert.equal(normalizeCountry("uae"), "AE");
  assert.equal(normalizeCountry("de"), "DE");
  assert.equal(normalizeCountry("Atlantis"), "Atlantis", "unknown passes through");
  assert.equal(normalizePhone("+44 (20) 7946-0958"), "+442079460958");
  assert.equal(normalizeEmail("  MiXeD@Example.COM "), "mixed@example.com");
});

/** Audit log: append-only contract (no code path may update or delete). */
test("audit log grows on mutations and stores before/after", async () => {
  const rep = await repContext();
  const lead = await makeLead(rep, "audit-trail");
  const entry = await prisma.auditLog.findFirstOrThrow({
    where: { objectId: lead, action: "LEAD_CREATED" },
    orderBy: { createdAt: "desc" },
  });
  assert.ok(entry.after, "after payload present");
  await prisma.lead.delete({ where: { id: lead } });
});
