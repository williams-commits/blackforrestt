import { z } from "zod";
import { prisma } from "@/server/db";
import { CrmError, requirePermission, type CrmContext } from "@/server/guard";
import { appendAudit } from "@/server/audit";

/**
 * Pipeline + stage administration. Business configuration lives in the
 * database (never hard-coded); mutations require SETTINGS_MANAGE.
 */

export const CreatePipeline = z.object({
  name: z.string().trim().min(2).max(100),
  isDefault: z.boolean().optional(),
});

export const UpdatePipeline = z.object({
  name: z.string().trim().min(2).max(100).optional(),
  isDefault: z.boolean().optional(),
});

export const CreateStage = z.object({
  name: z.string().trim().min(1).max(100),
  probability: z.coerce.number().int().min(0).max(100).default(0),
  type: z.enum(["OPEN", "WON", "LOST"]).default("OPEN"),
});

export const UpdateStage = CreateStage.partial().extend({
  sortOrder: z.coerce.number().int().min(0).optional(),
});

/** All pipelines with ordered stages (readable by any core-record user). */
export async function listPipelines() {
  return prisma.pipeline.findMany({
    include: { stages: { orderBy: { sortOrder: "asc" } } },
    orderBy: { createdAt: "asc" },
  });
}

export async function defaultPipelineId(): Promise<string | null> {
  const pipeline =
    (await prisma.pipeline.findFirst({ where: { isDefault: true } })) ??
    (await prisma.pipeline.findFirst({ orderBy: { createdAt: "asc" } }));
  return pipeline?.id ?? null;
}

export async function createPipeline(ctx: CrmContext, input: z.infer<typeof CreatePipeline>) {
  return prisma.$transaction(async (tx) => {
    if (input.isDefault) {
      await tx.pipeline.updateMany({ data: { isDefault: false } });
    }
    const pipeline = await tx.pipeline.create({
      data: { name: input.name, isDefault: input.isDefault ?? false },
    });
    // A pipeline needs at least minimal open/won/lost stages to be usable.
    await tx.pipelineStage.createMany({
      data: [
        { pipelineId: pipeline.id, name: "New", sortOrder: 1, probability: 10, type: "OPEN" },
        { pipelineId: pipeline.id, name: "Won", sortOrder: 2, probability: 100, type: "WON" },
        { pipelineId: pipeline.id, name: "Lost", sortOrder: 3, probability: 0, type: "LOST" },
      ],
    });
    await appendAudit(tx, {
      actorId: ctx.userId,
      ip: ctx.ip,
      action: "PIPELINE_CREATED",
      objectType: "Pipeline",
      objectId: pipeline.id,
      after: { name: pipeline.name },
    });
    return pipeline;
  });
}

export async function updatePipeline(ctx: CrmContext, id: string, input: z.infer<typeof UpdatePipeline>) {
  const existing = await prisma.pipeline.findUnique({ where: { id } });
  if (!existing) throw new CrmError("Pipeline not found.", 404);
  return prisma.$transaction(async (tx) => {
    if (input.isDefault) {
      await tx.pipeline.updateMany({ data: { isDefault: false } });
    }
    const pipeline = await tx.pipeline.update({
      where: { id },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.isDefault !== undefined ? { isDefault: input.isDefault } : {}),
      },
    });
    await appendAudit(tx, {
      actorId: ctx.userId,
      ip: ctx.ip,
      action: "PIPELINE_UPDATED",
      objectType: "Pipeline",
      objectId: id,
      after: { name: pipeline.name, isDefault: pipeline.isDefault },
    });
    return pipeline;
  });
}

export async function deletePipeline(ctx: CrmContext, id: string) {
  const [existing, usage] = await Promise.all([
    prisma.pipeline.findUnique({ where: { id } }),
    prisma.opportunity.count({ where: { pipelineId: id, deletedAt: null } }),
  ]);
  if (!existing) throw new CrmError("Pipeline not found.", 404);
  if (usage > 0) {
    throw new CrmError(`Pipeline has ${usage} opportunit(ies) — move or delete them first.`, 400);
  }
  await prisma.$transaction(async (tx) => {
    await tx.pipeline.delete({ where: { id } }); // stages cascade
    await appendAudit(tx, {
      actorId: ctx.userId,
      ip: ctx.ip,
      action: "PIPELINE_DELETED",
      objectType: "Pipeline",
      objectId: id,
      before: { name: existing.name },
    });
  });
}

