import test from "node:test";
import assert from "node:assert/strict";
import { prisma, repContext, rep2Context, viewerContext, managerContext, adminContext, makeLead, assertThrows } from "./helpers";
import { createNote, updateNote, listNotesBySubjectPage } from "../src/server/records/notes";
import { createAppointment, updateAppointment, listAppointmentsBySubjectPage } from "../src/server/records/appointments";

/**
 * Note + appointment edit coverage: authorization (author-or-NOTES_EDIT for
 * notes, APPOINTMENTS_EDIT + owner scope for appointments), subject-scope
 * enforcement, and the side effects every edit must produce (editedAt,
 * audit rows, timeline activity).
 */

test("author edits own note: body + editedAt + audit + timeline", async () => {
  const rep = await repContext();
  const leadId = await makeLead(rep, "note-edit-author");
  let noteId = "";

  try {
    const note = await createNote(rep, { body: "Original note body", subjectType: "LEAD", subjectId: leadId });
    noteId = note.id;

    const edited = await updateNote(rep, note.id, { body: "Original note body (fixed typos)" });
    assert.equal(edited.body, "Original note body (fixed typos)");
    assert.ok(edited.editedAt, "editedAt stamped");

    const audit = await prisma.auditLog.findFirst({ where: { objectType: "Note", objectId: note.id, action: "NOTE_UPDATED" } });
    assert.ok(audit, "NOTE_UPDATED audit row");
    const activity = await prisma.activityEvent.findFirst({ where: { subjectType: "LEAD", subjectId: leadId, kind: "note_updated" } });
    assert.ok(activity, "note_updated activity on the lead timeline");
  } finally {
    await prisma.note.deleteMany({ where: { id: noteId } }).catch(() => undefined);
    await prisma.lead.delete({ where: { id: leadId } }).catch(() => undefined);
  }
});

test("non-author without NOTES_EDIT is denied even when the subject is visible", async () => {
  const rep = await repContext();
  const manager = await managerContext();
  const viewer = await viewerContext();
  const leadId = await makeLead(rep, "note-edit-deny");
  let noteId = "";

  try {
    const note = await createNote(rep, { body: "Not for others to change", subjectType: "LEAD", subjectId: leadId });
    noteId = note.id;

    // Manager (HIERARCHY) sees the lead and holds role permissions — but the
    // NOTES_EDIT grant is stripped, so the author-or-manage check rejects.
    const withoutManage = { ...manager, permissions: manager.permissions.filter((permission) => permission !== "NOTES_EDIT") };
    await assertThrows(() => updateNote(withoutManage, note.id, { body: "hijack" }), 403, "visible user without NOTES_EDIT");
    // Viewer sees everything (ORG scope) but is neither author nor manager.
    await assertThrows(() => updateNote(viewer, note.id, { body: "hijack" }), 403, "viewer note edit");
  } finally {
    await prisma.note.deleteMany({ where: { id: noteId } }).catch(() => undefined);
    await prisma.lead.delete({ where: { id: leadId } }).catch(() => undefined);
  }
});

test("NOTES_EDIT holder edits someone else's note inside their scope", async () => {
  const rep = await repContext();
  const manager = await managerContext();
  assert.equal(manager.permissions.includes("NOTES_EDIT"), true, "manager role holds NOTES_EDIT");
  const leadId = await makeLead(rep, "note-edit-manager");
  let noteId = "";

  try {
    const note = await createNote(rep, { body: "Rep's original note", subjectType: "LEAD", subjectId: leadId });
    noteId = note.id;

    const edited = await updateNote(manager, note.id, { body: "Corrected by manager" });
    assert.equal(edited.body, "Corrected by manager");
    assert.ok(edited.editedAt, "editedAt stamped by manager edit");
  } finally {
    await prisma.note.deleteMany({ where: { id: noteId } }).catch(() => undefined);
    await prisma.lead.delete({ where: { id: leadId } }).catch(() => undefined);
  }
});

test("note edits follow the subject scope: another rep's note is invisible (404)", async () => {
  const rep = await repContext();
  const rep2 = await rep2Context();
  const leadId = await makeLead(rep, "note-edit-scope");
  let noteId = "";

  try {
    const note = await createNote(rep, { body: "Scope-protected note", subjectType: "LEAD", subjectId: leadId });
    noteId = note.id;
    await assertThrows(() => updateNote(rep2, note.id, { body: "should not land" }), 404, "OWN-scope rep on another rep's note");
  } finally {
    await prisma.note.deleteMany({ where: { id: noteId } }).catch(() => undefined);
    await prisma.lead.delete({ where: { id: leadId } }).catch(() => undefined);
  }
});

test("empty note bodies are rejected on edit", async () => {
  const rep = await repContext();
  const leadId = await makeLead(rep, "note-edit-empty");
  let noteId = "";

  try {
    const note = await createNote(rep, { body: "Real content", subjectType: "LEAD", subjectId: leadId });
    noteId = note.id;
    await assertThrows(() => updateNote(rep, note.id, { body: "   " }), 400, "empty note body");
    const unchanged = await prisma.note.findUniqueOrThrow({ where: { id: note.id } });
    assert.equal(unchanged.body, "Real content", "body untouched after failed edit");
    assert.equal(unchanged.editedAt, null, "editedAt untouched after failed edit");
  } finally {
    await prisma.note.deleteMany({ where: { id: noteId } }).catch(() => undefined);
    await prisma.lead.delete({ where: { id: leadId } }).catch(() => undefined);
  }
});

