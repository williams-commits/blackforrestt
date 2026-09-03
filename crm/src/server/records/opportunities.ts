import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/server/db";
import { CrmError } from "@/server/guard";
import { appendAudit } from "@/server/audit";
import { appendActivity } from "@/server/activity";
import { ownerScopeWhere } from "@/server/scope";
import { orderByFor, searchWhere } from "@/server/listQuery";
import type { ScopedContext } from "@/server/records/leads";

/**
 * Opportunity service. Stage flow is stage-table-driven: moving to a
 * WON/LOST-type stage closes the deal (status + closedAt); moving back to
 * an OPEN stage reopens it. Every stage change writes a timeline event.
 */

export const CreateOpportunity = z.object({
  name: z.string().trim().min(2).max(200),
  accountId: z.string().trim().min(5).optional().nullable(),
  contactId: z.string().trim().min(5).optional().nullable(),
  customerId: z.string().trim().min(5).optional().nullable(),
  pipelineId: z.string().trim().min(5),
  stageId: z.string().trim().min(5).optional(),
  ownerUserId: z.string().trim().min(5).optional(),
  teamId: z.string().trim().min(5).optional().nullable(),
  value: z.coerce.number().int().min(0).max(10_000_000_000_00).optional().nullable(),
  currency: z.string().trim().length(3).default("USD"),
  probability: z.coerce.number().int().min(0).max(100).optional(),
  expectedCloseAt: z.coerce.date().optional().nullable(),
  source: z.string().trim().max(60).optional().nullable(),
});

export const UpdateOpportunity = CreateOpportunity.partial();

const SORTS = {
  createdAt: { createdAt: "desc" as const },
  name: { name: "asc" as const },
  value: { value: "desc" as const },
  expectedCloseAt: { expectedCloseAt: "asc" as const },
};
const SEARCH_FIELDS = ["name", "source"] as const;

const listInclude = {
  owner: { select: { id: true, name: true } },
  account: { select: { id: true, name: true } },
  contact: { select: { id: true, firstName: true, lastName: true } },
  pipeline: { select: { id: true, name: true } },
  stage: { select: { id: true, name: true, type: true, probability: true } },
} satisfies Prisma.OpportunityInclude;

/** BigInt (value) is not JSON-serializable — map to string. */
function serialize<T extends { value: bigint | null }>(row: T) {
  return { ...row, value: row.value === null ? null : row.value.toString() };
}

export const OpportunityFilters = z.object({
  pipelineId: z.string().trim().min(5).optional(),
  stageId: z.string().trim().min(5).optional(),
  status: z.enum(["OPEN", "WON", "LOST"]).optional(),
});

function scopeWhere(ctx: ScopedContext) {
  return ownerScopeWhere(ctx.userId, ctx.scope, ctx.teamIds);
}

export async function listOpportunities(
  ctx: ScopedContext,
  query: { page: number; pageSize: number; sort?: string; q?: string },
  filters: z.infer<typeof OpportunityFilters>,
) {
  const where: Prisma.OpportunityWhereInput = {
    deletedAt: null,
    ...scopeWhere(ctx),
    ...(filters.pipelineId ? { pipelineId: filters.pipelineId } : {}),
    ...(filters.stageId ? { stageId: filters.stageId } : {}),
    ...(filters.status ? { status: filters.status } : {}),
    ...searchWhere(SEARCH_FIELDS, query.q ?? ""),
  };
  const [total, rows] = await Promise.all([
    prisma.opportunity.count({ where }),
    prisma.opportunity.findMany({
      where,
      include: listInclude,
      orderBy: orderByFor(query.sort, SORTS, "createdAt"),
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
    }),
  ]);
  return { total, rows: rows.map(serialize) };
}

/**
 * Board payload for one pipeline: stages in order, scoped open (or
 * all-status) opportunities grouped client-side, and money aggregates.
 */
