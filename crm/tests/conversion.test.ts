import test from "node:test";
import assert from "node:assert/strict";
import { prisma, repContext, managerContext, assertThrows, makeLead } from "./helpers";
import { conversionPreview, convertLead } from "../src/server/records/conversion";
import { mergeLeads, mergeRecords } from "../src/server/records/merge";
import { createContact, softDeleteContact } from "../src/server/records/contacts";
import { findMatches } from "../src/server/records/duplicates";

/** Lead conversion: dedup preview, history preservation, idempotency. */
test("conversion preview shows contact matches and blocks double conversion", async () => {
  const rep = await repContext();
  const lead = await makeLead(rep, "convert-preview");
  const preview = await conversionPreview(rep, lead);
  assert.ok(preview.matches, "preview returns match lists");
  const converted = await convertLead(rep, lead, {
    contact: { mode: "create" },
    customer: { mode: "none" },
    account: { mode: "none" },
    opportunity: { mode: "none" },
    force: true,
  });
  assert.ok(converted.contactId);
  await assertThrows(
    () => convertLead(rep, lead, { contact: { mode: "create" }, customer: { mode: "none" }, account: { mode: "none" }, opportunity: { mode: "none" } }),
    409,
    "double conversion",
  );
  await prisma.contact.delete({ where: { id: converted.contactId! } });
  await prisma.lead.delete({ where: { id: lead } });
});

test("conversion moves open tasks and notes to the contact", async () => {
  const rep = await repContext();
  const lead = await makeLead(rep, "convert-tasks");
  await prisma.note.create({
    data: { body: "conversion note", authorUserId: rep.userId, subjectType: "LEAD", subjectId: lead },
  });
  await prisma.task.create({
    data: { title: "conversion task", ownerUserId: rep.userId, subjectType: "LEAD", subjectId: lead },
  });
  const { contactId } = await convertLead(rep, lead, {
    contact: { mode: "create" },
    customer: { mode: "none" },
    account: { mode: "none" },
    opportunity: { mode: "none" },
    force: true,
  });
  const movedNote = await prisma.note.findFirstOrThrow({ where: { subjectType: "CONTACT", subjectId: contactId! } });
  assert.equal(movedNote.body, "conversion note");
  const movedTask = await prisma.task.findFirstOrThrow({ where: { subjectType: "CONTACT", subjectId: contactId! } });
  assert.equal(movedTask.title, "conversion task");
  // lastContactAt is updated by the notes SERVICE (direct prisma writes in
  // tests bypass it); verified in platform.test.ts at the service level.
  await prisma.task.delete({ where: { id: movedTask.id } });
  await prisma.note.delete({ where: { id: movedNote.id } });
  await prisma.contact.delete({ where: { id: contactId! } });
  await prisma.lead.delete({ where: { id: lead } });
});

/** Merge: snapshot recovery, timeline copy, soft delete. */
test("lead merge copies timeline and snapshots the merged record", async () => {
  const rep = await managerContext();
  const primary = await makeLead(rep, "merge-primary");
  const merged = await makeLead(rep, "merge-secondary");
  await prisma.activityEvent.create({
    data: { subjectType: "LEAD", subjectId: merged, kind: "created", actorUserId: rep.userId },
  });
  const result = await mergeLeads(rep, { primaryId: primary, mergedId: merged });
  assert.ok(result.copiedEvents >= 1, "events copied");
  const snapshot = await prisma.mergeRecord.findFirstOrThrow({ where: { primaryId: primary } });
  assert.ok(snapshot.snapshot, "snapshot stored");
  const mergedRow = await prisma.lead.findUniqueOrThrow({ where: { id: merged } });
  assert.ok(mergedRow.deletedAt, "merged lead soft-deleted");
  await prisma.lead.delete({ where: { id: primary } });
  await prisma.lead.delete({ where: { id: merged } });
  await prisma.mergeRecord.deleteMany({ where: { primaryId: primary } });
  await prisma.activityEvent.deleteMany({ where: { subjectId: merged } });
});

test("contact merge moves notes and soft-deletes the merged contact", async () => {
  const rep = await managerContext();
  const primary = await createContact(rep, { firstName: "Merge", lastName: "Keep" });
  const merged = await createContact(rep, { firstName: "Merge", lastName: "Away" });
  await prisma.note.create({
    data: { body: "moves with merge", authorUserId: rep.userId, subjectType: "CONTACT", subjectId: merged.id },
  });
  await mergeRecords(rep, { objectType: "CONTACT", primaryId: primary.id, mergedId: merged.id });
  const moved = await prisma.note.findFirstOrThrow({ where: { subjectType: "CONTACT", subjectId: primary.id } });
  assert.equal(moved.body, "moves with merge");
  const mergedRow = await prisma.contact.findUniqueOrThrow({ where: { id: merged.id } });
  assert.ok(mergedRow.deletedAt);
  await softDeleteContact(rep, primary.id);
  await prisma.note.delete({ where: { id: moved.id } });
  await prisma.contact.delete({ where: { id: primary.id } });
  await prisma.contact.delete({ where: { id: merged.id } });
});

/** Duplicate detection matching keys. */
test("findMatches matches by normalized email", async () => {
  const rep = await repContext();
  const lead = await makeLead(rep, `match-${Date.now()}`);
  const created = await prisma.lead.findUniqueOrThrow({ where: { id: lead } });
  const matches = await findMatches(rep, { email: `  ${created.email!.toUpperCase()} ` });
  assert.ok(matches.leads.some((entry) => entry.id === lead), "case/space-insensitive email match");
  await prisma.lead.delete({ where: { id: lead } });
});
