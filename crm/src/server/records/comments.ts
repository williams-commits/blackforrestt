import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/server/db";
import { CrmError, requireCapability } from "@/server/guard";
import { appendAudit } from "@/server/audit";
import { appendActivity, type ActivityEntry } from "@/server/activity";
import { notify, isNotificationSubjectType, subjectNotificationContext } from "@/server/notifications";
import { visibleOwnerIds } from "@/server/scope";
import { getTask } from "@/server/records/tasks";
import type { ScopedContext } from "@/server/records/leads";

/**
 * Comment service — privileged-user comments on work items (tasks, notes,
 * appointments). Comments attach polymorphically like notes; visibility and
 * creation follow the PARENT object's scope:
 *
 *   TASK        → owner-based scope (same as the task service)
 *   NOTE        → its subject's scope (notes are always subject-attached)
 *   APPOINTMENT → subject scope when linked, owner scope when standalone
 *
 * Every write appends audit + activity (activity drives the SSE refresh, so
 * open views update live) and notifies the parent's interested party.
 */

/** Subject types a comment can attach to. */
export const COMMENT_SUBJECTS = ["TASK", "NOTE", "APPOINTMENT"] as const;
export type CommentSubject = (typeof COMMENT_SUBJECTS)[number];

export const CreateComment = z.object({
  body: z.string().trim().min(1).max(5000),
  subjectType: z.enum(COMMENT_SUBJECTS),
  subjectId: z.string().trim().min(5),
});

export const UpdateComment = z.object({
  body: z.string().trim().min(1).max(5000),
});

export interface CommentRow {
  id: string;
  body: string;
  createdAt: string;
  editedAt: string | null;
  author: { id: string; name: string };
}

/** Resolved parent: scope checked, with what the timeline/notification need. */
interface ResolvedParent {
  subjectType: CommentSubject;
  subjectId: string;
  /** Timeline target — the parent itself for tasks, the note's record for
   *  note comments, the appointment's subject (or the appointment itself
   *  when standalone). */
  timeline: Pick<ActivityEntry, "subjectType" | "subjectId">;
  /** Party to notify about a new comment (never the actor). */
  notifyUserId: string | null;
  /** Deep-link for the notification. */
  href: string;
  /** Human label of the commented item (notification/timeline payloads). */
  label: string;
}

const subjectHref = (subjectType: string, subjectId: string): string | null =>
  isNotificationSubjectType(subjectType) ? `${subjectNotificationContext(subjectType, subjectId).href}` : null;

/** Load + scope-check the parent work item a comment attaches to. */
async function resolveParent(ctx: ScopedContext, subjectType: CommentSubject, subjectId: string): Promise<ResolvedParent> {
  if (subjectType === "TASK") {
    // getTask enforces the owner-based scope (404 out of scope).
    const task = await getTask(ctx, subjectId);
    return {
      subjectType,
      subjectId,
      timeline: { subjectType: "TASK", subjectId },
      notifyUserId: task.ownerUserId !== ctx.userId ? task.ownerUserId : null,
      href: task.subjectType && task.subjectId && subjectHref(task.subjectType, task.subjectId)
        ? subjectHref(task.subjectType, task.subjectId)!
        : `/tasks/${task.id}`,
      label: task.title,
    };
  }

  if (subjectType === "NOTE") {
    const note = await prisma.note.findUnique({
      where: { id: subjectId },
      include: { author: { select: { id: true, name: true } } },
    });
    if (!note) throw new CrmError("Note not found.", 404);
    // Scope = the note's subject (resolveSubject 404s out of scope).
    const { resolveSubject } = await import("@/server/records/subjects");
    const subject = await resolveSubject(ctx, note.subjectType, note.subjectId);
    return {
      subjectType,
      subjectId,
      timeline: { subjectType: subject.type, subjectId: subject.id },
      notifyUserId: note.authorUserId !== ctx.userId ? note.authorUserId : null,
      href: subjectHref(subject.type, subject.id) ?? "/",
      label: `note by ${note.author.name}`,
    };
  }

  // APPOINTMENT
  const appointment = await prisma.appointment.findUnique({ where: { id: subjectId } });
  if (!appointment) throw new CrmError("Appointment not found.", 404);
  if (appointment.subjectType && appointment.subjectId) {
    const { resolveSubject } = await import("@/server/records/subjects");
    const subject = await resolveSubject(ctx, appointment.subjectType, appointment.subjectId);
    return {
      subjectType,
      subjectId,
      timeline: { subjectType: subject.type, subjectId: subject.id },
      notifyUserId: appointment.ownerUserId !== ctx.userId ? appointment.ownerUserId : null,
      href: subjectHref(subject.type, subject.id) ?? "/",
      label: appointment.title,
    };
  }
  // Standalone appointment: owner-based scope, timeline on the appointment.
  const ownerIds = await visibleOwnerIds(ctx);
  if (ownerIds && !ownerIds.includes(appointment.ownerUserId)) {
    throw new CrmError("Appointment not found.", 404);
  }
  return {
    subjectType,
    subjectId,
    timeline: { subjectType: "APPOINTMENT", subjectId: appointment.id },
    notifyUserId: appointment.ownerUserId !== ctx.userId ? appointment.ownerUserId : null,
    href: "/tasks",
    label: appointment.title,
  };
}