test("notes and schedule strips paginate with totals", async () => {
  const rep = await repContext();
  const leadId = await makeLead(rep, "strip-pagination");
  const noteIds: string[] = [];
  const apptIds: string[] = [];
  try {
    for (let i = 0; i < 12; i += 1) {
      const note = await createNote(rep, { body: `Strip note ${i}`, subjectType: "LEAD", subjectId: leadId });
      noteIds.push(note.id);
      const appointment = await createAppointment(rep, {
        title: `Strip meeting ${i}`,
        startAt: new Date(Date.now() + (i + 1) * 3_600_000),
        subjectType: "LEAD",
        subjectId: leadId,
      });
      apptIds.push(appointment.id);
      // Distinct createdAt stamps — a tight loop can tie and make the
      // newest-first page order unstable.
      await new Promise((resolve) => setTimeout(resolve, 5));
    }

    const notesP1 = await listNotesBySubjectPage("LEAD", leadId, 1, 8);
    assert.equal(notesP1.total, 12, "note total is unpaginated");
    assert.equal(notesP1.rows.length, 8, "page size respected");
    assert.equal(notesP1.rows[0]!.body, "Strip note 11", "newest first");
    const notesP2 = await listNotesBySubjectPage("LEAD", leadId, 2, 8);
    assert.equal(notesP2.rows.length, 4, "remainder page");

    const apptsP1 = await listAppointmentsBySubjectPage("LEAD", leadId, 1, 8);
    assert.equal(apptsP1.total, 12, "appointment total is unpaginated");
    assert.equal(apptsP1.rows.length, 8, "page size respected");
    assert.equal(apptsP1.rows[0]!.title, "Strip meeting 0", "soonest first");
    const apptsP2 = await listAppointmentsBySubjectPage("LEAD", leadId, 2, 8);
    assert.equal(apptsP2.rows.length, 4, "remainder page");
  } finally {
    await prisma.note.deleteMany({ where: { id: { in: noteIds } } }).catch(() => undefined);
    await prisma.appointment.deleteMany({ where: { id: { in: apptIds } } }).catch(() => undefined);
    await prisma.lead.delete({ where: { id: leadId } }).catch(() => undefined);
  }
});

test("appointment edit requires APPOINTMENTS_EDIT; editors stay in owner scope", async () => {
  const rep = await repContext();
  const admin = await adminContext();
  const rep2 = await rep2Context();
  const leadId = await makeLead(rep, "appt-edit");
  let appointmentId = "";

  try {
    const appointment = await createAppointment(rep, {
      title: "Original meeting",
      startAt: new Date(Date.now() + 3_600_000),
      subjectType: "LEAD",
      subjectId: leadId,
    });
    appointmentId = appointment.id;

    // Reps lack APPOINTMENTS_EDIT — their own appointment included.
    await assertThrows(
      () => updateAppointment(rep, appointment.id, { title: "Self-serve edit" }),
      403,
      "rep without APPOINTMENTS_EDIT",
    );
    // APPOINTMENTS_EDIT still cannot reach appointments outside the scope's
    // owner set: rep2 is OWN — even granted the permission, the rep-owned
    // appointment stays invisible.
    const rep2WithEdit = { ...rep2, permissions: [...rep2.permissions, "APPOINTMENTS_EDIT" as const] };
    await assertThrows(
      () => updateAppointment(rep2WithEdit, appointment.id, { title: "Out of scope edit" }),
      404,
      "OWN-scope editor on another owner's appointment",
    );

    const nextStart = new Date(Date.now() + 7_200_000);
    const saved = await updateAppointment(admin, appointment.id, { title: "Rescheduled meeting", startAt: nextStart });
    assert.equal(saved.title, "Rescheduled meeting");
    assert.equal(saved.startAt.getTime(), nextStart.getTime());

    const activity = await prisma.activityEvent.findFirst({
      where: { subjectType: "LEAD", subjectId: leadId, kind: "appointment_updated", payload: { path: ["appointmentId"], equals: appointment.id } },
    });
    assert.ok(activity, "appointment_updated activity on the lead timeline");
    const audit = await prisma.auditLog.findFirst({ where: { objectType: "Appointment", objectId: appointment.id, action: "APPOINTMENT_UPDATED" } });
    assert.ok(audit, "APPOINTMENT_UPDATED audit row");
    const before = audit?.before as { title?: string } | null;
    const after = audit?.after as { title?: string } | null;
    assert.equal(before?.title, "Original meeting", "audit before.title captured");
    assert.equal(after?.title, "Rescheduled meeting", "audit after.title captured");
  } finally {
    await prisma.appointment.deleteMany({ where: { id: appointmentId } }).catch(() => undefined);
    await prisma.lead.delete({ where: { id: leadId } }).catch(() => undefined);
  }
});
