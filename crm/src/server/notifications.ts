import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/server/db";
import { logger } from "@/server/observability";
import { sendEmail } from "@/server/email";

/**
 * Notification system: in-app rows PLUS an email channel when SMTP is
 * configured (spec §28: "architect so additional channels can later be
 * added" — email is the first adapter; SMS/push follow the same pattern).
 *
 * Overdue tasks and callback reminders are DERIVED at read time and fired
 * lazily by `sweepOverdueTasks()` — no cron needed for a single-container
 * deployment.
 */

export type NotifiableType =
  | "RECORD_ASSIGNED"
  | "TASK_CREATED"
  | "APPOINTMENT_SCHEDULED"
  | "IMPORT_COMPLETED"
  | "IMPORT_FAILED"
  | "PLATFORM_USER_ONLINE"
  | "TASK_DUE"
  | "TASK_OVERDUE";

export const NotificationQuery = z.object({
  read: z.enum(["all", "unread", "read"]).default("all"),
  type: z.string().trim().max(60).optional(),
  page: z.coerce.number().int().min(1).max(100).default(1),
  pageSize: z.coerce.number().int().min(10).max(100).default(25),
});

export type NotificationSubjectType = "LEAD" | "CONTACT" | "ACCOUNT" | "CUSTOMER" | "OPPORTUNITY";

/** A safe, internal CRM destination carried by every new notification. */
export interface NotificationContext {
  href: string;
  subjectType?: NotificationSubjectType;
  subjectId?: string;
}

const SUBJECT_PATHS: Record<NotificationSubjectType, string> = {
  LEAD: "/leads",
  CONTACT: "/contacts",
  ACCOUNT: "/accounts",
  CUSTOMER: "/customers",
  OPPORTUNITY: "/opportunities",
};

export function isNotificationSubjectType(value: string): value is NotificationSubjectType {
  return value in SUBJECT_PATHS;
}

export function subjectNotificationContext(subjectType: NotificationSubjectType, subjectId: string): NotificationContext {
  return { href: `${SUBJECT_PATHS[subjectType]}/${subjectId}`, subjectType, subjectId };
}

export function collectionNotificationContext(subjectType: NotificationSubjectType): NotificationContext {
  return { href: SUBJECT_PATHS[subjectType], subjectType };
}

interface NotifyInput {
  recipientUserId: string;
  type: NotifiableType;
  payload: Record<string, unknown>;
  context: NotificationContext;
}

/** Map a notification to an email subject/body; null = email not wanted. */
function emailFor(type: NotifiableType, payload: Record<string, unknown>): { subject: string; text: string } | null {
  switch (type) {
    case "RECORD_ASSIGNED":
      return {
        subject: `CRM: ${payload.reassigned ? "Reassigned" : "New assignment"} — ${payload.label ?? payload.recordType ?? "record"}`,
        text: `${payload.byName ?? "Someone"} assigned you ${payload.label ?? payload.recordType ?? "a record"}${payload.count ? ` (${payload.count} records)` : ""}. Open the CRM to review.`,
      };
    case "TASK_CREATED":
      return {
        subject: `CRM: New task — ${payload.title ?? "untitled"}`,
        text: `${payload.byName ?? "Someone"} created a task for you: "${payload.title}".${payload.reassigned ? " (reassigned)" : ""}`,
      };
    case "TASK_OVERDUE":
      return {
        subject: `CRM: Overdue task — ${payload.title ?? "untitled"}`,
        text: `Your task "${payload.title}" was due ${payload.dueAt ?? "earlier"} and is still open.`,
      };
    case "TASK_DUE":
      return {
        subject: `CRM: Task due today — ${payload.title ?? "untitled"}`,
        text: `Your task "${payload.title}" is due today.`,
      };
    case "APPOINTMENT_SCHEDULED":
      return {
        subject: `CRM: Appointment — ${payload.title ?? "untitled"}`,
        text: `${payload.byName ?? "Someone"} scheduled "${payload.title}" for you.`,
      };
    case "IMPORT_COMPLETED":
      return {
        subject: `CRM: Import completed — ${payload.created ?? 0} created, ${payload.updated ?? 0} updated`,
        text: `Your import finished: ${payload.created ?? 0} created, ${payload.updated ?? 0} updated, ${payload.skipped ?? 0} skipped, ${payload.duplicates ?? 0} duplicates, ${payload.errors ?? 0} errors.`,
      };
    case "IMPORT_FAILED":
      return {
        subject: `CRM: Import FAILED`,
        text: `Your import job failed. Open the CRM to download the error report.`,
      };
    case "PLATFORM_USER_ONLINE":
      return {
        subject: `CRM: Client is online — ${payload.label ?? "linked customer"}`,
        text: `${payload.label ?? "A client assigned to you"} is currently logged into the trading platform. Open the customer record to review live account activity.`,
      };
    default:
      return null;
  }
}

