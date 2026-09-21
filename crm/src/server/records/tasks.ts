import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/server/db";
import { CrmError, requireCapability } from "@/server/guard";
import { appendAudit } from "@/server/audit";
import { appendActivity } from "@/server/activity";
import { isNotificationSubjectType, notify, subjectNotificationContext } from "@/server/notifications";
import { resolveSubject, subjectPermission } from "@/server/records/subjects";

/**
 * Task visibility model (replaces the old owner-scope ladder for reads):
 *
 *   visible = owner ∪ explicitly tagged viewer users ∪ members of tagged
 *   viewer teams, plus — for ADMIN/SUPER_ADMIN only — everything.
 *
 * "Everyone" visibility exists ONLY for admins; managers/team leads no
 * longer see colleagues' tasks through scope alone — they must be tagged.
 */
export function canSeeAllTasks(ctx: ScopedContext): boolean {
  return ctx.roleKey === "SUPER_ADMIN" || ctx.roleKey === "ADMIN";
}

/** Where-fragment for READS (list, detail, commenting). */
export function taskVisibleWhere(ctx: ScopedContext): Prisma.TaskWhereInput {
  if (canSeeAllTasks(ctx)) return {};
  return {
    OR: [
      { ownerUserId: ctx.userId },
      { viewerUsers: { some: { userId: ctx.userId } } },
      ...(ctx.teamIds.length > 0
        ? [{ viewerTeams: { some: { teamId: { in: ctx.teamIds } } } }]
        : []),
    ],
  };
}

/** Where-fragment for EDITS: the owner or an admin — tagged viewers are
 *  view-only by design ("users that view the task, not as owners"). */
export function taskEditableWhere(ctx: ScopedContext): Prisma.TaskWhereInput {
  if (canSeeAllTasks(ctx)) return {};
  return { ownerUserId: ctx.userId };
}

import type { ScopedContext } from "@/server/records/leads";

/**
 * Task service. Tasks are personal follow-ups (owner-based visibility)
 * optionally linked to a record; subjects are scope-checked on every write.
 * Cancellation replaces deletion so history is preserved.
 */

export const CreateTask = z.object({
  title: z.string().trim().min(2).max(200),
  description: z.string().trim().max(5000).optional().nullable(),
  dueAt: z.coerce.date().optional().nullable(),
  priority: z.enum(["LOW", "NORMAL", "HIGH", "URGENT"]).default("NORMAL"),
  recurrence: z.enum(["NONE", "DAILY", "WEEKLY", "MONTHLY"]).default("NONE"),
  reminderAt: z.coerce.date().optional().nullable(),
  ownerUserId: z.string().trim().min(5).optional(),
  subjectType: z.enum(["LEAD", "CONTACT", "ACCOUNT", "CUSTOMER", "OPPORTUNITY"]).optional(),
  subjectId: z.string().trim().min(5).optional(),
  viewerUserIds: z.array(z.string().trim().min(5)).max(50).optional(),
  viewerTeamIds: z.array(z.string().trim().min(5)).max(50).optional(),
});

export const UpdateTask = z.object({
  title: z.string().trim().min(2).max(200).optional(),
  description: z.string().trim().max(5000).optional().nullable(),
  dueAt: z.coerce.date().optional().nullable(),
  priority: z.enum(["LOW", "NORMAL", "HIGH", "URGENT"]).optional(),
  recurrence: z.enum(["NONE", "DAILY", "WEEKLY", "MONTHLY"]).optional(),
  reminderAt: z.coerce.date().optional().nullable(),
  status: z.enum(["OPEN", "IN_PROGRESS", "COMPLETED", "CANCELLED"]).optional(),
  ownerUserId: z.string().trim().min(5).optional(),
  viewerUserIds: z.array(z.string().trim().min(5)).max(50).optional(),
  viewerTeamIds: z.array(z.string().trim().min(5)).max(50).optional(),
});

