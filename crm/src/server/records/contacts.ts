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

/** Contact service — owner-keyed records linked to accounts. */

export const CreateContact = z.object({
  firstName: z.string().trim().min(1).max(80),
  lastName: z.string().trim().min(1).max(80),
  email: z.string().trim().email().max(200).optional().nullable(),
  phone: z.string().trim().max(40).optional().nullable(),
  jobTitle: z.string().trim().max(120).optional().nullable(),
  accountId: z.string().trim().min(5).optional().nullable(),
  leadSource: z.string().trim().max(60).optional().nullable(),
  campaignId: z.string().trim().min(5).optional().nullable(),
  statusId: z.string().trim().min(5).optional(),
  externalId: z.string().trim().min(2).max(120).optional().nullable(),
  ownerUserId: z.string().trim().min(5).optional().nullable(),
  teamId: z.string().trim().min(5).optional().nullable(),
  customFields: z.record(z.unknown()).optional().nullable(),
});

export const UpdateContact = CreateContact.partial();

const SORTS = {
  createdAt: { createdAt: "desc" as const },
  name: { lastName: "asc" as const },
  email: { email: "asc" as const },
};
const SEARCH_FIELDS = ["firstName", "lastName", "email", "phone", "jobTitle"] as const;

const include = {
  account: { select: { id: true, name: true } },
  owner: { select: { id: true, name: true } },
  status: { select: { id: true, name: true } },
} satisfies Prisma.ContactInclude;

export async function listContacts(
  ctx: ScopedContext,
  query: { page: number; pageSize: number; sort?: string; q?: string },
  filters: { accountId?: string; statusId?: string },
) {
  const where: Prisma.ContactWhereInput = {
    deletedAt: null,
    ...ownerScopeWhere(ctx.userId, ctx.scope, ctx.teamIds),
    ...(filters.accountId ? { accountId: filters.accountId } : {}),
    ...(filters.statusId ? { statusId: filters.statusId } : {}),
    ...searchWhere(SEARCH_FIELDS, query.q ?? ""),
  };
  const [total, rows] = await Promise.all([
    prisma.contact.count({ where }),
    prisma.contact.findMany({
      where,
      include,
      orderBy: orderByFor(query.sort, SORTS, "createdAt"),
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
    }),
  ]);
  return { total, rows };
}

export async function getContact(ctx: ScopedContext, id: string) {
  const contact = await prisma.contact.findFirst({
    where: { id, deletedAt: null, ...ownerScopeWhere(ctx.userId, ctx.scope, ctx.teamIds) },
    include: {
      ...include,
      team: { select: { id: true, name: true } },
    },
  });
  if (!contact) throw new CrmError("Contact not found.", 404);
  return contact;
}

export async function createContact(ctx: ScopedContext, input: z.infer<typeof CreateContact>) {
  const defaultStatus = await prisma.recordStatus.findFirst({
    where: { appliesTo: "CONTACT", isDefault: true },
  });
  const status = input.statusId
    ? await prisma.recordStatus.findFirst({ where: { id: input.statusId, appliesTo: "CONTACT" } })
    : defaultStatus;
  if (input.statusId && !status) throw new CrmError("Invalid contact status.", 400);
  if (input.accountId) {
    const account = await prisma.account.findFirst({ where: { id: input.accountId, deletedAt: null } });
    if (!account) throw new CrmError("Account not found.", 400);
  }
  // Owner defaults to the actor; non-privileged users always own their records.
  const ownerUserId = input.ownerUserId ?? ctx.userId;
  return prisma.$transaction(async (tx) => {
    const created = await tx.contact.create({
      data: {
        firstName: input.firstName,
        lastName: input.lastName,
        email: normalizeEmail(input.email),
        phone: normalizePhone(input.phone),
        jobTitle: normalizeText(input.jobTitle),
        accountId: input.accountId ?? null,
        leadSource: normalizeText(input.leadSource),
        campaignId: input.campaignId ?? null,
        statusId: status?.id,
        externalId: normalizeText(input.externalId),
        ownerUserId,
        teamId: input.teamId ?? null,
        customFields: (await sanitizeCustomFields("CONTACT", input.customFields, "create")) as never,
      } as Prisma.ContactUncheckedCreateInput,
    });
    await appendActivity(tx, {
      subjectType: "CONTACT",
      subjectId: created.id,
      kind: "created",
      actorUserId: ctx.userId,
    });
    await appendAudit(tx, {
      actorId: ctx.userId,
      action: "CONTACT_CREATED",
      objectType: "Contact",
      objectId: created.id,
      after: { name: `${created.firstName} ${created.lastName}` },
    });
    return created;
  });
}

