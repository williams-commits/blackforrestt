import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/server/db";
import { CrmError } from "@/server/guard";
import { appendAudit } from "@/server/audit";
import { appendActivity } from "@/server/activity";
import { assignedScopeWhere } from "@/server/scope";
import type { ScopedContext } from "@/server/records/leads";

/**
 * Lead merge: `merged` collapses into `primary`. The merged lead is
 * soft-deleted with a full snapshot in MergeRecord (administratively
 * reversible), open tasks and notes are re-pointed to the primary, and the
 * merged lead's timeline events are COPIED (never moved — ActivityEvent is
 * append-only) so the surviving lead shows the complete history.
 */

export const MergeLeads = z.object({
  primaryId: z.string().min(5),
  mergedId: z.string().min(5),
});

export async function mergeLeads(ctx: ScopedContext, input: z.infer<typeof MergeLeads>) {
  if (!ctx.permissions.includes("LEADS_DELETE")) {
    throw new CrmError("Forbidden — LEADS_DELETE permission required to merge", 403);
  }
  if (input.primaryId === input.mergedId) {
    throw new CrmError("Cannot merge a lead into itself.", 400);
  }

  const scope = assignedScopeWhere(ctx.userId, ctx.scope, ctx.teamIds);
  const [primary, merged] = await Promise.all([
    prisma.lead.findFirst({ where: { id: input.primaryId, deletedAt: null, ...scope } }),
    prisma.lead.findFirst({ where: { id: input.mergedId, deletedAt: null, ...scope } }),
  ]);
  if (!primary || !merged) throw new CrmError("Both leads must exist and be in your scope.", 404);

  const [events, taskCount, noteCount] = await Promise.all([
    prisma.activityEvent.findMany({
      where: { subjectType: "LEAD", subjectId: merged.id },
      orderBy: { createdAt: "asc" },
    }),
    prisma.task.count({
      where: { subjectType: "LEAD", subjectId: merged.id, status: { in: ["OPEN", "IN_PROGRESS"] } },
    }),
    prisma.note.count({ where: { subjectType: "LEAD", subjectId: merged.id } }),
  ]);

  await prisma.$transaction(async (tx) => {
    // Full pre-merge snapshot for administrative reversal.
    await tx.mergeRecord.create({
      data: {
        objectType: "LEAD",
        primaryId: primary.id,
        mergedId: merged.id,
        snapshot: {
          lead: JSON.parse(
            JSON.stringify({
              ...merged,
              // Dates serialize to strings in the snapshot only.
              createdAt: merged.createdAt.toISOString(),
              updatedAt: merged.updatedAt.toISOString(),
            }),
          ),
          eventCount: events.length,
          taskCount,
          noteCount,
        },
        actorUserId: ctx.userId,
      },
    });

    // Live work and notes follow the surviving lead.
    await tx.task.updateMany({
      where: { subjectType: "LEAD", subjectId: merged.id, status: { in: ["OPEN", "IN_PROGRESS"] } },
      data: { subjectType: "LEAD", subjectId: primary.id },
    });
    await tx.note.updateMany({
      where: { subjectType: "LEAD", subjectId: merged.id },
      data: { subjectType: "LEAD", subjectId: primary.id },
    });

    // Copy timeline events onto the survivor — original timestamps, actors,
    // and payloads preserved; only the subject reference is new.
    for (const event of events) {
      await tx.activityEvent.create({
        data: {
          subjectType: "LEAD",
          subjectId: primary.id,
          kind: event.kind,
          actorUserId: event.actorUserId,
          payload: (event.payload ?? undefined) as Prisma.InputJsonValue | undefined,
          createdAt: event.createdAt,
        },
      });
    }

    await appendActivity(tx, {
      subjectType: "LEAD",
      subjectId: primary.id,
      kind: "merged",
      actorUserId: ctx.userId,
      payload: { mergedLeadName: `${merged.firstName} ${merged.lastName}`, mergedId: merged.id },
    });

    await tx.lead.update({ where: { id: merged.id }, data: { deletedAt: new Date() } });

    await appendAudit(tx, {
      actorId: ctx.userId,
      action: "LEAD_MERGED",
      objectType: "Lead",
      objectId: primary.id,
      before: { mergedId: merged.id, mergedName: `${merged.firstName} ${merged.lastName}` },
      after: { copiedEvents: events.length, movedTasks: taskCount, movedNotes: noteCount },
    });
  });

  return {
    primaryId: primary.id,
    copiedEvents: events.length,
    movedTasks: taskCount,
    movedNotes: noteCount,
  };
}