export async function board(ctx: ScopedContext, pipelineId: string, includeClosed = false) {
  const pipeline = await prisma.pipeline.findUnique({
    where: { id: pipelineId },
    include: { stages: { orderBy: { sortOrder: "asc" } } },
  });
  if (!pipeline) throw new CrmError("Pipeline not found.", 404);

  const where: Prisma.OpportunityWhereInput = {
    pipelineId,
    deletedAt: null,
    ...scopeWhere(ctx),
    ...(includeClosed ? {} : { status: "OPEN" }),
  };
  const [rows, grouped] = await Promise.all([
    prisma.opportunity.findMany({
      where,
      include: listInclude,
      orderBy: { value: "desc" },
      take: 500,
    }),
    prisma.opportunity.groupBy({
      by: ["stageId", "status"],
      where,
      _count: { _all: true },
      _sum: { value: true },
    }),
  ]);

  const stageAggregates = new Map<
    string,
    { count: number; value: number }
  >();
  for (const group of grouped) {
    const entry = stageAggregates.get(group.stageId) ?? { count: 0, value: 0 };
    entry.count += group._count._all;
    entry.value += Number(group._sum.value ?? 0n);
    stageAggregates.set(group.stageId, entry);
  }

  const openRows = rows.filter((row) => row.status === "OPEN");
  const openValue = openRows.reduce((sum, row) => sum + Number(row.value ?? 0n), 0);
  const weighted = openRows.reduce(
    (sum, row) => sum + (Number(row.value ?? 0n) * row.probability) / 100,
    0,
  );
  const wonRows = rows.filter((row) => row.status === "WON");
  const lostRows = rows.filter((row) => row.status === "LOST");
  const closedTotal = wonRows.length + lostRows.length;

  return {
    pipeline: { id: pipeline.id, name: pipeline.name },
    stages: pipeline.stages,
    opportunities: rows.map(serialize),
    aggregates: {
      openCount: openRows.length,
      openValue,
      weightedValue: Math.round(weighted),
      wonCount: wonRows.length,
      wonValue: wonRows.reduce((sum, row) => sum + Number(row.value ?? 0n), 0),
      winRate: closedTotal === 0 ? null : Math.round((wonRows.length / closedTotal) * 100),
      byStage: Object.fromEntries(
        pipeline.stages.map((stage) => [stage.id, stageAggregates.get(stage.id) ?? { count: 0, value: 0 }]),
      ),
    },
  };
}

export async function getOpportunity(ctx: ScopedContext, id: string) {
  const opportunity = await prisma.opportunity.findFirst({
    where: { id, deletedAt: null, ...scopeWhere(ctx) },
    include: {
      ...listInclude,
      team: { select: { id: true, name: true } },
      customer: { select: { id: true, firstName: true, lastName: true } },
    },
  });
  if (!opportunity) throw new CrmError("Opportunity not found.", 404);
  return serialize(opportunity);
}

/** Validate that a stage belongs to the given pipeline; 400 otherwise. */
async function assertStage(pipelineId: string, stageId?: string) {
  if (!stageId) return undefined;
  const stage = await prisma.pipelineStage.findFirst({ where: { id: stageId, pipelineId } });
  if (!stage) throw new CrmError("Stage does not belong to this pipeline.", 400);
  return stage;
}

export async function createOpportunity(ctx: ScopedContext, input: z.infer<typeof CreateOpportunity>) {
  const pipeline = await prisma.pipeline.findUnique({ where: { id: input.pipelineId } });
  if (!pipeline) throw new CrmError("Pipeline not found.", 400);
  const stage =
    (await assertStage(input.pipelineId, input.stageId)) ??
    (await prisma.pipelineStage.findFirst({
      where: { pipelineId: input.pipelineId, type: "OPEN" },
      orderBy: { sortOrder: "asc" },
    }));
  if (!stage) throw new CrmError("Pipeline has no stages.", 400);

  return prisma.$transaction(async (tx) => {
    const created = await tx.opportunity.create({
      data: {
        name: input.name,
        accountId: input.accountId ?? null,
        contactId: input.contactId ?? null,
        customerId: input.customerId ?? null,
        ownerUserId: input.ownerUserId ?? ctx.userId,
        teamId: input.teamId ?? ctx.teamIds[0] ?? null,
        pipelineId: input.pipelineId,
        stageId: stage.id,
        value: input.value === null || input.value === undefined ? null : BigInt(input.value),
        currency: input.currency,
        probability: input.probability ?? stage.probability,
        expectedCloseAt: input.expectedCloseAt ?? null,
        source: input.source ?? null,
        status: stage.type === "OPEN" ? "OPEN" : stage.type,
        closedAt: stage.type === "OPEN" ? null : new Date(),
      } as Prisma.OpportunityUncheckedCreateInput,
    });
    await appendActivity(tx, {
      subjectType: "OPPORTUNITY",
      subjectId: created.id,
      kind: "created",
      actorUserId: ctx.userId,
      payload: { stage: stage.name, pipeline: pipeline.name },
    });
    await appendAudit(tx, {
      actorId: ctx.userId,
      action: "OPPORTUNITY_CREATED",
      objectType: "Opportunity",
      objectId: created.id,
      after: { name: created.name, stageId: stage.id, value: created.value?.toString() ?? null },
    });
    return serialize(created);
  });
}

