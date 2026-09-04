import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/server/db";
import { CrmError } from "@/server/guard";
import { appendAudit } from "@/server/audit";
import { appendActivity } from "@/server/activity";
import { assignedScopeWhere, ownerScopeWhere } from "@/server/scope";
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
  // Guard: never merge into a converted lead.
  if (primary.convertedAt) throw new CrmError("Surviving lead is already converted.", 400);

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
      ip: ctx.ip,
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


// ────────────── Generic merge: contacts, accounts, customers ──────────────

export const MergeRecords = z.object({
  objectType: z.enum(["CONTACT", "ACCOUNT", "CUSTOMER"]),
  primaryId: z.string().min(5),
  mergedId: z.string().min(5),
});

const OWNER_DELETE_PERMISSION = {
  CONTACT: "CONTACTS_DELETE",
  ACCOUNT: "ACCOUNTS_DELETE",
  CUSTOMER: "CUSTOMERS_DELETE",
} as const;

/**
 * Merge two owner-scoped records of the same type: notes/tasks/appointments
 * re-point to the survivor, timeline events are copied (append-only kept),
 * child references move where uniqueness allows, and the merged record is
 * soft-deleted with a full snapshot for administrative reversal.
 */
export async function mergeRecords(ctx: ScopedContext, input: z.infer<typeof MergeRecords>) {
  const permission = OWNER_DELETE_PERMISSION[input.objectType];
  if (!ctx.permissions.includes(permission)) {
    throw new CrmError(`Forbidden — ${permission} permission required to merge`, 403);
  }
  if (input.primaryId === input.mergedId) {
    throw new CrmError("Cannot merge a record into itself.", 400);
  }
  const scope = ownerScopeWhere(ctx.userId, ctx.scope, ctx.teamIds);
  const fetch = async (id: string) => {
    if (input.objectType === "CONTACT") {
      return prisma.contact.findFirst({ where: { id, deletedAt: null, ...scope } });
    }
    if (input.objectType === "ACCOUNT") {
      return prisma.account.findFirst({ where: { id, deletedAt: null, ...scope } });
    }
    return prisma.customer.findFirst({ where: { id, deletedAt: null, ...scope } });
  };
  const [primary, merged] = await Promise.all([fetch(input.primaryId), fetch(input.mergedId)]);
  if (!primary || !merged) throw new CrmError("Both records must exist and be in your scope.", 404);

  const events = await prisma.activityEvent.findMany({
    where: { subjectType: input.objectType, subjectId: merged.id },
    orderBy: { createdAt: "asc" },
  });

  await prisma.$transaction(async (tx) => {
    await tx.mergeRecord.create({
      data: {
        objectType: input.objectType,
        primaryId: primary.id,
        mergedId: merged.id,
        snapshot: { record: JSON.parse(JSON.stringify(merged)), eventCount: events.length },
        actorUserId: ctx.userId,
      },
    });

    // Live work and notes follow the survivor.
    await tx.task.updateMany({
      where: { subjectType: input.objectType, subjectId: merged.id, status: { in: ["OPEN", "IN_PROGRESS"] } },
      data: { subjectType: input.objectType, subjectId: primary.id },
    });
    await tx.note.updateMany({
      where: { subjectType: input.objectType, subjectId: merged.id },
      data: { subjectType: input.objectType, subjectId: primary.id },
    });

    // Child references move where uniqueness allows.
    if (input.objectType === "ACCOUNT") {
      await tx.contact.updateMany({ where: { accountId: merged.id }, data: { accountId: primary.id } });
      await tx.opportunity.updateMany({ where: { accountId: merged.id }, data: { accountId: primary.id } });
    } else if (input.objectType === "CONTACT") {
      // Customer↔Contact is 1:1: move only when the survivor has none.
      const blocker = await tx.customer.findFirst({ where: { contactId: primary.id } });
      if (!blocker) {
        await tx.customer.updateMany({ where: { contactId: merged.id }, data: { contactId: primary.id } });
      }
      await tx.opportunity.updateMany({ where: { contactId: merged.id }, data: { contactId: primary.id } });
    } else {
      await tx.opportunity.updateMany({ where: { customerId: merged.id }, data: { customerId: primary.id } });
    }

    // Copy timeline events onto the survivor (original timestamps kept).
    for (const event of events) {
      await tx.activityEvent.create({
        data: {
          subjectType: input.objectType,
          subjectId: primary.id,
          kind: event.kind,
          actorUserId: event.actorUserId,
          payload: (event.payload ?? undefined) as Prisma.InputJsonValue | undefined,
          createdAt: event.createdAt,
        },
      });
    }
    await appendActivity(tx, {
      subjectType: input.objectType,
      subjectId: primary.id,
      kind: "merged",
      actorUserId: ctx.userId,
      payload: { mergedId: merged.id },
    });

    if (input.objectType === "CONTACT") {
      await tx.contact.update({ where: { id: merged.id }, data: { deletedAt: new Date() } });
    } else if (input.objectType === "ACCOUNT") {
      await tx.account.update({ where: { id: merged.id }, data: { deletedAt: new Date() } });
    } else {
      await tx.customer.update({ where: { id: merged.id }, data: { deletedAt: new Date() } });
    }

    await appendAudit(tx, {
      actorId: ctx.userId,
      ip: ctx.ip,
      action: `${input.objectType}_MERGED`,
      objectType: input.objectType === "CONTACT" ? "Contact" : input.objectType === "ACCOUNT" ? "Account" : "Customer",
      objectId: primary.id,
      before: { mergedId: merged.id },
      after: { copiedEvents: events.length },
    });
  });

  return { primaryId: primary.id, copiedEvents: events.length };
}
