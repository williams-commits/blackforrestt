import { z } from "zod";
import { prisma } from "@/server/db";
import { CrmError, requireCapability } from "@/server/guard";
import { appendAudit } from "@/server/audit";
import type { CrmContext } from "@/server/guard";

export const CreatePotentialStatus = z.object({
  name: z.string().trim().min(1).max(60),
  sortOrder: z.number().int().min(0).default(0),
  isDefault: z.boolean().default(false),
});
export const UpdatePotentialStatus = CreatePotentialStatus.partial();

export function listPotentialStatuses() {
  return prisma.potentialStatus.findMany({
    orderBy: { sortOrder: "asc" },
    include: { _count: { select: { leads: true } } },
  });
}

export async function createPotentialStatus(ctx: CrmContext, input: z.infer<typeof CreatePotentialStatus>) {
  requireCapability(ctx, "POTENTIAL_STATUS_CREATE");
  const duplicate = await prisma.potentialStatus.findUnique({ where: { name: input.name } });
  if (duplicate) throw new CrmError("A potential status with this name already exists.", 409);
  return prisma.$transaction(async (tx) => {
    if (input.isDefault) await tx.potentialStatus.updateMany({ data: { isDefault: false } });
    const created = await tx.potentialStatus.create({ data: input });
    await appendAudit(tx, { actorId: ctx.userId, action: "POTENTIAL_STATUS_CREATED", objectType: "PotentialStatus", objectId: created.id, after: { name: created.name } });
    return created;
  });
}

export async function updatePotentialStatus(ctx: CrmContext, id: string, input: z.infer<typeof UpdatePotentialStatus>) {
  requireCapability(ctx, "POTENTIAL_STATUS_EDIT");
  const existing = await prisma.potentialStatus.findUnique({ where: { id } });
  if (!existing) throw new CrmError("Potential status not found.", 404);
  return prisma.$transaction(async (tx) => {
    if (input.isDefault) await tx.potentialStatus.updateMany({ where: { id: { not: id } }, data: { isDefault: false } });
    const saved = await tx.potentialStatus.update({ where: { id }, data: input });
    await appendAudit(tx, { actorId: ctx.userId, action: "POTENTIAL_STATUS_UPDATED", objectType: "PotentialStatus", objectId: id, after: input });
    return saved;
  });
}

export async function deletePotentialStatus(ctx: CrmContext, id: string) {
  requireCapability(ctx, "POTENTIAL_STATUS_DELETE");
  const existing = await prisma.potentialStatus.findUnique({ where: { id }, include: { _count: { select: { leads: true } } } });
  if (!existing) throw new CrmError("Potential status not found.", 404);
  if (existing._count.leads > 0) throw new CrmError("This potential status is in use and cannot be deleted.", 409);
  await prisma.$transaction(async (tx) => {
    await tx.potentialStatus.delete({ where: { id } });
    await appendAudit(tx, { actorId: ctx.userId, action: "POTENTIAL_STATUS_DELETED", objectType: "PotentialStatus", objectId: id, before: { name: existing.name } });
  });
}