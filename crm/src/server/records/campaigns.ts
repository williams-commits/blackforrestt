import { z } from "zod";
import { prisma } from "@/server/db";
import { CrmError } from "@/server/guard";
import { appendAudit } from "@/server/audit";
import type { ScopedContext } from "@/server/records/leads";

/**
 * Campaign service. Campaigns group leads/contacts/customers for
 * attribution; members are scope-checked on every add so a campaign never
 * leaks record existence across data scopes.
 */

const CampaignStatuses = ["DRAFT", "ACTIVE", "PAUSED", "COMPLETED"] as const;

export const CreateCampaign = z.object({
  name: z.string().trim().min(2).max(120),
  description: z.string().trim().max(2000).optional().nullable(),
  source: z.string().trim().max(60).optional().nullable(),
  status: z.enum(CampaignStatuses).default("DRAFT"),
  startsAt: z.coerce.date().optional().nullable(),
  endsAt: z.coerce.date().optional().nullable(),
});

export const UpdateCampaign = CreateCampaign.partial();

/** Owner-visible user set for the actor's scope (campaigns have owner only). */
async function visibleOwnerIds(ctx: ScopedContext): Promise<string[] | null> {
  if (ctx.scope === "ORG") return null;
  if (ctx.scope === "OWN") return [ctx.userId];
  if (ctx.teamIds.length === 0) return [ctx.userId];
  const memberships = await prisma.teamMembership.findMany({
    where: { teamId: { in: ctx.teamIds } },
    select: { userId: true },
  });
  return [...new Set([ctx.userId, ...memberships.map((m) => m.userId)])];
}

export async function listCampaigns(ctx: ScopedContext) {
  const ownerIds = await visibleOwnerIds(ctx);
  const campaigns = await prisma.campaign.findMany({
    where: ownerIds ? { ownerUserId: { in: ownerIds } } : undefined,
    orderBy: { createdAt: "desc" },
    include: {
      owner: { select: { id: true, name: true } },
      _count: { select: { members: true, leads: true, contacts: true, customers: true } },
    },
  });
  return campaigns.map((campaign) => ({
    ...campaign,
    memberCount: campaign._count.members,
  }));
}

export async function getCampaign(ctx: ScopedContext, id: string) {
  const ownerIds = await visibleOwnerIds(ctx);
  const campaign = await prisma.campaign.findFirst({
    where: { id, ...(ownerIds ? { ownerUserId: { in: ownerIds } } : {}) },
    include: { owner: { select: { id: true, name: true } } },
  });
  if (!campaign) throw new CrmError("Campaign not found.", 404);
  const members = await prisma.campaignMember.findMany({
    where: { campaignId: id },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
  // Resolve member labels per subject type.
  const labels = new Map<string, string>();
  const leadIds = members.filter((m) => m.subjectType === "LEAD").map((m) => m.subjectId);
  const contactIds = members.filter((m) => m.subjectType === "CONTACT").map((m) => m.subjectId);
  const customerIds = members.filter((m) => m.subjectType === "CUSTOMER").map((m) => m.subjectId);
  await Promise.all([
    leadIds.length
      ? prisma.lead.findMany({ where: { id: { in: leadIds } }, select: { id: true, firstName: true, lastName: true } })
          .then((rows) => rows.forEach((row) => labels.set(row.id, `${row.firstName} ${row.lastName}`)))
      : null,
    contactIds.length
      ? prisma.contact.findMany({ where: { id: { in: contactIds } }, select: { id: true, firstName: true, lastName: true } })
          .then((rows) => rows.forEach((row) => labels.set(row.id, `${row.firstName} ${row.lastName}`)))
      : null,
    customerIds.length
      ? prisma.customer.findMany({ where: { id: { in: customerIds } }, select: { id: true, firstName: true, lastName: true } })
          .then((rows) => rows.forEach((row) => labels.set(row.id, `${row.firstName} ${row.lastName}`)))
      : null,
  ]);
  return {
    ...campaign,
    members: members.map((member) => ({
      id: member.id,
      subjectType: member.subjectType,
      subjectId: member.subjectId,
      status: member.status,
      respondedAt: member.respondedAt,
      label: labels.get(member.subjectId) ?? "(record no longer visible)",
    })),
    stats: {
      total: members.length,
      responded: members.filter((member) => member.respondedAt !== null).length,
      byType: {
        LEAD: members.filter((member) => member.subjectType === "LEAD").length,
        CONTACT: members.filter((member) => member.subjectType === "CONTACT").length,
        CUSTOMER: members.filter((member) => member.subjectType === "CUSTOMER").length,
      },
    },
  };
}

export async function createCampaign(ctx: ScopedContext, input: z.infer<typeof CreateCampaign>) {
  const campaign = await prisma.$transaction(async (tx) => {
    const created = await tx.campaign.create({
      data: { ...input, ownerUserId: ctx.userId },
    });
    await appendAudit(tx, {
      actorId: ctx.userId,
      action: "CAMPAIGN_CREATED",
      objectType: "Campaign",
      objectId: created.id,
      after: { name: created.name },
    });
    return created;
  });
  return campaign;
}

export async function updateCampaign(
  ctx: ScopedContext,
  id: string,
  input: z.infer<typeof UpdateCampaign>,
) {
  const ownerIds = await visibleOwnerIds(ctx);
  const existing = await prisma.campaign.findFirst({
    where: { id, ...(ownerIds ? { ownerUserId: { in: ownerIds } } : {}) },
  });
  if (!existing) throw new CrmError("Campaign not found.", 404);
  return prisma.$transaction(async (tx) => {
    const saved = await tx.campaign.update({
      where: { id },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.description !== undefined ? { description: input.description } : {}),
        ...(input.source !== undefined ? { source: input.source } : {}),
        ...(input.status !== undefined ? { status: input.status } : {}),
        ...(input.startsAt !== undefined ? { startsAt: input.startsAt } : {}),
        ...(input.endsAt !== undefined ? { endsAt: input.endsAt } : {}),
      },
    });
    await appendAudit(tx, {
      actorId: ctx.userId,
      action: "CAMPAIGN_UPDATED",
      objectType: "Campaign",
      objectId: id,
      after: { name: saved.name, status: saved.status },
    });
    return saved;
  });
}