export async function updateContact(ctx: ScopedContext, id: string, input: z.infer<typeof UpdateContact>) {
  const existing = await prisma.contact.findFirst({
    where: { id, deletedAt: null, ...ownerScopeWhere(ctx.userId, ctx.scope, ctx.teamIds) },
  });
  if (!existing) throw new CrmError("Contact not found.", 404);
  const status = input.statusId
    ? await prisma.recordStatus.findFirst({ where: { id: input.statusId, appliesTo: "CONTACT" } })
    : undefined;
  if (input.statusId && !status) throw new CrmError("Invalid contact status.", 400);

  return prisma.$transaction(async (tx) => {
    const saved = await tx.contact.update({
      where: { id },
      data: {
        ...(input.firstName !== undefined ? { firstName: input.firstName } : {}),
        ...(input.lastName !== undefined ? { lastName: input.lastName } : {}),
        ...(input.email !== undefined ? { email: normalizeEmail(input.email) } : {}),
        ...(input.phone !== undefined ? { phone: normalizePhone(input.phone) } : {}),
        ...(input.jobTitle !== undefined ? { jobTitle: normalizeText(input.jobTitle) } : {}),
        ...(input.accountId !== undefined ? { accountId: input.accountId } : {}),
        ...(input.leadSource !== undefined ? { leadSource: normalizeText(input.leadSource) } : {}),
        ...(input.campaignId !== undefined ? { campaignId: input.campaignId } : {}),
        ...(status ? { statusId: status.id } : {}),
        ...(input.externalId !== undefined ? { externalId: normalizeText(input.externalId) } : {}),
        ...(input.ownerUserId !== undefined ? { ownerUserId: input.ownerUserId } : {}),
        ...(input.teamId !== undefined ? { teamId: input.teamId } : {}),
        ...(input.customFields !== undefined
          ? { customFields: (await sanitizeCustomFields("CONTACT", input.customFields, "update")) as never }
          : {}),
      } as Prisma.ContactUncheckedUpdateInput,
    });
    if (status && status.id !== existing.statusId) {
      await appendActivity(tx, {
        subjectType: "CONTACT",
        subjectId: id,
        kind: "status_changed",
        actorUserId: ctx.userId,
        payload: { to: status.name },
      });
    }
    await appendActivity(tx, { subjectType: "CONTACT", subjectId: id, kind: "updated", actorUserId: ctx.userId });
    await appendAudit(tx, {
      actorId: ctx.userId,
      action: "CONTACT_UPDATED",
      objectType: "Contact",
      objectId: id,
    });
    return saved;
  });
}

export async function softDeleteContact(ctx: ScopedContext, id: string) {
  const existing = await prisma.contact.findFirst({
    where: { id, deletedAt: null, ...ownerScopeWhere(ctx.userId, ctx.scope, ctx.teamIds) },
  });
  if (!existing) throw new CrmError("Contact not found.", 404);
  await prisma.$transaction(async (tx) => {
    await tx.contact.update({ where: { id }, data: { deletedAt: new Date() } });
    await appendActivity(tx, { subjectType: "CONTACT", subjectId: id, kind: "deleted", actorUserId: ctx.userId });
    await appendAudit(tx, {
      actorId: ctx.userId,
      action: "CONTACT_DELETED",
      objectType: "Contact",
      objectId: id,
    });
  });
}
