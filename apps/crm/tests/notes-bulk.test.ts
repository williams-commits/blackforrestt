import test from "node:test";
import assert from "node:assert/strict";
import { prisma, repContext, rep2Context, viewerContext, adminContext, makeLead, assertThrows } from "./helpers";
import { BulkCreateNotes, createNotesBulk } from "../src/server/records/notes";

/**
 * Bulk note creation coverage: the ADD_NOTE permission gate, schema
 * validation (empty selection, empty/oversized bodies), per-record scope
 * enforcement (an out-of-scope record fails alone — partial success), the
 * single-note side effects carried per record (activity, audit, owner
 * notification), and duplicate-id collapsing. All through the service —
 * authorization lives there, same as every other records feature.
 */

async function cleanupLeads(leadIds: string[]) {
  if (leadIds.length === 0) return;
  const notes = await prisma.note.findMany({
    where: { subjectType: "LEAD", subjectId: { in: leadIds } },
    select: { id: true },
  });
  const noteIds = notes.map((note) => note.id);
  // Prisma's Json filter cannot combine `path` with `in` — spell the list as OR-of-equals.
  const notificationScope = { type: "NOTE_ADDED", OR: leadIds.map((id) => ({ payload: { path: ["recordId"], equals: id } })) };
  await prisma.notification.deleteMany({ where: notificationScope }).catch(() => undefined);
  await prisma.activityEvent.deleteMany({ where: { subjectType: "LEAD", subjectId: { in: leadIds } } });
  await prisma.auditLog.deleteMany({ where: { objectType: "Note", objectId: { in: noteIds } } });
  await prisma.note.deleteMany({ where: { id: { in: noteIds } } });
  await prisma.lead.deleteMany({ where: { id: { in: leadIds } } });
}

test("bulk notes require the subject's ADD_NOTE permission (viewer is denied)", async () => {
  const rep = await repContext();
  const viewer = await viewerContext();
  const leadId = await makeLead(rep, "bulk_gate");
  try {
    await assertThrows(
      () => createNotesBulk(viewer, { subjectType: "LEAD", subjectIds: [leadId], body: "viewer must not add notes" }),
      403,
      "viewer without LEADS_ADD_NOTE",
    );
    assert.equal(await prisma.note.count({ where: { subjectType: "LEAD", subjectId: leadId } }), 0, "no notes leaked");
  } finally {
    await cleanupLeads([leadId]);
  }
});

test("an empty selection is rejected by the schema", () => {
  const parsed = BulkCreateNotes.safeParse({ subjectType: "LEAD", subjectIds: [], body: "no records" });
  assert.equal(parsed.success, false, "empty subjectIds must not parse");
  const tooMany = BulkCreateNotes.safeParse({
    subjectType: "LEAD",
    subjectIds: Array.from({ length: 501 }, (_, i) => `id-${i}-padpadpad`),
    body: "over the cap",
  });
  assert.equal(tooMany.success, false, "over-500 subjectIds must not parse");
});

test("empty and oversized note bodies are rejected before any record is touched", async () => {
  const rep = await repContext();
  const leadId = await makeLead(rep, "bulk_invalid");
  try {
    await assertThrows(
      () => createNotesBulk(rep, { subjectType: "LEAD", subjectIds: [leadId], body: "   " }),
      400,
      "whitespace-only body",
    );
    await assertThrows(
      () => createNotesBulk(rep, { subjectType: "LEAD", subjectIds: [leadId], body: "x".repeat(6000) }),
      400,
      "over-length body",
    );
    assert.equal(await prisma.note.count({ where: { subjectType: "LEAD", subjectId: leadId } }), 0, "nothing written");
  } finally {
    await cleanupLeads([leadId]);
  }
});

