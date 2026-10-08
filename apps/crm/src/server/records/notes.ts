import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/server/db";
import { appendAudit } from "@/server/audit";
import { appendActivity } from "@/server/activity";
import { CrmError, requireCapability } from "@/server/guard";
import { notify, subjectNotificationContext } from "@/server/notifications";
import { resolveSubject, subjectPermission } from "@/server/records/subjects";
import { sanitizeEmailHtml, htmlToText } from "@/server/emailHtml";
import { ACTIVITY_STRIP_PAGE_SIZE } from "@/lib/activityStrip";
import type { ScopedContext } from "@/server/records/leads";

/**
 * Notes: created, read, and editable in place (author or NOTES_EDIT —
 * the same author-or-manage model as comments). Deletes stay impossible;
 * the record timeline and audit trail preserve full context.
 *
 * Bodies are rich text from the shared editor: sanitized with the same
 * server allowlist as email HTML before storing, with length limits
 * enforced on the plain-text projection (so formatting tags never count
 * toward the budget and empty-but-formatted bodies are rejected).
 */

export const NOTE_MAX_PLAIN = 5000;

export const CreateNote = z.object({
  body: z.string().trim().min(1).max(20_000),
  subjectType: z.enum(["LEAD", "CONTACT", "ACCOUNT", "CUSTOMER", "OPPORTUNITY"]),
  subjectId: z.string().trim().min(5),
});

export const UpdateNote = z.object({
  body: z.string().trim().min(1).max(20_000),
});

/** Reject empty/oversized bodies and return the store-ready sanitized HTML. */
function preparedBody(body: string): string {
  const plain = htmlToText(body);
  if (plain.length < 1) throw new CrmError("Note is empty.", 400);
  if (plain.length > NOTE_MAX_PLAIN) throw new CrmError(`Note is too long — keep it under ${NOTE_MAX_PLAIN.toLocaleString()} characters.`, 400);
  return sanitizeEmailHtml(body);
}

export async function createNote(ctx: ScopedContext, input: z.infer<typeof CreateNote>) {
  requireCapability(ctx, subjectPermission(input.subjectType, "ADD_NOTE"));
  const body = preparedBody(input.body);
  const plain = htmlToText(input.body);
  const subject = await resolveSubject(ctx, input.subjectType, input.subjectId);
  return writeNoteForSubject(ctx, subject, body, plain);
}

/**
 * The per-record write shared by single and bulk note creation: the
 * transaction (note + lead lastContactAt + activity + audit) and the
 * owner notification. Callers have already checked the ADD_NOTE
 * capability, sanitized the body, and resolved the subject through the
 * scope-enforcing service.
 */
async function writeNoteForSubject(
  ctx: ScopedContext,
  subject: { type: "LEAD" | "CONTACT" | "ACCOUNT" | "CUSTOMER" | "OPPORTUNITY"; id: string; label: string },
  body: string,
  plain: string,
) {
  const note = await prisma.$transaction(async (tx) => {
    const note = await tx.note.create({
      data: {
        body,
        authorUserId: ctx.userId,
        subjectType: subject.type,
        subjectId: subject.id,
      },
    });
    if (subject.type === "LEAD") {
      await tx.lead.update({ where: { id: subject.id }, data: { lastContactAt: new Date() } });
    }
    await appendActivity(tx, {
      subjectType: subject.type,
      subjectId: subject.id,
      kind: "note_added",
      actorUserId: ctx.userId,
      payload: { noteId: note.id, excerpt: plain.slice(0, 120) },
    });
    await appendAudit(tx, {
      actorId: ctx.userId,
      ip: ctx.ip,
      action: "NOTE_ADDED",
      objectType: "Note",
      objectId: note.id,
      after: { subject: subject.label, excerpt: plain.slice(0, 120) },
    });
    return note;
  });
  // Notes reach the record's owner (unless they wrote it) — context the
  // owner would otherwise miss until their next visit.
  const owner = await ownerOfSubject(subject.type, subject.id);
  if (owner && owner !== ctx.userId) {
    await notify({
      recipientUserId: owner,
      type: "NOTE_ADDED",
      payload: {
        recordType: subject.type,
        recordId: subject.id,
        label: subject.label,
        excerpt: plain.slice(0, 120),
        byName: ctx.name,
      },
      context: subjectNotificationContext(subject.type, subject.id),
    });
  }
  return note;
}

export const BulkCreateNotes = z.object({
  body: z.string().trim().min(1).max(20_000),
  subjectType: z.enum(["LEAD", "CONTACT", "ACCOUNT", "CUSTOMER", "OPPORTUNITY"]),
  subjectIds: z.array(z.string().trim().min(5)).min(1).max(500),
});

export interface BulkNoteFailure {
  subjectId: string;
  message: string;
  status: number;
}

export interface BulkNotesResult {
  requestedCount: number;
  createdCount: number;
  notes: Array<{ id: string; subjectId: string }>;
  failures: BulkNoteFailure[];
}

/**
 * Bulk note creation: the same body on many records of one subject type.
 * Reuses the single-note pipeline record by record — capability is checked
 * once up front and the body is sanitized once; each record still resolves
 * through its scope-enforcing service (an out-of-scope record fails that
 * record, it never silently skips) and each note carries its own activity,
 * audit, and owner-notification side effects. Records are written in
 * independent transactions so one failure cannot roll back the others;
 * callers get explicit created/failed counts.
 */
