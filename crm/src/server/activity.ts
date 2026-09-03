import type { Prisma } from "@prisma/client";
import { prisma } from "@/server/db";

/**
 * Append-only timeline writer. Every meaningful record mutation is written
 * here inside its transaction so record pages render history from one
 * indexed query. There is deliberately no update or delete path.
 */
export interface ActivityEntry {
  subjectType: "LEAD" | "CONTACT" | "CUSTOMER" | "ACCOUNT" | "OPPORTUNITY" | "CAMPAIGN" | "TASK";
  subjectId: string;
  kind:
    | "created"
    | "updated"
    | "status_changed"
    | "stage_changed"
    | "assigned"
    | "deleted"
    | "restored"
    | "bulk_assigned"
    | "bulk_status_changed"
    | "bulk_deleted"
    | "note_added"
    | "task_created"
    | "task_completed"
    | "task_cancelled"
    | "appointment_scheduled"
    | "appointment_completed"
    | "appointment_cancelled"
    | "converted"
    | "merged"
    | "imported";
  actorUserId?: string | null;
  payload?: Prisma.InputJsonValue;
}

type TransactionClient = Pick<Prisma.TransactionClient, "activityEvent">;

export async function appendActivity(tx: TransactionClient, entry: ActivityEntry): Promise<void> {
  await tx.activityEvent.create({
    data: {
      subjectType: entry.subjectType,
      subjectId: entry.subjectId,
      kind: entry.kind,
      actorUserId: entry.actorUserId ?? null,
      payload: entry.payload,
    },
  });
}

/**
 * Timeline rows for a record. ActivityEvent references records polymorphically
 * (subjectType/subjectId — no Prisma relation), so this is a scoped query by
 * subject, not an include. Call after the record itself passed scope checks.
 */
export function listTimeline(
  subjectType: ActivityEntry["subjectType"],
  subjectId: string,
  take = 50,
) {
  return prisma.activityEvent.findMany({
    where: { subjectType, subjectId },
    orderBy: { createdAt: "desc" },
    take,
    include: { actor: { select: { name: true } } },
  });
}
