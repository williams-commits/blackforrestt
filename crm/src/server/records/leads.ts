import type { Prisma } from "@prisma/client";
import { prisma } from "@/server/db";
import { CrmError, requirePermission, type CrmContext } from "@/server/guard";
import { appendAudit } from "@/server/audit";
import { appendActivity } from "@/server/activity";
import { normalizeEmail, normalizePhone, normalizeText } from "@/server/normalize";
import {
  assignedScopeWhere,
  visibleTeamIds,
} from "@/server/scope";
import { orderByFor, searchWhere } from "@/server/listQuery";
import { notify } from "@/server/notifications";
import { findMatches } from "@/server/records/duplicates";
import { z } from "zod";

/**
 * Lead service — all authorization, scoping, normalization, audit, and
 * timeline writes happen here, never in route handlers or UI.
 */

const BaseFields = {
  firstName: z.string().trim().min(1).max(80),
  lastName: z.string().trim().min(1).max(80),
  company: z.string().trim().max(160).optional().nullable(),
  email: z.string().trim().email().max(200).optional().nullable(),
  phone: z.string().trim().max(40).optional().nullable(),
  secondaryPhone: z.string().trim().max(40).optional().nullable(),
  country: z.string().trim().max(60).optional().nullable(),
  region: z.string().trim().max(60).optional().nullable(),
  source: z.string().trim().max(60).optional().nullable(),
  externalId: z.string().trim().min(2).max(120).optional().nullable(),
  score: z.coerce.number().int().min(0).max(100).optional(),
  nextFollowUpAt: z.coerce.date().optional().nullable(),
  customFields: z.record(z.unknown()).optional().nullable(),
};

export const CreateLead = z.object(BaseFields).extend({
  priority: z.enum(["LOW", "NORMAL", "HIGH", "URGENT"]).default("NORMAL"),
  statusId: z.string().trim().min(5).optional(),
  campaignId: z.string().trim().min(5).optional().nullable(),
  assignedUserId: z.string().trim().min(5).optional().nullable(),
  assignedTeamId: z.string().trim().min(5).optional().nullable(),
  // Duplicate guard: when false/absent, a normalized-key match against an
  // existing lead rejects the create with 409 + matches for confirmation.
  allowDuplicates: z.boolean().optional(),
});

// PATCH accepts partial payloads — only provided fields change.
export const UpdateLead = CreateLead.partial().extend({
  lastContactAt: z.coerce.date().optional().nullable(),
});

export const BulkLeadAction = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("assign"),
    ids: z.array(z.string().min(5)).min(1).max(500),
    assignedUserId: z.string().min(5).nullable(),
    assignedTeamId: z.string().min(5).nullable(),
  }),
  z.object({
    action: z.literal("status"),
    ids: z.array(z.string().min(5)).min(1).max(500),
    statusId: z.string().min(5),
  }),
  z.object({
    action: z.literal("delete"),
    ids: z.array(z.string().min(5)).min(1).max(500),
  }),
]);

const SORTS = {
  createdAt: { createdAt: "desc" as const },
  updatedAt: { updatedAt: "desc" as const },
  name: { lastName: "asc" as const },
  score: { score: "desc" as const },
  nextFollowUpAt: { nextFollowUpAt: "asc" as const },
};
const SEARCH_FIELDS = ["firstName", "lastName", "email", "phone", "company", "externalId"] as const;

const listInclude = {
  status: { select: { name: true, category: true } },
  assignedUser: { select: { id: true, name: true } },
  campaign: { select: { id: true, name: true } },
} satisfies Prisma.LeadInclude;

export interface ScopedContext extends CrmContext {
  teamIds: string[];
}

/** Attach the actor's visible teams to the guard context (used by every read/write). */
export async function scopedContext(permission: Parameters<typeof requirePermission>[0]): Promise<ScopedContext> {
  const context = await requirePermission(permission);
  return { ...context, teamIds: await visibleTeamIds(context.userId, context.scope) };
}