export const TaskFilters = z.object({
  q: z.string().trim().max(120).optional(),
  status: z.enum(["OPEN", "IN_PROGRESS", "COMPLETED", "CANCELLED"]).optional(),
  priority: z.enum(["LOW", "NORMAL", "HIGH", "URGENT"]).optional(),
  due: z.enum(["overdue", "today", "week", "upcoming", "all"]).default("all"),
  mine: z.enum(["0", "1"]).default("1"),
  subjectType: z.enum(["LEAD", "CONTACT", "ACCOUNT", "CUSTOMER", "OPPORTUNITY"]).optional(),
  subjectId: z.string().trim().min(5).optional(),
});

export async function listTasks(
  ctx: ScopedContext,
  query: { page: number; pageSize: number },
  filters: z.infer<typeof TaskFilters>,
) {
  const now = new Date();
  const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
  const weekAhead = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  // Visibility: owner ∪ tagged viewers (users/teams) — admins additionally
  // see everything via mine=0 ("Everyone"). For non-admins, mine=0 and
  // mine=1 return the same visible set (the UI hides "Everyone" for them).
  const visibility = taskVisibleWhere(ctx);
  const mineWhere: Prisma.TaskWhereInput = canSeeAllTasks(ctx) && filters.mine === "0"
    ? {}
    : visibility;

  const where: Prisma.TaskWhereInput = {
    ...mineWhere,
    ...(filters.status ? { status: filters.status } : { status: { in: ["OPEN", "IN_PROGRESS"] } }),
    ...(filters.priority ? { priority: filters.priority } : {}),
    ...(filters.q ? {
      OR: [
        { title: { contains: filters.q, mode: "insensitive" } },
        { description: { contains: filters.q, mode: "insensitive" } },
        { owner: { name: { contains: filters.q, mode: "insensitive" } } },
      ],
    } : {}),
    ...(filters.subjectType ? { subjectType: filters.subjectType } : {}),
    ...(filters.subjectId ? { subjectId: filters.subjectId } : {}),
    ...(filters.due === "overdue"
      ? { dueAt: { lt: now } }
      : filters.due === "today"
        ? { dueAt: { gte: now, lte: endOfToday } }
        : filters.due === "week"
          ? { dueAt: { lte: weekAhead } }
          : filters.due === "upcoming"
            ? { dueAt: { gte: now } }
            : {}),
  };

  const [total, rows, openCount, overdueCount] = await Promise.all([
    prisma.task.count({ where }),
    prisma.task.findMany({
      where,
      include: {
        owner: { select: { id: true, name: true } },
        viewerUsers: { include: { user: { select: { id: true, name: true } } } },
        viewerTeams: { include: { team: { select: { id: true, name: true } } } },
      },
      orderBy: [{ dueAt: "asc" }, { createdAt: "desc" }],
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
    }),
    prisma.task.count({ where: { ...where, status: "OPEN" } }),
    prisma.task.count({
      where: { ...where, status: { in: ["OPEN", "IN_PROGRESS"] }, dueAt: { lt: now } },
    }),
  ]);
  return { total, rows, openCount, overdueCount };
}

