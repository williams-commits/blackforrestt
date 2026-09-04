import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/server/db";
import { appendAudit } from "@/server/audit";
import { appendActivity } from "@/server/activity";
import { resolveSubject } from "@/server/records/subjects";
import type { ScopedContext } from "@/server/records/leads";

/**
 * Notes are immutable — created and read, never edited or deleted. The
 * record timeline and audit trail preserve full context.
 */

export const CreateNote = z.object({
  body: z.string().trim().min(1).max(5000),
  subjectType: z.enum(["LEAD", "CONTACT", "ACCOUNT", "CUSTOMER", "OPPORTUNITY"]),
  subjectId: z.string().trim().min(5),
});

export async function createNote(ctx: ScopedContext, input: z.infer<typeof CreateNote>) {
  const subject = await resolveSubject(ctx, input.subjectType, input.subjectId);
  return prisma.$transaction(async (tx) => {
    const note = await tx.note.create({
      data: {
        body: input.body,
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
      payload: { noteId: note.id, excerpt: input.body.slice(0, 120) },
    });
    await appendAudit(tx, {
      actorId: ctx.userId,
      ip: ctx.ip,
      action: "NOTE_ADDED",
      objectType: "Note",
      objectId: note.id,
      after: { subject: subject.label, excerpt: input.body.slice(0, 120) },
    });
    return note;
  });
}

export function listNotesBySubject(
  subjectType: "LEAD" | "CONTACT" | "ACCOUNT" | "CUSTOMER" | "OPPORTUNITY",
  subjectId: string,
  take = 25,
) {
  return prisma.note.findMany({
    where: { subjectType, subjectId },
    orderBy: { createdAt: "desc" },
    take,
    include: { author: { select: { id: true, name: true } } },
  });
}

export type NoteRow = Prisma.NoteGetPayload<{ include: { author: { select: { id: true; name: true } } } }>;