export async function createNotesBulk(
  ctx: ScopedContext,
  input: z.infer<typeof BulkCreateNotes>,
): Promise<BulkNotesResult> {
  requireCapability(ctx, subjectPermission(input.subjectType, "ADD_NOTE"));
  const body = preparedBody(input.body);
  const plain = htmlToText(input.body);
  const uniqueIds = [...new Set(input.subjectIds)];

  const notes: BulkNotesResult["notes"] = [];
  const failures: BulkNoteFailure[] = [];
  for (const subjectId of uniqueIds) {
    try {
      const subject = await resolveSubject(ctx, input.subjectType, subjectId);
      const note = await writeNoteForSubject(ctx, subject, body, plain);
      notes.push({ id: note.id, subjectId });
    } catch (error) {
      failures.push({
        subjectId,
        message: error instanceof CrmError ? error.message : "Could not add note.",
        status: error instanceof CrmError ? error.status : 500,
      });
    }
  }
  return { requestedCount: uniqueIds.length, createdCount: notes.length, notes, failures };
}

/**
 * Edit a note in place. Authorization mirrors comments: the AUTHOR may fix
 * their own note, NOTES_EDIT holders may edit anyone's. The subject scope is
 * resolved FIRST, so neither can touch a note on a record they can no
 * longer see. Every edit stamps editedAt and writes audit + timeline.
 */
export async function updateNote(ctx: ScopedContext, id: string, input: z.infer<typeof UpdateNote>) {
  const existing = await prisma.note.findUnique({ where: { id } });
  if (!existing) throw new CrmError("Note not found.", 404);
  const recordSubjects: readonly string[] = ["LEAD", "CONTACT", "ACCOUNT", "CUSTOMER", "OPPORTUNITY"];
  if (!recordSubjects.includes(existing.subjectType)) {
    throw new CrmError("Note has an unsupported subject.", 400);
  }
  const subject = await resolveSubject(ctx, existing.subjectType, existing.subjectId);
  if (existing.authorUserId !== ctx.userId && !ctx.permissions.includes("NOTES_EDIT")) {
    throw new CrmError("Forbidden — only the author or NOTES_EDIT may edit a note", 403);
  }
  const body = preparedBody(input.body);
  const excerpt = htmlToText(input.body).slice(0, 120);

  return prisma.$transaction(async (tx) => {
    const saved = await tx.note.update({
      where: { id },
      data: { body, editedAt: new Date() },
      include: { author: { select: { id: true, name: true } } },
    });
    await appendActivity(tx, {
      subjectType: subject.type,
      subjectId: subject.id,
      kind: "note_updated",
      actorUserId: ctx.userId,
      payload: { noteId: id, excerpt },
    });
    await appendAudit(tx, {
      actorId: ctx.userId,
      ip: ctx.ip,
      action: "NOTE_UPDATED",
      objectType: "Note",
      objectId: id,
      after: { subject: subject.label, excerpt },
    });
    return saved;
  });
}

/** The user who owns a subject record (assignee/owner), when there is one. */
async function ownerOfSubject(
  subjectType: "LEAD" | "CONTACT" | "ACCOUNT" | "CUSTOMER" | "OPPORTUNITY",
  subjectId: string,
): Promise<string | null> {
  if (subjectType === "LEAD") {
    const row = await prisma.lead.findUnique({ where: { id: subjectId }, select: { assignedUserId: true } });
    return row?.assignedUserId ?? null;
  }
  if (subjectType === "OPPORTUNITY") {
    const row = await prisma.opportunity.findUnique({ where: { id: subjectId }, select: { ownerUserId: true } });
    return row?.ownerUserId ?? null;
  }
  if (subjectType === "CONTACT") {
    const row = await prisma.contact.findUnique({ where: { id: subjectId }, select: { ownerUserId: true } });
    return row?.ownerUserId ?? null;
  }
  if (subjectType === "CUSTOMER") {
    const row = await prisma.customer.findUnique({ where: { id: subjectId }, select: { ownerUserId: true } });
    return row?.ownerUserId ?? null;
  }
  const row = await prisma.account.findUnique({ where: { id: subjectId }, select: { ownerUserId: true } });
  return row?.ownerUserId ?? null;
}

export function listNotesBySubject(
  subjectType: "LEAD" | "CONTACT" | "ACCOUNT" | "CUSTOMER" | "OPPORTUNITY",
  subjectId: string,
  take = ACTIVITY_STRIP_PAGE_SIZE,
) {
  return prisma.note.findMany({
    where: { subjectType, subjectId },
    orderBy: { createdAt: "desc" },
    take,
    include: { author: { select: { id: true, name: true } } },
  });
}

/** Paginated notes for the record-page strip ("Load more"): newest first,
 *  with the unpaginated total so the UI can show "Showing X of Y". Scope is
 *  the caller's job — the route resolves the subject through the scoped
 *  service before calling this. */
export async function listNotesBySubjectPage(
  subjectType: "LEAD" | "CONTACT" | "ACCOUNT" | "CUSTOMER" | "OPPORTUNITY",
  subjectId: string,
  page: number,
  pageSize: number,
): Promise<{ rows: NoteRow[]; total: number }> {
  const [rows, total] = await Promise.all([
    prisma.note.findMany({
      where: { subjectType, subjectId },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: { author: { select: { id: true, name: true } } },
    }),
    prisma.note.count({ where: { subjectType, subjectId } }),
  ]);
  return { rows, total };
}

export type NoteRow = Prisma.NoteGetPayload<{ include: { author: { select: { id: true; name: true } } } }>;