export async function createTask(ctx: ScopedContext, input: z.infer<typeof CreateTask>) {
  if (input.subjectType) requireCapability(ctx, subjectPermission(input.subjectType, "CREATE_TASK"));
  else requireCapability(ctx, "TASKS_CREATE");
  const subject = input.subjectType && input.subjectId
    ? await resolveSubject(ctx, input.subjectType, input.subjectId)
    : null;

  // Creating for someone else is a managerial action.
  const ownerUserId = input.ownerUserId ?? ctx.userId;
  if (ownerUserId !== ctx.userId && !ctx.permissions.includes("TASKS_ASSIGN")) {
    throw new CrmError("Forbidden — TASKS_ASSIGN permission required to assign tasks", 403);
  }

  const task = await prisma.$transaction(async (tx) => {
    const created = await tx.task.create({
      data: {
        title: input.title,
        description: input.description ?? null,
        dueAt: input.dueAt ?? null,
        priority: input.priority,
        recurrence: input.recurrence,
        reminderAt: input.reminderAt ?? null,
        ownerUserId,
        subjectType: subject?.type,
        subjectId: subject?.id,
      },
    });
    const viewerUserIds = [...new Set(input.viewerUserIds ?? [])].filter((id) => id !== ownerUserId);
    const viewerTeamIds = [...new Set(input.viewerTeamIds ?? [])];
    if (viewerUserIds.length > 0) {
      const users = await tx.user.count({ where: { id: { in: viewerUserIds }, status: "ACTIVE" } });
      if (users !== viewerUserIds.length) throw new CrmError("Unknown user in viewerUserIds.", 400);
      await tx.taskViewer.createMany({
        data: viewerUserIds.map((userId) => ({ taskId: created.id, userId })),
        skipDuplicates: true,
      });
    }
    if (viewerTeamIds.length > 0) {
      const teams = await tx.team.count({ where: { id: { in: viewerTeamIds } } });
      if (teams !== viewerTeamIds.length) throw new CrmError("Unknown team in viewerTeamIds.", 400);
      await tx.taskTeamViewer.createMany({
        data: viewerTeamIds.map((teamId) => ({ taskId: created.id, teamId })),
        skipDuplicates: true,
      });
    }
    if (subject) {
      await appendActivity(tx, {
        subjectType: subject.type,
        subjectId: subject.id,
        kind: "task_created",
        actorUserId: ctx.userId,
        payload: { taskId: created.id, title: created.title },
      });
    }
    await appendAudit(tx, {
      actorId: ctx.userId,
      ip: ctx.ip,
      action: "TASK_CREATED",
      objectType: "Task",
      objectId: created.id,
      after: { title: created.title, ownerUserId, subject: subject?.label },
    });
    return created;
  });

  if (ownerUserId !== ctx.userId) {
    await notify({
      recipientUserId: ownerUserId,
      type: "TASK_CREATED",
      payload: { taskId: task.id, title: task.title, byName: ctx.name, subject: subject?.label },
      context: subject
        ? subjectNotificationContext(subject.type, subject.id)
        : { href: `/tasks/${task.id}` },
    });
  }
  for (const viewerId of input.viewerUserIds ?? []) {
    if (viewerId === ownerUserId || viewerId === ctx.userId) continue;
    await notify({
      recipientUserId: viewerId,
      type: "TASK_CREATED",
      payload: { taskId: task.id, title: task.title, byName: ctx.name, shared: true },
      context: { href: `/tasks/${task.id}` },
    });
  }
  return task;
}

export const BulkTaskAction = z.object({
  action: z.enum(["complete", "cancel", "reopen"]),
  ids: z.array(z.string().trim().min(5)).min(1).max(500),
});

/** Bulk status changes on visible tasks — each row runs the full updateTask
 * path (permission, visibility, notifications) so bulk never bypasses the
 * single-row rules. Out-of-scope rows 404 and abort nothing before them. */
export async function bulkTasks(ctx: ScopedContext, input: z.infer<typeof BulkTaskAction>) {
  const statusByAction = { complete: "COMPLETED", cancel: "CANCELLED", reopen: "OPEN" } as const;
  let updated = 0;
  for (const id of input.ids) {
    await updateTask(ctx, id, { status: statusByAction[input.action] });
    updated += 1;
  }
  return { updated };
}

