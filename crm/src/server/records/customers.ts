import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/server/db";
import { CrmError } from "@/server/guard";
import { appendAudit } from "@/server/audit";
import { appendActivity } from "@/server/activity";
import { normalizeEmail, normalizePhone, normalizeText } from "@/server/normalize";
import { ownerScopeWhere } from "@/server/scope";
import { orderByFor, searchWhere } from "@/server/listQuery";
import { sanitizeCustomFields } from "@/server/records/customFields";
import type { ScopedContext } from "@/server/records/leads";

/**
 * Customer service — an active client, optionally linked 1:1 to a contact
 * and (Phase 10) to a trading-platform user.
 */

export const CreateCustomer = z.object({
  firstName: z.string().trim().min(1).max(80),
  lastName: z.string().trim().min(1).max(80),
  email: z.string().trim().email().max(200).optional().nullable(),
  phone: z.string().trim().max(40).optional().nullable(),
  contactId: z.string().trim().min(5).optional().nullable(),
  source: z.string().trim().max(60).optional().nullable(),
  campaignId: z.string().trim().min(5).optional().nullable(),
  statusId: z.string().trim().min(5).optional(),
  ownerUserId: z.string().trim().min(5).optional().nullable(),
  teamId: z.string().trim().min(5).optional().nullable(),
  customFields: z.record(z.unknown()).optional().nullable(),
});

export const UpdateCustomer = CreateCustomer.partial();

const SORTS = {
  createdAt: { createdAt: "desc" as const },
  name: { lastName: "asc" as const },
};
const SEARCH_FIELDS = ["firstName", "lastName", "email", "phone"] as const;

const include = {
  owner: { select: { id: true, name: true } },
  status: { select: { id: true, name: true } },
  contact: { select: { id: true, firstName: true, lastName: true } },
} satisfies Prisma.CustomerInclude;

export async function listCustomers(
  ctx: ScopedContext,
  query: { page: number; pageSize: number; sort?: string; q?: string },
  filters: { statusId?: string },
) {
  const where: Prisma.CustomerWhereInput = {
    deletedAt: null,
    ...ownerScopeWhere(ctx.userId, ctx.scope, ctx.teamIds),
    ...(filters.statusId ? { statusId: filters.statusId } : {}),
    ...searchWhere(SEARCH_FIELDS, query.q ?? ""),
  };
  const [total, rows] = await Promise.all([
    prisma.customer.count({ where }),
    prisma.customer.findMany({
      where,
      include,
      orderBy: orderByFor(query.sort, SORTS, "createdAt"),
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
    }),
  ]);
  return { total, rows };
}

export async function getCustomer(ctx: ScopedContext, id: string) {
  const customer = await prisma.customer.findFirst({
    where: { id, deletedAt: null, ...ownerScopeWhere(ctx.userId, ctx.scope, ctx.teamIds) },
    include: {
      ...include,
      team: { select: { id: true, name: true } },
    },
  });
  if (!customer) throw new CrmError("Customer not found.", 404);
  return customer;
}

export async function createCustomer(ctx: ScopedContext, input: z.infer<typeof CreateCustomer>) {
  const defaultStatus = await prisma.recordStatus.findFirst({
    where: { appliesTo: "CUSTOMER", isDefault: true },
  });
  const status = input.statusId
    ? await prisma.recordStatus.findFirst({ where: { id: input.statusId, appliesTo: "CUSTOMER" } })
    : defaultStatus;
  if (input.statusId && !status) throw new CrmError("Invalid customer status.", 400);
  if (input.contactId) {
    const contact = await prisma.contact.findFirst({ where: { id: input.contactId, deletedAt: null } });
    if (!contact) throw new CrmError("Linked contact not found.", 400);
  }
  return prisma.$transaction(async (tx) => {
    const created = await tx.customer.create({
      data: {
        firstName: input.firstName,
        lastName: input.lastName,
        email: normalizeEmail(input.email),
        phone: normalizePhone(input.phone),
        contactId: input.contactId ?? null,
        source: normalizeText(input.source),
        campaignId: input.campaignId ?? null,
        statusId: status?.id,
        ownerUserId: input.ownerUserId ?? ctx.userId,
        teamId: input.teamId ?? null,
        customFields: (await sanitizeCustomFields("CUSTOMER", input.customFields, "create")) as never,
      } as Prisma.CustomerUncheckedCreateInput,
    });
    await appendActivity(tx, {
      subjectType: "CUSTOMER",
      subjectId: created.id,
      kind: "created",
      actorUserId: ctx.userId,
    });
    await appendAudit(tx, {
      actorId: ctx.userId,
      action: "CUSTOMER_CREATED",
      objectType: "Customer",
      objectId: created.id,
      after: { name: `${created.firstName} ${created.lastName}` },
    });
    return created;
  });
}