export async function updateOpportunity(
  ctx: ScopedContext,
  id: string,
  input: z.infer<typeof UpdateOpportunity>,
) {
  const existing = await prisma.opportunity.findFirst({
    where: { id, deletedAt: null, ...scopeWhere(ctx) },
    include: { stage: true },
  });
  if (!existing) throw new CrmError("Opportunity not found.", 404);

  const pipelineId = input.pipelineId ?? existing.pipelineId;
  if (input.pipelineId && input.pipelineId !== existing.pipelineId) {
    const pipeline = await prisma.pipeline.findUnique({ where: { id: input.pipelineId } });
    if (!pipeline) throw new CrmError("Pipeline not found.", 400);
  }
  const newStage = input.stageId ? await assertStage(pipelineId, input.stageId) : undefined;
  if (input.stageId && !newStage) throw new CrmError("Stage does not belong to this pipeline.", 400);
  // Switching pipelines requires a stage from the new pipeline.
  if (input.pipelineId && input.pipelineId !== existing.pipelineId && !newStage) {
    throw new CrmError("Moving pipelines requires a stage from the target pipeline.", 400);
  }

  // Stage-driven status: terminal stage closes, open stage reopens.
  let status = existing.status;
  let closedAt = existing.closedAt;
  if (newStage && newStage.id !== existing.stageId) {
    if (newStage.type === "WON") {
      status = "WON";
      closedAt = new Date();
    } else if (newStage.type === "LOST") {
      status = "LOST";
      closedAt = new Date();
    } else {
      status = "OPEN";
      closedAt = null;
    }
  }

  return prisma.$transaction(async (tx) => {
    const saved = await tx.opportunity.update({
      where: { id },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.accountId !== undefined ? { accountId: input.accountId } : {}),
        ...(input.contactId !== undefined ? { contactId: input.contactId } : {}),
        ...(input.customerId !== undefined ? { customerId: input.customerId } : {}),
        ...(input.ownerUserId !== undefined ? { ownerUserId: input.ownerUserId } : {}),
        ...(input.teamId !== undefined ? { teamId: input.teamId } : {}),
        ...(input.pipelineId !== undefined ? { pipelineId: input.pipelineId } : {}),
        ...(newStage ? { stageId: newStage.id } : {}),
        ...(input.value !== undefined
          ? { value: input.value === null ? null : BigInt(input.value) }
          : {}),
        ...(input.currency !== undefined ? { currency: input.currency } : {}),
        ...(input.probability !== undefined ? { probability: input.probability } : {}),
        ...(newStage ? { probability: input.probability ?? newStage.probability } : {}),
        ...(input.expectedCloseAt !== undefined ? { expectedCloseAt: input.expectedCloseAt } : {}),
        ...(input.source !== undefined ? { source: input.source } : {}),
        status,
        ...(closedAt !== undefined ? { closedAt } : {}),
      } as Prisma.OpportunityUncheckedUpdateInput,
    });
    if (newStage && newStage.id !== existing.stageId) {
      await appendActivity(tx, {
        subjectType: "OPPORTUNITY",
        subjectId: id,
        kind: "stage_changed",
        actorUserId: ctx.userId,
        payload: { from: existing.stage.name, to: newStage.name, status },
      });
    } else {
      await appendActivity(tx, {
        subjectType: "OPPORTUNITY",
        subjectId: id,
        kind: "updated",
        actorUserId: ctx.userId,
      });
    }
    await appendAudit(tx, {
      actorId: ctx.userId,
      action: "OPPORTUNITY_UPDATED",
      objectType: "Opportunity",
      objectId: id,
      before: { stageId: existing.stageId, status: existing.status, value: existing.value?.toString() ?? null },
      after: { stageId: saved.stageId, status: saved.status, value: saved.value?.toString() ?? null },
    });
    return serialize(saved);
  });
}

export async function softDeleteOpportunity(ctx: ScopedContext, id: string) {
  const existing = await prisma.opportunity.findFirst({
    where: { id, deletedAt: null, ...scopeWhere(ctx) },
  });
  if (!existing) throw new CrmError("Opportunity not found.", 404);
  await prisma.$transaction(async (tx) => {
    await tx.opportunity.update({ where: { id }, data: { deletedAt: new Date() } });
    await appendActivity(tx, {
      subjectType: "OPPORTUNITY",
      subjectId: id,
      kind: "deleted",
      actorUserId: ctx.userId,
    });
    await appendAudit(tx, {
      actorId: ctx.userId,
      action: "OPPORTUNITY_DELETED",
      objectType: "Opportunity",
      objectId: id,
      before: { name: existing.name },
    });
  });
}