export async function updateTask(ctx: ScopedContext, id: string, input: z.infer<typeof UpdateTask>) {
  requireCapability(ctx, "TASKS_EDIT");
  // Editing stays with the owner or an admin. Tagged viewers are view-only
  // by design; team/hierarchy scope alone no longer grants task editing.
  const existing = await prisma.task.findFirst({ where: { id, ...taskEditableWhere(ctx) } });
  if (!existing) throw new CrmError("Task not found.", 404);
  // Viewer management is an owner/admin capability on top of TASKS_EDIT.
  const managesViewers = existing.ownerUserId === ctx.userId || canSeeAllTasks(ctx);
  if ((input.viewerUserIds !== undefined || input.viewerTeamIds !== undefined) && !managesViewers) {
    throw new CrmError("Forbidden — only the task owner or an admin may change task viewers", 403);
  }
  const existingViewers = await prisma.taskViewer.findMany({
    where: { taskId: id },
    select: { userId: true },
  });
  const previousViewerIds = new Set(existingViewers.map((row) => row.userId));

  if (
    input.ownerUserId !== undefined &&
    input.ownerUserId !== existing.ownerUserId &&
    !ctx.permissions.includes("TASKS_ASSIGN")
  ) {
    throw new CrmError("Forbidden — TASKS_ASSIGN permission required to reassign tasks", 403);
  }

  const updated = await prisma.$transaction(async (tx) => {
    const saved = await tx.task.update({
      where: { id },
      data: {
        ...(input.title !== undefined ? { title: input.title } : {}),
        ...(input.description !== undefined ? { description: input.description } : {}),
        ...(input.dueAt !== undefined ? { dueAt: input.dueAt } : {}),
        ...(input.priority !== undefined ? { priority: input.priority } : {}),
        ...(input.recurrence !== undefined ? { recurrence: input.recurrence } : {}),
        ...(input.reminderAt !== undefined ? { reminderAt: input.reminderAt } : {}),
        ...(input.reminderAt !== undefined ? { reminderNotifiedAt: null } : {}),
        ...(input.ownerUserId !== undefined ? { ownerUserId: input.ownerUserId } : {}),
        ...(input.status !== undefined
          ? { status: input.status, completedAt: input.status === "COMPLETED" ? new Date() : null }
          : {}),
      },
    });
    if (
      existing.subjectType === "LEAD" && existing.subjectId && input.status === "COMPLETED"
    ) {
      await tx.lead.update({ where: { id: existing.subjectId }, data: { lastContactAt: new Date() } });
    }
    if (
      existing.subjectType && existing.subjectId &&
      input.status && input.status !== existing.status
    ) {
      await appendActivity(tx, {
        subjectType: existing.subjectType,
        subjectId: existing.subjectId,
        kind: input.status === "COMPLETED" ? "task_completed" : "task_cancelled",
        actorUserId: ctx.userId,
        payload: { taskId: id, title: existing.title },
      });
    }
    if (input.status === "COMPLETED" && existing.status !== "COMPLETED" && existing.recurrence !== "NONE" && existing.dueAt) {
      const nextDueAt = new Date(existing.dueAt);
      if (existing.recurrence === "DAILY") nextDueAt.setDate(nextDueAt.getDate() + 1);
      if (existing.recurrence === "WEEKLY") nextDueAt.setDate(nextDueAt.getDate() + 7);
      if (existing.recurrence === "MONTHLY") nextDueAt.setMonth(nextDueAt.getMonth() + 1);
      const reminderOffset = existing.reminderAt ? existing.dueAt.getTime() - existing.reminderAt.getTime() : null;
      await tx.task.create({
        data: {
          title: existing.title,
          description: existing.description,
          ownerUserId: existing.ownerUserId,
          dueAt: nextDueAt,
          priority: existing.priority,
          recurrence: existing.recurrence,
          reminderAt: reminderOffset === null ? null : new Date(nextDueAt.getTime() - reminderOffset),
          subjectType: existing.subjectType,
          subjectId: existing.subjectId,
        },
      });
    }
    if (input.viewerUserIds !== undefined) {
      const nextUserIds = [...new Set(input.viewerUserIds)].filter((userId) => userId !== saved.ownerUserId);
      if (nextUserIds.length > 0) {
        const users = await tx.user.count({ where: { id: { in: nextUserIds }, status: "ACTIVE" } });
        if (users !== nextUserIds.length) throw new CrmError("Unknown user in viewerUserIds.", 400);
      }
      await tx.taskViewer.deleteMany({ where: { taskId: id } });
      if (nextUserIds.length > 0) {
        await tx.taskViewer.createMany({
          data: nextUserIds.map((userId) => ({ taskId: id, userId })),
          skipDuplicates: true,
        });
      }
    }
    if (input.viewerTeamIds !== undefined) {
      const nextTeamIds = [...new Set(input.viewerTeamIds)];
      if (nextTeamIds.length > 0) {
        const teams = await tx.team.count({ where: { id: { in: nextTeamIds } } });
        if (teams !== nextTeamIds.length) throw new CrmError("Unknown team in viewerTeamIds.", 400);
      }
      await tx.taskTeamViewer.deleteMany({ where: { taskId: id } });
      if (nextTeamIds.length > 0) {
        await tx.taskTeamViewer.createMany({
          data: nextTeamIds.map((teamId) => ({ taskId: id, teamId })),
          skipDuplicates: true,
        });
      }
    }
    await appendAudit(tx, {
      actorId: ctx.userId,
      ip: ctx.ip,
      action: "TASK_UPDATED",
      objectType: "Task",
      objectId: id,
      before: { status: existing.status, dueAt: existing.dueAt },
      after: { status: saved.status, dueAt: saved.dueAt, ...(input.viewerUserIds !== undefined || input.viewerTeamIds !== undefined ? { viewers: true } : {}) },
    });
    return saved;
  });

  // Notify newly tagged viewers (never the actor or the owner).
  if (input.viewerUserIds !== undefined) {
    for (const viewerId of input.viewerUserIds) {
      if (previousViewerIds.has(viewerId)) continue;
      if (viewerId === updated.ownerUserId || viewerId === ctx.userId) continue;
      await notify({
        recipientUserId: viewerId,
        type: "TASK_CREATED",
        payload: { taskId: updated.id, title: updated.title, byName: ctx.name, shared: true },
        context: { href: `/tasks/${updated.id}` },
      });
    }
  }

  if (input.ownerUserId !== undefined && input.ownerUserId !== existing.ownerUserId) {
    await notify({
      recipientUserId: input.ownerUserId,
      type: "TASK_CREATED",
      payload: { taskId: updated.id, title: updated.title, byName: ctx.name, reassigned: true },
      context: existing.subjectType && existing.subjectId && isNotificationSubjectType(existing.subjectType)
        ? subjectNotificationContext(existing.subjectType, existing.subjectId)
        : { href: `/tasks/${updated.id}` },
    });
  }
  return updated;
}

export interface TaskDetail {
  id: string;
  title: string;
  description: string | null;
  ownerUserId: string;
  owner: { id: string; name: string; email: string };
  dueAt: Date | null;
  priority: string;
  status: string;
  recurrence: string;
  reminderAt: Date | null;
  completedAt: Date | null;
  subjectType: string | null;
  subjectId: string | null;
  createdAt: Date;
  updatedAt: Date;
  viewerUsers: Array<{ user: { id: string; name: string } }>;
  viewerTeams: Array<{ team: { id: string; name: string } }>;
}

/** Fetch one task inside the actor's VISIBILITY (owner ∪ tagged viewers ∪
 *  admin) — 404 otherwise. */
export async function getTask(ctx: ScopedContext, id: string): Promise<TaskDetail> {
  const task = await prisma.task.findFirst({
    where: { id, ...taskVisibleWhere(ctx) },
    include: {
      owner: { select: { id: true, name: true, email: true } },
      viewerUsers: { include: { user: { select: { id: true, name: true } } } },
      viewerTeams: { include: { team: { select: { id: true, name: true } } } },
    },
  });
  if (!task) throw new CrmError("Task not found.", 404);
  return task;
}