function scopeWhere(ctx: ScopedContext) {
  return assignedScopeWhere(ctx.userId, ctx.scope, ctx.teamIds);
}

export const LeadFilters = z.object({
  statusId: z.string().trim().min(5).optional(),
  priority: z.enum(["LOW", "NORMAL", "HIGH", "URGENT"]).optional(),
  assignment: z.enum(["all", "mine", "unassigned"]).default("all"),
});

export async function listLeads(
  ctx: ScopedContext,
  query: { page: number; pageSize: number; sort?: string; order: "asc" | "desc"; q?: string },
  filters: z.infer<typeof LeadFilters>,
) {
  const where: Prisma.LeadWhereInput = {
    deletedAt: null,
    ...scopeWhere(ctx),
    ...(filters.statusId ? { statusId: filters.statusId } : {}),
    ...(filters.priority ? { priority: filters.priority } : {}),
    ...(filters.assignment === "mine" ? { assignedUserId: ctx.userId } : {}),
    ...(filters.assignment === "unassigned" ? { assignedUserId: null } : {}),
    ...searchWhere(SEARCH_FIELDS, query.q ?? ""),
  };
  const [total, rows] = await Promise.all([
    prisma.lead.count({ where }),
    prisma.lead.findMany({
      where,
      include: listInclude,
      orderBy: orderByFor(query.sort, SORTS, "createdAt"),
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
    }),
  ]);
  return { total, rows };
}

export async function getLead(ctx: ScopedContext, id: string) {
  const lead = await prisma.lead.findFirst({
    where: { id, deletedAt: null, ...scopeWhere(ctx) },
    include: {
      ...listInclude,
      assignedTeam: { select: { id: true, name: true } },
    },
  });
  if (!lead) throw new CrmError("Lead not found.", 404);
  return lead;
}

async function assertStatusFor(appliesTo: "LEAD" | "CONTACT" | "CUSTOMER", statusId?: string) {
  if (!statusId) return undefined;
  const status = await prisma.recordStatus.findFirst({ where: { id: statusId, appliesTo } });
  if (!status) throw new CrmError(`Invalid ${appliesTo.toLowerCase()} status.`, 400);
  return status;
}

/**
 * Normalize write payloads. Keys the caller did not provide are omitted
 * entirely (Prisma treats undefined as "leave unchanged"); provided values
 * are normalized for dedup stability.
 */
function normalizedLeadData(input: Partial<z.infer<typeof CreateLead>>) {
  const data: Record<string, unknown> = {};
  const set = (key: string, value: unknown) => {
    if (value !== undefined) data[key] = value;
  };
  set("firstName", input.firstName);
  set("lastName", input.lastName);
  set("company", normalizeText(input.company));
  set("email", normalizeEmail(input.email));
  set("phone", normalizePhone(input.phone));
  set("secondaryPhone", normalizePhone(input.secondaryPhone));
  set("country", normalizeText(input.country));
  set("region", normalizeText(input.region));
  set("source", normalizeText(input.source));
  set("externalId", normalizeText(input.externalId));
  if (input.nextFollowUpAt !== undefined) data.nextFollowUpAt = input.nextFollowUpAt;
  return data;
}

