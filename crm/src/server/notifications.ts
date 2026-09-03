import type { Prisma } from "@prisma/client";
import { prisma } from "@/server/db";

/**
 * In-app notifications. Channel fan-out (email etc.) is a later adapter;
 * rows land here and the UI surfaces them. Overdue tasks are DERIVED at
 * read time rather than persisted, so no cron or duplicate suppression
 * is needed.
 */

export type NotifiableType =
  | "RECORD_ASSIGNED"
  | "TASK_CREATED"
  | "APPOINTMENT_SCHEDULED";

interface NotifyInput {
  recipientUserId: string;
  type: NotifiableType;
  payload: Record<string, unknown>;
}

/** Fire-and-forget create — a notification failure must never fail the action. */
export async function notify(input: NotifyInput): Promise<void> {
  try {
    await prisma.notification.create({
      data: {
        recipientUserId: input.recipientUserId,
        type: input.type,
        payload: input.payload as Prisma.InputJsonValue,
      },
    });
  } catch (error) {
    console.error("[crm/notify] failed to record notification", error);
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
