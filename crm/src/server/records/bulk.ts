import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/server/db";
import { CrmError } from "@/server/guard";
import type { Permission } from "@/server/permissions";
import { appendAudit } from "@/server/audit";
import { appendActivity } from "@/server/activity";
import { assignedScopeWhere, ownerScopeWhere } from "@/server/scope";
import { notify } from "@/server/notifications";
import type { ScopedContext } from "@/server/records/leads";

/**
 * Generic bulk actions across the four core objects. The leads-specific
 * `bulkLeads` predates this; both share the same authorization model:
 * the route gates on <OBJECT>_EDIT, and delete/assign tighten further
 * inside the transaction.
 */

export const BulkObject = z.enum(["leads", "contacts", "accounts", "customers"]);
export type BulkObjectKey = z.infer<typeof BulkObject>;

const Ids = z.array(z.string().min(5)).min(1).max(500);

export const BulkRecordAction = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("assign"),
    ids: Ids,
    /** Leads also accept assignedTeamId; owner-keyed objects reassign the owner. */
    assignedUserId: z.string().min(5).nullable(),
    assignedTeamId: z.string().min(5).nullable().optional(),
  }),
  z.object({ action: z.literal("status"), ids: Ids, statusId: z.string().min(5) }),
  z.object({ action: z.literal("delete"), ids: Ids }),
  z.object({ action: z.literal("tag"), ids: Ids, tagId: z.string().min(5) }),
  z.object({
    action: z.literal("task"),
    ids: Ids,
    title: z.string().trim().min(2).max(200),
    dueAt: z.coerce.date().optional().nullable(),
  }),
]);

interface ObjectConfig {
  subjectType: "LEAD" | "CONTACT" | "ACCOUNT" | "CUSTOMER";
  permissionPrefix: "LEADS" | "CONTACTS" | "ACCOUNTS" | "CUSTOMERS";
  auditType: string;
  hasStatus: boolean;
  /** owner-keyed objects reassign ownerUserId; leads use assignedUserId. */
  assigneeField: "assignedUserId" | "ownerUserId";
  teamField: "assignedTeamId" | "teamId" | null;
  scopeWhere: (ctx: ScopedContext) => Record<string, unknown>;
}

const CONFIGS: Record<BulkObjectKey, ObjectConfig> = {
  leads: {
    subjectType: "LEAD",
    permissionPrefix: "LEADS",
    auditType: "Lead",
    hasStatus: true,
    assigneeField: "assignedUserId",
    teamField: "assignedTeamId",
    scopeWhere: (ctx) => assignedScopeWhere(ctx.userId, ctx.scope, ctx.teamIds),
  },
  contacts: {
    subjectType: "CONTACT",
    permissionPrefix: "CONTACTS",
    auditType: "Contact",
    hasStatus: true,
    assigneeField: "ownerUserId",
    teamField: "teamId",
    scopeWhere: (ctx) => ownerScopeWhere(ctx.userId, ctx.scope, ctx.teamIds),
  },
  accounts: {
    subjectType: "ACCOUNT",
    permissionPrefix: "ACCOUNTS",
    auditType: "Account",
    hasStatus: false,
    assigneeField: "ownerUserId",
    teamField: "teamId",
    scopeWhere: (ctx) => ownerScopeWhere(ctx.userId, ctx.scope, ctx.teamIds),
  },
  customers: {
    subjectType: "CUSTOMER",
    permissionPrefix: "CUSTOMERS",
    auditType: "Customer",
    hasStatus: true,
    assigneeField: "ownerUserId",
    teamField: "teamId",
    scopeWhere: (ctx) => ownerScopeWhere(ctx.userId, ctx.scope, ctx.teamIds),
  },
};

/** Minimal delegate surface used here — the four core delegates all satisfy it. */
type BulkDelegate = {
  findMany(args: { where: Record<string, unknown>; select: { id: true } }): Promise<Array<{ id: string }>>;
  updateMany(args: { where: Record<string, unknown>; data: Record<string, unknown> }): Promise<{ count: number }>;
};

type BulkTx = Prisma.TransactionClient;

function delegateFor(tx: BulkTx, object: BulkObjectKey): BulkDelegate {
  const map = {
    leads: tx.lead,
    contacts: tx.contact,
    accounts: tx.account,
    customers: tx.customer,
  };
  return map[object] as unknown as BulkDelegate;
}