export async function createLead(ctx: ScopedContext, input: z.infer<typeof CreateLead>) {
  // Create-time duplicate guard: matching keys against existing LEADS.
  // (Contact/customer matching runs at conversion time, where it matters.)
  if (!input.allowDuplicates && (input.email || input.phone || input.externalId)) {
    const matches = await findMatches(ctx, {
      email: input.email,
      phone: input.phone,
      externalId: input.externalId,
    });
    if (matches.leads.length > 0) {
      throw new CrmError("Possible duplicate leads found — review them or confirm to create anyway.", 409, {
        matches,
      });
    }
  }

  const defaultStatus = await prisma.recordStatus.findFirst({
    where: { appliesTo: "LEAD", isDefault: true },
  });
  const status = (await assertStatusFor("LEAD", input.statusId)) ?? defaultStatus;
  if (!status) throw new CrmError("No lead status configured — seed the database.", 400);

  // Assignment control: without LEADS_ASSIGN the actor may only create
  // leads assigned to themselves (the rep workflow).
  let assignedUserId = input.assignedUserId ?? null;
  let assignedTeamId = input.assignedTeamId ?? null;
  if (!ctx.permissions.includes("LEADS_ASSIGN")) {
    assignedUserId = ctx.userId;
    assignedTeamId = ctx.teamIds[0] ?? null;
  } else if (!assignedUserId && !assignedTeamId) {
    assignedUserId = ctx.userId;
  }

  const lead = await prisma.$transaction(async (tx) => {
    const created = await tx.lead.create({
      data: {
        ...normalizedLeadData(input),
        priority: input.priority,
        score: input.score ?? 0,
        statusId: status.id,
        campaignId: input.campaignId ?? null,
        assignedUserId,
        assignedTeamId,
        customFields: (input.customFields as Prisma.InputJsonValue) ?? undefined,
      } as Prisma.LeadUncheckedCreateInput,
    });
    await appendActivity(tx, {
      subjectType: "LEAD",
      subjectId: created.id,
      kind: "created",
      actorUserId: ctx.userId,
      payload: { source: created.source, status: status.name },
    });
    await appendAudit(tx, {
      actorId: ctx.userId,
      action: "LEAD_CREATED",
      objectType: "Lead",
      objectId: created.id,
      after: { name: `${created.firstName} ${created.lastName}`, statusId: status.id },
    });
    return created;
  });
  return lead;
}

export async function updateLead(ctx: ScopedContext, id: string, input: z.infer<typeof UpdateLead>) {
  const existing = await prisma.lead.findFirst({ where: { id, deletedAt: null, ...scopeWhere(ctx) } });
  if (!existing) throw new CrmError("Lead not found.", 404);

  const status = input.statusId ? await assertStatusFor("LEAD", input.statusId) : undefined;
  if (input.statusId && !status) throw new CrmError("Invalid lead status.", 400);

  // Assignment changes require LEADS_ASSIGN.
  if (
    !ctx.permissions.includes("LEADS_ASSIGN") &&
    (("assignedUserId" in input && input.assignedUserId !== undefined) ||
      ("assignedTeamId" in input && input.assignedTeamId !== undefined))
  ) {
    throw new CrmError("Forbidden — LEADS_ASSIGN permission required to change assignment", 403);
  }

  const updated = await prisma.$transaction(async (tx) => {
    const saved = await tx.lead.update({
      where: { id },
      data: {
        ...normalizedLeadData(input),
        ...(input.priority !== undefined ? { priority: input.priority } : {}),
        ...(input.score !== undefined ? { score: input.score } : {}),
        ...(status ? { statusId: status.id } : {}),
        ...(input.campaignId !== undefined ? { campaignId: input.campaignId } : {}),
        ...(input.assignedUserId !== undefined ? { assignedUserId: input.assignedUserId } : {}),
        ...(input.assignedTeamId !== undefined ? { assignedTeamId: input.assignedTeamId } : {}),
        ...(input.lastContactAt !== undefined ? { lastContactAt: input.lastContactAt } : {}),
        ...(input.customFields !== undefined
          ? { customFields: input.customFields as Prisma.InputJsonValue }
          : {}),
      },
    });
    if (status && status.id !== existing.statusId) {
      await appendActivity(tx, {
        subjectType: "LEAD",
        subjectId: id,
        kind: "status_changed",
        actorUserId: ctx.userId,
        payload: { to: status.name },
      });
    }
    if (input.assignedUserId !== undefined && input.assignedUserId !== existing.assignedUserId) {
      await appendActivity(tx, {
        subjectType: "LEAD",
        subjectId: id,
        kind: "assigned",
        actorUserId: ctx.userId,
        payload: { toUserId: input.assignedUserId },
      });
    }
    await appendActivity(tx, {
      subjectType: "LEAD",
      subjectId: id,
      kind: "updated",
      actorUserId: ctx.userId,
    });
    await appendAudit(tx, {
      actorId: ctx.userId,
      action: "LEAD_UPDATED",
      objectType: "Lead",
      objectId: id,
      before: { statusId: existing.statusId, assignedUserId: existing.assignedUserId, priority: existing.priority },
      after: { statusId: status?.id ?? existing.statusId, assignedUserId: saved.assignedUserId, priority: saved.priority },
    });
    return saved;
  });
  if (input.assignedUserId && input.assignedUserId !== existing.assignedUserId && input.assignedUserId !== ctx.userId) {
    await notify({
      recipientUserId: input.assignedUserId,
      type: "RECORD_ASSIGNED",
      payload: {
        recordType: "LEAD",
        recordId: id,
        label: `${existing.firstName} ${existing.lastName}`,
        byName: ctx.name,
      },
    });
  }
  return updated;
}

