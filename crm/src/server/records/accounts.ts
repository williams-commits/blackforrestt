import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/server/db";
import { CrmError } from "@/server/guard";
import { appendAudit } from "@/server/audit";
import { appendActivity } from "@/server/activity";
import { normalizeCountry, normalizeText } from "@/server/normalize";
import { ownerScopeWhere } from "@/server/scope";
import { customFieldWhere, orderByFor, searchWhere } from "@/server/listQuery";
import { sanitizeCustomFields } from "@/server/records/customFields";
import type { ScopedContext } from "@/server/records/leads";

/** Account (company) service. Revenue is stored in integer minor units. */

export const CreateAccount = z.object({
  name: z.string().trim().min(1).max(200),
  industry: z.string().trim().max(120).optional().nullable(),
  companySize: z.string().trim().max(40).optional().nullable(),
  revenue: z.coerce.number().int().min(0).max(10_000_000_000_00).optional().nullable(),
  website: z.string().trim().url().max(300).optional().nullable(),
  addressLine: z.string().trim().max(200).optional().nullable(),
  city: z.string().trim().max(100).optional().nullable(),
  country: z.string().trim().max(60).optional().nullable(),
  externalId: z.string().trim().min(2).max(120).optional().nullable(),
  ownerUserId: z.string().trim().min(5).optional().nullable(),
  teamId: z.string().trim().min(5).optional().nullable(),
  customFields: z.record(z.unknown()).optional().nullable(),
});

export const UpdateAccount = CreateAccount.partial();

const SORTS = {
  createdAt: { createdAt: "desc" as const },
  name: { name: "asc" as const },
};
const SEARCH_FIELDS = ["name", "industry", "website", "city", "country"] as const;

const include = {
  owner: { select: { id: true, name: true } },
  _count: { select: { contacts: true, opportunities: true } },
} satisfies Prisma.AccountInclude;

/** BigInt (revenue) is not JSON-serializable — map to string. */
function serialize(row: Prisma.AccountGetPayload<{ include: typeof include }>) {
  return { ...row, revenue: row.revenue === null ? null : row.revenue.toString() };
}

export async function listAccounts(
  ctx: ScopedContext,
  query: { page: number; pageSize: number; sort?: string; q?: string },
  cfFilters?: Array<{ key: string; value: string }>,
) {
  const where: Prisma.AccountWhereInput = {
    deletedAt: null,
    ...ownerScopeWhere(ctx.userId, ctx.scope, ctx.teamIds),
    ...searchWhere(SEARCH_FIELDS, query.q ?? ""),
    ...customFieldWhere(cfFilters ?? []),
  };
  const [total, rows] = await Promise.all([
    prisma.account.count({ where }),
    prisma.account.findMany({
      where,
      include,
      orderBy: orderByFor(query.sort, SORTS, "createdAt"),
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
    }),
  ]);
  return { total, rows: rows.map(serialize) };
}

export async function getAccount(ctx: ScopedContext, id: string) {
  const account = await prisma.account.findFirst({
    where: { id, deletedAt: null, ...ownerScopeWhere(ctx.userId, ctx.scope, ctx.teamIds) },
    include: {
      owner: { select: { id: true, name: true } },
      team: { select: { id: true, name: true } },
      contacts: {
        where: { deletedAt: null },
        take: 25,
        orderBy: { lastName: "asc" },
        select: { id: true, firstName: true, lastName: true, email: true, jobTitle: true },
      },
    },
  });
  if (!account) throw new CrmError("Account not found.", 404);
  return { ...account, revenue: account.revenue === null ? null : account.revenue.toString() };
}

function dataFrom(input: z.infer<typeof CreateAccount> | z.infer<typeof UpdateAccount>, partial: boolean) {
  const data: Record<string, unknown> = {};
  const assign = (key: string, value: unknown) => {
    if (value !== undefined) data[key] = value;
    else if (!partial) data[key] = null;
  };
  assign("name", input.name);
  assign("industry", normalizeText(input.industry));
  assign("companySize", normalizeText(input.companySize));
  if (input.revenue !== undefined) data.revenue = input.revenue === null ? null : BigInt(input.revenue);
  else if (!partial) data.revenue = null;
  assign("website", normalizeText(input.website));
  assign("addressLine", normalizeText(input.addressLine));
  assign("city", normalizeText(input.city));
  assign("country", normalizeCountry(input.country));
  assign("externalId", normalizeText(input.externalId));
  return data;
}

export async function createAccount(ctx: ScopedContext, input: z.infer<typeof CreateAccount>) {
  return prisma.$transaction(async (tx) => {
    const created = await tx.account.create({
      data: {
        ...dataFrom(input, false),
        ownerUserId: input.ownerUserId ?? ctx.userId,
        teamId: input.teamId ?? null,
        customFields: (await sanitizeCustomFields("ACCOUNT", input.customFields, "create")) as never,
      } as unknown as Prisma.AccountUncheckedCreateInput,
    });
    await appendActivity(tx, {
      subjectType: "ACCOUNT",
      subjectId: created.id,
      kind: "created",
      actorUserId: ctx.userId,
    });
    await appendAudit(tx, {
      actorId: ctx.userId,
      ip: ctx.ip,
      action: "ACCOUNT_CREATED",
      objectType: "Account",
      objectId: created.id,
      after: { name: created.name },
    });
    return created;
  });
}

export async function updateAccount(ctx: ScopedContext, id: string, input: z.infer<typeof UpdateAccount>) {
  const existing = await prisma.account.findFirst({
    where: { id, deletedAt: null, ...ownerScopeWhere(ctx.userId, ctx.scope, ctx.teamIds) },
  });
  if (!existing) throw new CrmError("Account not found.", 404);
  return prisma.$transaction(async (tx) => {
    const saved = await tx.account.update({
      where: { id },
      data: {
        ...dataFrom(input, true),
        ...(input.ownerUserId !== undefined ? { ownerUserId: input.ownerUserId } : {}),
        ...(input.teamId !== undefined ? { teamId: input.teamId } : {}),
        ...(input.customFields !== undefined
          ? { customFields: (await sanitizeCustomFields("ACCOUNT", input.customFields, "update")) as never }
          : {}),
      } as Prisma.AccountUncheckedUpdateInput,
    });
    await appendActivity(tx, { subjectType: "ACCOUNT", subjectId: id, kind: "updated", actorUserId: ctx.userId });
    await appendAudit(tx, {
      actorId: ctx.userId,
      ip: ctx.ip,
      action: "ACCOUNT_UPDATED",
      objectType: "Account",
      objectId: id,
    });
    return saved;
  });
}

export async function softDeleteAccount(ctx: ScopedContext, id: string) {
  const existing = await prisma.account.findFirst({
    where: { id, deletedAt: null, ...ownerScopeWhere(ctx.userId, ctx.scope, ctx.teamIds) },
  });
  if (!existing) throw new CrmError("Account not found.", 404);
  await prisma.$transaction(async (tx) => {
    await tx.account.update({ where: { id }, data: { deletedAt: new Date() } });
    await appendActivity(tx, { subjectType: "ACCOUNT", subjectId: id, kind: "deleted", actorUserId: ctx.userId });
    await appendAudit(tx, {
      actorId: ctx.userId,
      ip: ctx.ip,
      action: "ACCOUNT_DELETED",
      objectType: "Account",
      objectId: id,
    });
  });
}
