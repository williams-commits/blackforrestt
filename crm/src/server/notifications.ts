import type { Prisma } from "@prisma/client";
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
  | "TASK_DUE"
  | "TASK_OVERDUE";

interface NotifyInput {
  recipientUserId: string;
  type: NotifiableType;
  payload: Record<string, unknown>;
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
        payload: input.payload as Prisma.InputJsonValue,
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
    });
    await prisma.task.update({
      where: { id: task.id },
      data: { overdueNotifiedAt: now },
    }).catch(() => undefined);
  }
}

export function listNotifications(userId: string) {
  return prisma.notification.findMany({
    where: { recipientUserId: userId },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
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