export async function softDeleteLead(ctx: ScopedContext, id: string) {
  const existing = await prisma.lead.findFirst({ where: { id, deletedAt: null, ...scopeWhere(ctx) } });
  if (!existing) throw new CrmError("Lead not found.", 404);
  await prisma.$transaction(async (tx) => {
    await tx.lead.update({ where: { id }, data: { deletedAt: new Date() } });
    await appendActivity(tx, { subjectType: "LEAD", subjectId: id, kind: "deleted", actorUserId: ctx.userId });
    await appendAudit(tx, {
      actorId: ctx.userId,
      action: "LEAD_DELETED",
      objectType: "Lead",
      objectId: id,
      before: { name: `${existing.firstName} ${existing.lastName}` },
    });
  });
}

export async function bulkLeads(ctx: ScopedContext, input: z.infer<typeof BulkLeadAction>) {
  if (input.action === "assign" && !ctx.permissions.includes("LEADS_ASSIGN")) {
    throw new CrmError("Forbidden — LEADS_ASSIGN permission required", 403);
  }
  if (input.action === "delete" && !ctx.permissions.includes("LEADS_DELETE")) {
    throw new CrmError("Forbidden — LEADS_DELETE permission required", 403);
  }
  const scope = scopeWhere(ctx);
  return prisma.$transaction(async (tx) => {
    const affected = await tx.lead.findMany({
      where: { id: { in: input.ids }, deletedAt: null, ...scope },
      select: { id: true },
    });
    const ids = affected.map((row) => row.id);
    if (input.action === "delete") {
      await tx.lead.updateMany({ where: { id: { in: ids } }, data: { deletedAt: new Date() } });
    } else if (input.action === "status") {
      const status = await assertStatusFor("LEAD", input.statusId);
      if (!status) throw new CrmError("Invalid lead status.", 400);
      await tx.lead.updateMany({ where: { id: { in: ids } }, data: { statusId: status.id } });
    } else {
      await tx.lead.updateMany({
        where: { id: { in: ids } },
        data: {
          ...(input.assignedUserId !== undefined ? { assignedUserId: input.assignedUserId } : {}),
          ...(input.assignedTeamId !== undefined ? { assignedTeamId: input.assignedTeamId } : {}),
        },
      });
    }
    for (const id of ids) {
      await appendActivity(tx, {
        subjectType: "LEAD",
        subjectId: id,
        kind: input.action === "delete" ? "bulk_deleted" : input.action === "status" ? "bulk_status_changed" : "bulk_assigned",
        actorUserId: ctx.userId,
        payload: { count: ids.length },
      });
    }
    await appendAudit(tx, {
      actorId: ctx.userId,
      action: `LEAD_BULK_${input.action.toUpperCase()}`,
      objectType: "Lead",
      after: { ids, count: ids.length },
    });
    if (input.action === "assign" && input.assignedUserId && input.assignedUserId !== ctx.userId) {
      await notify({
        recipientUserId: input.assignedUserId,
        type: "RECORD_ASSIGNED",
        payload: { recordType: "LEAD", count: ids.length, byName: ctx.name },
      });
    }
    return { affected: ids.length };
  });
}
