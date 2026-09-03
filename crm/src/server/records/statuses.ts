import { z } from "zod";
import { prisma } from "@/server/db";
import { CrmError, type CrmContext } from "@/server/guard";
import { appendAudit } from "@/server/audit";

/**
 * Record-status administration (leads / contacts / customers). Statuses are
 * business configuration — never hard-coded — and mutating them requires
 * SETTINGS_MANAGE (enforced by the routes).
 */

export const APPLIES_TO = ["LEAD", "CONTACT", "CUSTOMER"] as const;

export const CreateStatus = z.object({
  name: z.string().trim().min(1).max(40),
  appliesTo: z.enum(APPLIES_TO),
  category: z.enum(["OPEN", "CONVERTED", "LOST", "INVALID"]),
  sortOrder: z.coerce.number().int().min(0).default(0),
  isDefault: z.boolean().default(false),
});

export const UpdateStatus = CreateStatus.partial().omit({ appliesTo: true });

export function listStatuses() {
  return prisma.recordStatus.findMany({
    orderBy: [{ appliesTo: "asc" }, { sortOrder: "asc" }],
    include: { _count: { select: { leads: true, contacts: true, customers: true } } },
  });
}

async function ensureDefault(appliesTo: string, tx: { recordStatus: { count(args: unknown): Promise<number>; updateMany(args: unknown): Promise<unknown>; findFirst(args: unknown): Promise<{ id: string } | null> } }, excludeId?: string) {
  const remaining = await tx.recordStatus.count({
    where: { appliesTo, isDefault: true, ...(excludeId ? { id: { not: excludeId } } : {}) },
  });
  if (remaining === 0) {
    const fallback = await tx.recordStatus.findFirst({
      where: { appliesTo, ...(excludeId ? { id: { not: excludeId } } : {}) },
      orderBy: { sortOrder: "asc" },
    });
    if (fallback) {
      await tx.recordStatus.updateMany({
        where: { appliesTo, id: fallback.id },
        data: { isDefault: true },
      });
    }
  }
}

export async function createStatus(ctx: CrmContext, input: z.infer<typeof CreateStatus>) {
  const duplicate = await prisma.recordStatus.findUnique({
    where: { name_appliesTo: { name: input.name, appliesTo: input.appliesTo } },
  });
  if (duplicate) throw new CrmError("A status with this name already exists for this object.", 400);
  return prisma.$transaction(async (tx) => {
    if (input.isDefault) {
      await tx.recordStatus.updateMany({
        where: { appliesTo: input.appliesTo },
        data: { isDefault: false },
      });
    }
    const created = await tx.recordStatus.create({ data: input });
    await appendAudit(tx, {
      actorId: ctx.userId,
      action: "RECORD_STATUS_CREATED",
      objectType: "RecordStatus",
      objectId: created.id,
      after: { name: created.name, appliesTo: created.appliesTo, category: created.category },
    });
    return created;
  });
}

export async function updateStatus(ctx: CrmContext, id: string, input: z.infer<typeof UpdateStatus>) {
  const existing = await prisma.recordStatus.findUnique({ where: { id } });
  if (!existing) throw new CrmError("Status not found.", 404);
  return prisma.$transaction(async (tx) => {
    if (input.isDefault) {
      await tx.recordStatus.updateMany({
        where: { appliesTo: existing.appliesTo },
        data: { isDefault: false },
      });
    }
    const saved = await tx.recordStatus.update({
      where: { id },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.category !== undefined ? { category: input.category } : {}),
        ...(input.sortOrder !== undefined ? { sortOrder: input.sortOrder } : {}),
        ...(input.isDefault !== undefined ? { isDefault: input.isDefault } : {}),
      },
    });
    if (!saved.isDefault) {
      await ensureDefault(existing.appliesTo, tx as never, id);
    }
    await appendAudit(tx, {
      actorId: ctx.userId,
      action: "RECORD_STATUS_UPDATED",
      objectType: "RecordStatus",
      objectId: id,
      before: { name: existing.name, category: existing.category },
      after: { name: saved.name, category: saved.category },
    });
    return saved;
  });
}

export async function deleteStatus(ctx: CrmContext, id: string) {
  const existing = await prisma.recordStatus.findUnique({
    where: { id },
    include: { _count: { select: { leads: true, contacts: true, customers: true } } },
  });
  if (!existing) throw new CrmError("Status not found.", 404);
  const usage = existing._count.leads + existing._count.contacts + existing._count.customers;
  if (usage > 0) {
    throw new CrmError(`Status is used by ${usage} record(s) — move them to another status first.`, 400);
  }
  await prisma.$transaction(async (tx) => {
    await tx.recordStatus.delete({ where: { id } });
    await ensureDefault(existing.appliesTo, tx as never, id);
    await appendAudit(tx, {
      actorId: ctx.userId,
      action: "RECORD_STATUS_DELETED",
      objectType: "RecordStatus",
      objectId: id,
      before: { name: existing.name, appliesTo: existing.appliesTo },
    });
  });
}