export async function updateCustomer(ctx: ScopedContext, id: string, input: z.infer<typeof UpdateCustomer>) {
  const existing = await prisma.customer.findFirst({
    where: { id, deletedAt: null, ...ownerScopeWhere(ctx.userId, ctx.scope, ctx.teamIds) },
  });
  if (!existing) throw new CrmError("Customer not found.", 404);
  const status = input.statusId
    ? await prisma.recordStatus.findFirst({ where: { id: input.statusId, appliesTo: "CUSTOMER" } })
    : undefined;
  if (input.statusId && !status) throw new CrmError("Invalid customer status.", 400);

  return prisma.$transaction(async (tx) => {
    const saved = await tx.customer.update({
      where: { id },
      data: {
        ...(input.firstName !== undefined ? { firstName: input.firstName } : {}),
        ...(input.lastName !== undefined ? { lastName: input.lastName } : {}),
        ...(input.email !== undefined ? { email: normalizeEmail(input.email) } : {}),
        ...(input.phone !== undefined ? { phone: normalizePhone(input.phone) } : {}),
        ...(input.contactId !== undefined ? { contactId: input.contactId } : {}),
        ...(input.source !== undefined ? { source: normalizeText(input.source) } : {}),
        ...(input.campaignId !== undefined ? { campaignId: input.campaignId } : {}),
        ...(status ? { statusId: status.id } : {}),
        ...(input.ownerUserId !== undefined ? { ownerUserId: input.ownerUserId } : {}),
        ...(input.teamId !== undefined ? { teamId: input.teamId } : {}),
        ...(input.customFields !== undefined
          ? { customFields: (await sanitizeCustomFields("CUSTOMER", input.customFields, "update")) as never }
          : {}),
      } as Prisma.CustomerUncheckedUpdateInput,
    });
    if (status && status.id !== existing.statusId) {
      await appendActivity(tx, {
        subjectType: "CUSTOMER",
        subjectId: id,
        kind: "status_changed",
        actorUserId: ctx.userId,
        payload: { to: status.name },
      });
    }
    await appendActivity(tx, { subjectType: "CUSTOMER", subjectId: id, kind: "updated", actorUserId: ctx.userId });
    await appendAudit(tx, {
      actorId: ctx.userId,
      action: "CUSTOMER_UPDATED",
      objectType: "Customer",
      objectId: id,
    });
    return saved;
  });
}

export async function softDeleteCustomer(ctx: ScopedContext, id: string) {
  const existing = await prisma.customer.findFirst({
    where: { id, deletedAt: null, ...ownerScopeWhere(ctx.userId, ctx.scope, ctx.teamIds) },
  });
  if (!existing) throw new CrmError("Customer not found.", 404);
  await prisma.$transaction(async (tx) => {
    await tx.customer.update({ where: { id }, data: { deletedAt: new Date() } });
    await appendActivity(tx, { subjectType: "CUSTOMER", subjectId: id, kind: "deleted", actorUserId: ctx.userId });
    await appendAudit(tx, {
      actorId: ctx.userId,
      action: "CUSTOMER_DELETED",
      objectType: "Customer",
      objectId: id,
    });
  });
}