export async function deleteCampaign(ctx: ScopedContext, id: string) {
  const ownerIds = await visibleOwnerIds(ctx);
  const existing = await prisma.campaign.findFirst({
    where: { id, ...(ownerIds ? { ownerUserId: { in: ownerIds } } : {}) },
  });
  if (!existing) throw new CrmError("Campaign not found.", 404);
  const [leads, contacts, customers] = await Promise.all([
    prisma.lead.count({ where: { campaignId: id, deletedAt: null } }),
    prisma.contact.count({ where: { campaignId: id, deletedAt: null } }),
    prisma.customer.count({ where: { campaignId: id, deletedAt: null } }),
  ]);
  const referenced = leads + contacts + customers;
  if (referenced > 0) {
    throw new CrmError(
      `Campaign is the source of ${referenced} record(s) — clear the campaign field on those records first.`,
      400,
    );
  }
  await prisma.$transaction(async (tx) => {
    await tx.campaign.delete({ where: { id } }); // members cascade
    await appendAudit(tx, {
      actorId: ctx.userId,
      action: "CAMPAIGN_DELETED",
      objectType: "Campaign",
      objectId: id,
      before: { name: existing.name },
    });
  });
}

export const AddMember = z.object({
  subjectType: z.enum(["LEAD", "CONTACT", "CUSTOMER"]),
  subjectId: z.string().min(5),
});

export async function addMember(ctx: ScopedContext, campaignId: string, input: z.infer<typeof AddMember>) {
  const campaign = await getCampaign(ctx, campaignId);
  // Scope-check the subject itself.
  const { resolveSubject } = await import("@/server/records/subjects");
  // CONTACT/CUSTOMER/LEAD all resolve with scope enforcement.
  const subject = await resolveSubject(ctx, input.subjectType, input.subjectId);
  return prisma.campaignMember.upsert({
    where: {
      campaignId_subjectType_subjectId: {
        campaignId: campaign.id,
        subjectType: input.subjectType,
        subjectId: input.subjectId,
      },
    },
    create: { campaignId: campaign.id, subjectType: subject.type, subjectId: subject.id },
    update: {},
  });
}

export async function removeMember(ctx: ScopedContext, campaignId: string, memberId: string) {
  const campaign = await getCampaign(ctx, campaignId);
  await prisma.campaignMember.deleteMany({ where: { id: memberId, campaignId: campaign.id } });
}