export async function bulkRecords(
  ctx: ScopedContext,
  object: BulkObjectKey,
  input: z.infer<typeof BulkRecordAction>,
) {
  const config = CONFIGS[object];
  const { permissionPrefix: prefix } = config;

  const editPermission = `${prefix}_EDIT` as Permission;
  const deletePermission = `${prefix}_DELETE` as Permission;
  // Leads have a dedicated, narrower ASSIGN permission; owner-keyed objects
  // treat reassignment as an EDIT.
  const assignPermission: Permission = object === "leads" ? "LEADS_ASSIGN" : editPermission;
  if (input.action === "assign" && !ctx.permissions.includes(assignPermission)) {
    throw new CrmError(`Forbidden — ${assignPermission} permission required`, 403);
  }
  if (input.action === "delete" && !ctx.permissions.includes(deletePermission)) {
    throw new CrmError(`Forbidden — ${deletePermission} permission required`, 403);
  }
  if (input.action === "status" && !config.hasStatus) {
    throw new CrmError("This object does not support statuses.", 400);
  }
  // Owner-keyed objects cannot be left ownerless.
  if (input.action === "assign" && config.assigneeField === "ownerUserId" && !input.assignedUserId) {
    throw new CrmError("A new owner is required.", 400);
  }

  const scope = config.scopeWhere(ctx);

  return prisma.$transaction(async (tx) => {
    const model = delegateFor(tx, object);
    const affected = await model.findMany({
      where: { id: { in: input.ids }, deletedAt: null, ...scope },
      select: { id: true },
    });
    const ids = affected.map((row) => row.id);

    if (input.action === "delete") {
      await model.updateMany({
        where: { id: { in: ids } },
        data: { deletedAt: new Date() },
      });
    } else if (input.action === "status") {
      const status = await tx.recordStatus.findFirst({
        where: { id: input.statusId, appliesTo: config.subjectType },
      });
      if (!status) throw new CrmError(`Invalid ${config.auditType.toLowerCase()} status.`, 400);
      await model.updateMany({
        where: { id: { in: ids } },
        data: { statusId: status.id },
      });
    } else if (input.action === "tag") {
      const tag = await tx.tag.findUnique({ where: { id: input.tagId } });
      if (!tag) throw new CrmError("Tag not found.", 400);
      for (const id of ids) {
        await tx.tagLink.upsert({
          where: {
            tagId_subjectType_subjectId: { tagId: tag.id, subjectType: config.subjectType, subjectId: id },
          },
          create: { tagId: tag.id, subjectType: config.subjectType, subjectId: id },
          update: {},
        });
      }
    } else if (input.action === "task") {
      for (const id of ids) {
        await tx.task.create({
          data: {
            title: input.title,
            dueAt: input.dueAt ?? null,
            ownerUserId: ctx.userId,
            subjectType: config.subjectType,
            subjectId: id,
          },
        });
      }
    } else {
      await model.updateMany({
        where: { id: { in: ids } },
        data: {
          ...(input.assignedUserId !== undefined
            ? { [config.assigneeField]: input.assignedUserId }
            : {}),
          ...(input.assignedTeamId !== undefined && config.teamField
            ? { [config.teamField]: input.assignedTeamId }
            : {}),
        },
      });
    }

    for (const id of ids) {
      await appendActivity(tx, {
        subjectType: config.subjectType,
        subjectId: id,
        kind:
          input.action === "delete"
            ? "bulk_deleted"
            : input.action === "status"
              ? "bulk_status_changed"
              : input.action === "tag"
                ? "updated"
                : input.action === "task"
                  ? "task_created"
                  : "bulk_assigned",
        actorUserId: ctx.userId,
        payload: { count: ids.length },
      });
    }
    await appendAudit(tx, {
      actorId: ctx.userId,
      ip: ctx.ip,
      action: `${config.subjectType}_BULK_${input.action.toUpperCase()}`,
      objectType: config.auditType,
      after: { ids, count: ids.length },
    });
    if (input.action === "assign" && input.assignedUserId && input.assignedUserId !== ctx.userId) {
      await notify({
        recipientUserId: input.assignedUserId,
        type: "RECORD_ASSIGNED",
        payload: { recordType: config.subjectType, count: ids.length, byName: ctx.name },
      });
    }
    return { affected: ids.length };
  });
}