const toRow = (comment: Prisma.CommentGetPayload<{ include: { author: { select: { id: true; name: true } } } }>): CommentRow => ({
  id: comment.id,
  body: comment.body,
  createdAt: comment.createdAt.toISOString(),
  editedAt: comment.editedAt?.toISOString() ?? null,
  author: { id: comment.author.id, name: comment.author.name },
});

/** List a work item's comments (parent scope-checked), oldest first. */
export async function listComments(
  ctx: ScopedContext,
  subjectType: CommentSubject,
  subjectId: string,
  take = 100,
): Promise<CommentRow[]> {
  await resolveParent(ctx, subjectType, subjectId);
  const rows = await prisma.comment.findMany({
    where: { subjectType, subjectId },
    orderBy: { createdAt: "asc" },
    take: Math.min(take, 200),
    include: { author: { select: { id: true, name: true } } },
  });
  return rows.map(toRow);
}

/** Post a comment (COMMENTS_CREATE + parent in scope). */
export async function createComment(ctx: ScopedContext, input: z.infer<typeof CreateComment>): Promise<CommentRow> {
  requireCapability(ctx, "COMMENTS_CREATE");
  const parent = await resolveParent(ctx, input.subjectType, input.subjectId);
  const excerpt = input.body.length > 80 ? `${input.body.slice(0, 77)}…` : input.body;

  const comment = await prisma.$transaction(async (tx) => {
    const created = await tx.comment.create({
      data: {
        body: input.body,
        authorUserId: ctx.userId,
        subjectType: input.subjectType,
        subjectId: input.subjectId,
      },
      include: { author: { select: { id: true, name: true } } },
    });
    await appendActivity(tx, {
      subjectType: parent.timeline.subjectType,
      subjectId: parent.timeline.subjectId,
      kind: "comment",
      actorUserId: ctx.userId,
      payload: { comment: excerpt, on: parent.label, [`${input.subjectType.toLowerCase()}Id`]: input.subjectId },
    });
    await appendAudit(tx, {
      actorId: ctx.userId,
      ip: ctx.ip,
      action: "COMMENT_CREATED",
      objectType: "Comment",
      objectId: created.id,
      after: { body: input.body, subjectType: input.subjectType, subjectId: input.subjectId },
    });
    return created;
  });

  if (parent.notifyUserId) {
    await notify({
      recipientUserId: parent.notifyUserId,
      type: "COMMENT_ADDED",
      payload: { commentId: comment.id, byName: ctx.name, on: parent.label, comment: excerpt },
      context: { href: parent.href },
    });
  }
  return toRow(comment);
}

async function loadOwnedComment(ctx: ScopedContext, id: string) {
  const comment = await prisma.comment.findUnique({ where: { id } });
  if (!comment) throw new CrmError("Comment not found.", 404);
  const mayManage = ctx.permissions.includes("COMMENTS_MANAGE");
  if (comment.authorUserId !== ctx.userId && !mayManage) {
    throw new CrmError("Forbidden — only the author or COMMENTS_MANAGE may modify a comment", 403);
  }
  return comment;
}

/** Edit a comment (author or COMMENTS_MANAGE); marks editedAt. */
export async function updateComment(ctx: ScopedContext, id: string, input: z.infer<typeof UpdateComment>): Promise<CommentRow> {
  await loadOwnedComment(ctx, id);
  const updated = await prisma.$transaction(async (tx) => {
    const saved = await tx.comment.update({
      where: { id },
      data: { body: input.body, editedAt: new Date() },
      include: { author: { select: { id: true, name: true } } },
    });
    await appendAudit(tx, {
      actorId: ctx.userId,
      ip: ctx.ip,
      action: "COMMENT_UPDATED",
      objectType: "Comment",
      objectId: id,
      after: { body: input.body },
    });
    return saved;
  });
  return toRow(updated);
}

/** Delete a comment (author or COMMENTS_MANAGE). History lives in audit. */
export async function deleteComment(ctx: ScopedContext, id: string): Promise<void> {
  const existing = await loadOwnedComment(ctx, id);
  await prisma.$transaction(async (tx) => {
    await tx.comment.delete({ where: { id } });
    await appendAudit(tx, {
      actorId: ctx.userId,
      ip: ctx.ip,
      action: "COMMENT_DELETED",
      objectType: "Comment",
      objectId: id,
      before: { body: existing.body, subjectType: existing.subjectType, subjectId: existing.subjectId },
    });
  });
}