test("single record: note + activity + audit + owner notification", async () => {
  const rep = await repContext(); // lead owner (makeLead assigns to ctx)
  const admin = await adminContext(); // ORG scope author → rep gets notified
  const leadId = await makeLead(rep, "bulk_single");
  try {
    const result = await createNotesBulk(admin, {
      subjectType: "LEAD",
      subjectIds: [leadId],
      body: "<p>Bulk single note</p>",
    });
    assert.equal(result.createdCount, 1);
    assert.equal(result.failures.length, 0);
    assert.equal(result.requestedCount, 1);

    const note = await prisma.note.findFirstOrThrow({ where: { subjectType: "LEAD", subjectId: leadId } });
    assert.equal(note.authorUserId, admin.userId);
    assert.match(note.body, /Bulk single note/);

    assert.equal(
      await prisma.activityEvent.count({ where: { subjectType: "LEAD", subjectId: leadId, kind: "note_added" } }),
      1,
      "timeline activity written",
    );
    assert.equal(
      await prisma.auditLog.count({ where: { objectType: "Note", objectId: note.id, action: "NOTE_ADDED" } }),
      1,
      "audit row written",
    );
    assert.equal(
      await prisma.notification.count({
        where: { recipientUserId: rep.userId, type: "NOTE_ADDED", payload: { path: ["recordId"], equals: leadId } },
      }),
      1,
      "owner (not the author) notified",
    );
  } finally {
    await cleanupLeads([leadId]);
  }
});

test("multiple records: one note per record, each with its own side effects", async () => {
  const rep = await repContext();
  const admin = await adminContext();
  const leadIds = [await makeLead(rep, "bulk_multi_a"), await makeLead(rep, "bulk_multi_b"), await makeLead(rep, "bulk_multi_c")];
  try {
    const result = await createNotesBulk(admin, {
      subjectType: "LEAD",
      subjectIds: leadIds,
      body: "<p>Same note everywhere</p>",
    });
    assert.equal(result.createdCount, 3);
    assert.equal(result.failures.length, 0);
    assert.deepEqual(
      result.notes.map((note) => note.subjectId).sort(),
      [...leadIds].sort(),
    );

    assert.equal(await prisma.note.count({ where: { subjectType: "LEAD", subjectId: { in: leadIds } } }), 3);
    assert.equal(
      await prisma.activityEvent.count({ where: { subjectType: "LEAD", subjectId: { in: leadIds }, kind: "note_added" } }),
      3,
      "one activity per record",
    );
    const notes = await prisma.note.findMany({ where: { subjectType: "LEAD", subjectId: { in: leadIds } }, select: { id: true } });
    assert.equal(
      await prisma.auditLog.count({ where: { objectType: "Note", objectId: { in: notes.map((n) => n.id) }, action: "NOTE_ADDED" } }),
      3,
      "one audit row per note",
    );
    assert.equal(
      await prisma.notification.count({
        where: { recipientUserId: rep.userId, type: "NOTE_ADDED", OR: leadIds.map((id) => ({ payload: { path: ["recordId"], equals: id } })) },
      }),
      3,
      "owner notified once per record",
    );
  } finally {
    await cleanupLeads(leadIds);
  }
});

test("an out-of-scope record mixed into the selection fails alone (partial success)", async () => {
  const rep = await repContext();
  const rep2 = await rep2Context(); // OWN scope — rep2's lead is invisible to rep
  const mine = [await makeLead(rep, "bulk_ok_a"), await makeLead(rep, "bulk_ok_b")];
  const foreign = await makeLead(rep2, "bulk_foreign");
  try {
    const result = await createNotesBulk(rep, {
      subjectType: "LEAD",
      subjectIds: [mine[0], foreign, mine[1]],
      body: "<p>Partial note</p>",
    });
    assert.equal(result.createdCount, 2, "the two in-scope records get notes");
    assert.equal(result.failures.length, 1);
    assert.equal(result.failures[0].subjectId, foreign);
    assert.equal(result.failures[0].status, 404, "out-of-scope reads as not-found, never a silent skip");

    assert.equal(await prisma.note.count({ where: { subjectType: "LEAD", subjectId: foreign } }), 0, "no note leaked onto the foreign lead");
    assert.equal(await prisma.note.count({ where: { subjectType: "LEAD", subjectId: { in: mine } } }), 2);
  } finally {
    await cleanupLeads([...mine, foreign]);
  }
});

test("duplicate subject ids collapse to a single note", async () => {
  const rep = await repContext();
  const leadId = await makeLead(rep, "bulk_dupe");
  try {
    const result = await createNotesBulk(rep, {
      subjectType: "LEAD",
      subjectIds: [leadId, leadId, leadId],
      body: "<p>Only once</p>",
    });
    assert.equal(result.requestedCount, 1, "ids are deduplicated");
    assert.equal(result.createdCount, 1);
    assert.equal(await prisma.note.count({ where: { subjectType: "LEAD", subjectId: leadId } }), 1);
  } finally {
    await cleanupLeads([leadId]);
  }
});