/** Fire in-app + email channels. In-app is fire-and-forget; email same. */
export async function notify(input: NotifyInput): Promise<void> {
  // In-app row (must never fail the parent action).
  try {
    await prisma.notification.create({
      data: {
        recipientUserId: input.recipientUserId,
        type: input.type,
        payload: { ...input.payload, context: input.context } as unknown as Prisma.InputJsonValue,
      },
    });
  } catch (error) {
    logger.error("notification_create_failed", { error: String(error), ...input });
  }

  // Email channel (skipped when SMTP not configured).
  const email = emailFor(input.type, input.payload);
  if (email) {
    const user = await prisma.user.findUnique({
      where: { id: input.recipientUserId },
      select: { email: true },
    }).catch(() => null);
    if (user?.email) {
      void sendEmail({ to: user.email, subject: email.subject, text: email.text }).catch(() => undefined);
    }
  }
}

/**
 * Lazy overdue/due-today sweep — call on notification reads. Idempotent:
 * a TASK_OVERDUE notification carries the taskId + date in its payload; we
 * check for an existing one before creating a duplicate. overdueNotifiedAt
 * on the Task row is the durable marker.
 */
export async function sweepOverdueTasks(userId: string): Promise<void> {
  const now = new Date();
  const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);

  const stale = await prisma.task.findMany({
    where: {
      ownerUserId: userId,
      status: { in: ["OPEN", "IN_PROGRESS"] },
      dueAt: { not: null, lte: endOfToday },
      overdueNotifiedAt: null,
    },
    take: 50,
  });
  if (stale.length === 0) return;

  for (const task of stale) {
    const isOverdue = task.dueAt! < now;
    await notify({
      recipientUserId: userId,
      type: isOverdue ? "TASK_OVERDUE" : "TASK_DUE",
      payload: {
        taskId: task.id,
        title: task.title,
        dueAt: task.dueAt!.toISOString(),
      },
      context: task.subjectType && task.subjectId && isNotificationSubjectType(task.subjectType)
        ? subjectNotificationContext(task.subjectType, task.subjectId)
        : { href: "/tasks" },
    });
    await prisma.task.update({
      where: { id: task.id },
      data: { overdueNotifiedAt: now },
    }).catch(() => undefined);
  }
}

/**
 * Lazy presence sweep for linked customers owned by the current CRM user.
 * The recent-notification window makes this transition-safe without adding a
 * polling worker or persisting platform presence in the CRM database.
 */
export async function sweepPlatformPresence(userId: string): Promise<void> {
  const { platformPresence } = await import("@/server/platformBridge");
  const customers = await prisma.customer.findMany({
    where: { ownerUserId: userId, deletedAt: null, platformUserId: { not: null } },
    select: { id: true, firstName: true, lastName: true, platformUserId: true },
    take: 100,
  });
  if (customers.length === 0) return;
  const states = await platformPresence(customers.map((customer) => customer.platformUserId!));
  if (states.length === 0) return;
  const since = new Date(Date.now() - 10 * 60 * 1000);
  const recent = await prisma.notification.findMany({
    where: { recipientUserId: userId, type: "PLATFORM_USER_ONLINE", createdAt: { gte: since } },
    select: { payload: true },
  });
  const alreadyNotified = new Set(
    recent.map((entry) => (entry.payload as { platformUserId?: string }).platformUserId).filter(Boolean) as string[],
  );
  for (const state of states) {
    const customer = customers.find((entry) => entry.platformUserId === state.platformUserId);
    if (!customer || !state.online || alreadyNotified.has(state.platformUserId)) continue;
    await notify({
      recipientUserId: userId,
      type: "PLATFORM_USER_ONLINE",
      payload: {
        customerId: customer.id,
        platformUserId: state.platformUserId,
        label: `${customer.firstName} ${customer.lastName}`,
        openPositions: state.openPositions,
      },
      context: subjectNotificationContext("CUSTOMER", customer.id),
    });
    alreadyNotified.add(state.platformUserId);
  }
}

export async function listNotifications(userId: string, query: z.infer<typeof NotificationQuery> = NotificationQuery.parse({})) {
  const where: Prisma.NotificationWhereInput = {
    recipientUserId: userId,
    ...(query.read === "unread" ? { readAt: null } : query.read === "read" ? { readAt: { not: null } } : {}),
    ...(query.type ? { type: query.type as NotifiableType } : {}),
  };
  const rows = await prisma.notification.findMany({
    where,
    orderBy: { createdAt: "desc" },
    skip: (query.page - 1) * query.pageSize,
    take: query.pageSize,
  });
  const total = await prisma.notification.count({ where });
  return { rows, total, page: query.page, pageSize: query.pageSize, hasMore: query.page * query.pageSize < total };
}

export async function countUnread(userId: string): Promise<number> {
  return prisma.notification.count({
    where: { recipientUserId: userId, readAt: null },
  });
}

export async function markAllRead(userId: string): Promise<number> {
  const result = await prisma.notification.updateMany({
    where: { recipientUserId: userId, readAt: null },
    data: { readAt: new Date() },
  });
  return result.count;
}

export async function markNotificationRead(userId: string, id: string, read: boolean): Promise<boolean> {
  const result = await prisma.notification.updateMany({
    where: { id, recipientUserId: userId },
    data: { readAt: read ? new Date() : null },
  });
  return result.count > 0;
}
