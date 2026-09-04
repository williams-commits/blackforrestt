import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/server/db";
import { CrmError } from "@/server/guard";
import { appendAudit } from "@/server/audit";
import { appendActivity } from "@/server/activity";
import { notify } from "@/server/notifications";
import { resolveSubject } from "@/server/records/subjects";
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
  ownerUserId: z.string().trim().min(5).optional(),
  subjectType: z.enum(["LEAD", "CONTACT", "ACCOUNT", "CUSTOMER", "OPPORTUNITY"]).optional(),
  subjectId: z.string().trim().min(5).optional(),
});

export const UpdateTask = z.object({
  title: z.string().trim().min(2).max(200).optional(),
  description: z.string().trim().max(5000).optional().nullable(),
  dueAt: z.coerce.date().optional().nullable(),
  priority: z.enum(["LOW", "NORMAL", "HIGH", "URGENT"]).optional(),
  status: z.enum(["OPEN", "IN_PROGRESS", "COMPLETED", "CANCELLED"]).optional(),
  ownerUserId: z.string().trim().min(5).optional(),
});

/** Owner-visible user set for the actor's scope: self + members of visible teams. */
async function visibleOwnerIds(ctx: ScopedContext): Promise<string[] | null> {
  if (ctx.scope === "ORG") return null; // no filter
  if (ctx.scope === "OWN") return [ctx.userId];
  if (ctx.teamIds.length === 0) return [ctx.userId];
  const memberships = await prisma.teamMembership.findMany({
    where: { teamId: { in: ctx.teamIds } },
    select: { userId: true },
  });
  return [...new Set([ctx.userId, ...memberships.map((m) => m.userId)])];
}

export const TaskFilters = z.object({
  status: z.enum(["OPEN", "IN_PROGRESS", "COMPLETED", "CANCELLED"]).optional(),
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
  const ownerIds = await visibleOwnerIds(ctx);
  const now = new Date();
  const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
  const weekAhead = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  const where: Prisma.TaskWhereInput = {
    ...(ownerIds ? { ownerUserId: { in: ownerIds } } : {}),
    ...(filters.status ? { status: filters.status } : { status: { in: ["OPEN", "IN_PROGRESS"] } }),
    ...(filters.mine === "1" ? { ownerUserId: ctx.userId } : {}),
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
      include: { owner: { select: { id: true, name: true } } },
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
  const subject = input.subjectType && input.subjectId
    ? await resolveSubject(ctx, input.subjectType, input.subjectId)
    : null;

  // Creating for someone else is a managerial action.
  const ownerUserId = input.ownerUserId ?? ctx.userId;
  if (ownerUserId !== ctx.userId && !ctx.permissions.includes("TASKS_EDIT")) {
    throw new CrmError("Forbidden — TASKS_EDIT permission required to assign tasks", 403);
  }

  const task = await prisma.$transaction(async (tx) => {
    const created = await tx.task.create({
      data: {
        title: input.title,
        description: input.description ?? null,
        dueAt: input.dueAt ?? null,
        priority: input.priority,
        ownerUserId,
        subjectType: subject?.type,
        subjectId: subject?.id,
      },
    });
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
    });
  }
  return task;
}

export async function updateTask(ctx: ScopedContext, id: string, input: z.infer<typeof UpdateTask>) {
  const ownerIds = await visibleOwnerIds(ctx);
  const existing = await prisma.task.findFirst({
    where: { id, ...(ownerIds ? { ownerUserId: { in: ownerIds } } : {}) },
  });
  if (!existing) throw new CrmError("Task not found.", 404);

  if (
    input.ownerUserId !== undefined &&
    input.ownerUserId !== existing.ownerUserId &&
    !ctx.permissions.includes("TASKS_EDIT")
  ) {
    throw new CrmError("Forbidden — TASKS_EDIT permission required to reassign tasks", 403);
  }

  const updated = await prisma.$transaction(async (tx) => {
    const saved = await tx.task.update({
      where: { id },
      data: {
        ...(input.title !== undefined ? { title: input.title } : {}),
        ...(input.description !== undefined ? { description: input.description } : {}),
        ...(input.dueAt !== undefined ? { dueAt: input.dueAt } : {}),
        ...(input.priority !== undefined ? { priority: input.priority } : {}),
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
    await appendAudit(tx, {
      actorId: ctx.userId,
      ip: ctx.ip,
      action: "TASK_UPDATED",
      objectType: "Task",
      objectId: id,
      before: { status: existing.status, dueAt: existing.dueAt },
      after: { status: saved.status, dueAt: saved.dueAt },
    });
    return saved;
  });

  if (input.ownerUserId !== undefined && input.ownerUserId !== existing.ownerUserId) {
    await notify({
      recipientUserId: input.ownerUserId,
      type: "TASK_CREATED",
      payload: { taskId: updated.id, title: updated.title, byName: ctx.name, reassigned: true },
    });
  }
  return updated;
}