export async function createStage(ctx: CrmContext, pipelineId: string, input: z.infer<typeof CreateStage>) {
  const pipeline = await prisma.pipeline.findUnique({ where: { id: pipelineId } });
  if (!pipeline) throw new CrmError("Pipeline not found.", 404);
  const duplicate = await prisma.pipelineStage.findFirst({
    where: { pipelineId, name: input.name },
  });
  if (duplicate) throw new CrmError("Stage name already used in this pipeline.", 400);
  return prisma.$transaction(async (tx) => {
    const last = await tx.pipelineStage.findFirst({
      where: { pipelineId },
      orderBy: { sortOrder: "desc" },
      select: { sortOrder: true },
    });
    // New stages slot in before the terminal (won/lost) stages when open.
    let sortOrder = (last?.sortOrder ?? 0) + 1;
    if (input.type === "OPEN") {
      const firstTerminal = await tx.pipelineStage.findFirst({
        where: { pipelineId, type: { in: ["WON", "LOST"] } },
        orderBy: { sortOrder: "asc" },
        select: { sortOrder: true },
      });
      if (firstTerminal) {
        await tx.pipelineStage.updateMany({
          where: { pipelineId, sortOrder: { gte: firstTerminal.sortOrder } },
          data: { sortOrder: { increment: 1 } },
        });
        sortOrder = firstTerminal.sortOrder;
      }
    }
    const stage = await tx.pipelineStage.create({
      data: { ...input, pipelineId, sortOrder },
    });
    await appendAudit(tx, {
      actorId: ctx.userId,
      ip: ctx.ip,
      action: "PIPELINE_STAGE_CREATED",
      objectType: "PipelineStage",
      objectId: stage.id,
      after: { pipeline: pipeline.name, name: stage.name, type: stage.type },
    });
    return stage;
  });
}

export async function updateStage(
  ctx: CrmContext,
  pipelineId: string,
  stageId: string,
  input: z.infer<typeof UpdateStage>,
) {
  const stage = await prisma.pipelineStage.findFirst({ where: { id: stageId, pipelineId } });
  if (!stage) throw new CrmError("Stage not found.", 404);
  return prisma.$transaction(async (tx) => {
    const saved = await tx.pipelineStage.update({
      where: { id: stageId },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.probability !== undefined ? { probability: input.probability } : {}),
        ...(input.type !== undefined ? { type: input.type } : {}),
        ...(input.sortOrder !== undefined ? { sortOrder: input.sortOrder } : {}),
      },
    });
    await appendAudit(tx, {
      actorId: ctx.userId,
      ip: ctx.ip,
      action: "PIPELINE_STAGE_UPDATED",
      objectType: "PipelineStage",
      objectId: stageId,
      before: { name: stage.name, type: stage.type },
      after: { name: saved.name, type: saved.type },
    });
    return saved;
  });
}

export async function deleteStage(ctx: CrmContext, pipelineId: string, stageId: string) {
  const [stage, usage, stageCount] = await Promise.all([
    prisma.pipelineStage.findFirst({ where: { id: stageId, pipelineId } }),
    prisma.opportunity.count({ where: { stageId, deletedAt: null } }),
    prisma.pipelineStage.count({ where: { pipelineId } }),
  ]);
  if (!stage) throw new CrmError("Stage not found.", 404);
  if (usage > 0) {
    throw new CrmError(`Stage has ${usage} opportunit(ies) — move them first.`, 400);
  }
  if (stageCount <= 1) throw new CrmError("A pipeline needs at least one stage.", 400);
  await prisma.$transaction(async (tx) => {
    await tx.pipelineStage.delete({ where: { id: stageId } });
    await appendAudit(tx, {
      actorId: ctx.userId,
      ip: ctx.ip,
      action: "PIPELINE_STAGE_DELETED",
      objectType: "PipelineStage",
      objectId: stageId,
      before: { name: stage.name },
    });
  });
}

/** Guard helper for admin mutations. */
export async function requireSettingsAdmin(): Promise<CrmContext> {
  return requirePermission("SETTINGS_MANAGE");
}
