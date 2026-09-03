import { z } from "zod";
import { prisma } from "@/server/db";
import { CrmError } from "@/server/guard";
import { appendAudit } from "@/server/audit";
import { appendActivity } from "@/server/activity";
import { getLead, type ScopedContext } from "@/server/records/leads";
import { getContact } from "@/server/records/contacts";
import { getAccount } from "@/server/records/accounts";
import { getCustomer } from "@/server/records/customers";
import { findMatches } from "@/server/records/duplicates";

/**
 * Lead conversion. A qualified lead becomes a contact (optionally a
 * customer, optionally a new account from its company field) in ONE
 * transaction. History policy:
 *
 *  - Timeline events STAY on the lead — the lead remains fully visible with
 *    a converted banner; the contact gets a conversion event linking back.
 *    Copying events would falsify the record; re-pointing would mutate an
 *    append-only table.
 *  - Open tasks and notes FOLLOW the person: tasks are live work items and
 *    notes describe the person, so their subject reference is re-pointed to
 *    the contact (content untouched), each move audit-logged.
 */

export const ConvertLead = z.object({
  contact: z.discriminatedUnion("mode", [
    z.object({ mode: z.literal("create") }),
    z.object({ mode: z.literal("link"), contactId: z.string().min(5) }),
  ]),
  customer: z.discriminatedUnion("mode", [
    z.object({ mode: z.literal("none") }),
    z.object({ mode: z.literal("create") }),
    z.object({ mode: z.literal("link"), customerId: z.string().min(5) }),
  ]),
  account: z.discriminatedUnion("mode", [
    z.object({ mode: z.literal("none") }),
    z.object({ mode: z.literal("create") }),
    z.object({ mode: z.literal("link"), accountId: z.string().min(5) }),
  ]),
  opportunity: z.discriminatedUnion("mode", [
    z.object({ mode: z.literal("none") }),
    z.object({ mode: z.literal("create") }),
  ]),
  force: z.boolean().optional(),
});

export type ConvertLeadInput = z.infer<typeof ConvertLead>;

/** Pre-flight: lead state + duplicate matches against contacts/customers. */
export async function conversionPreview(ctx: ScopedContext, leadId: string) {
  const lead = await getLead(ctx, leadId);
  if (lead.convertedAt) {
    throw new CrmError("Lead is already converted.", 409, {
      converted: true,
      contactId: lead.convertedContactId,
      customerId: lead.convertedCustomerId,
    });
  }
  const matches = await findMatches(ctx, {
    email: lead.email,
    phone: lead.phone,
    externalId: lead.externalId,
    excludeLeadId: lead.id,
  });
  return {
    lead: {
      id: lead.id,
      firstName: lead.firstName,
      lastName: lead.lastName,
      company: lead.company,
      email: lead.email,
      phone: lead.phone,
    },
    matches: { contacts: matches.contacts, customers: matches.customers },
  };
}

export async function convertLead(ctx: ScopedContext, leadId: string, input: ConvertLeadInput) {
  const lead = await getLead(ctx, leadId);
  if (lead.convertedAt) {
    throw new CrmError("Lead is already converted.", 409);
  }

  // Duplicate guard on NEW contacts: linking an existing record is the
  // dedup path; creating requires either a clean field or an explicit force.
  if (input.contact.mode === "create" && !input.force) {
    const matches = await findMatches(ctx, {
      email: lead.email,
      phone: lead.phone,
      excludeLeadId: lead.id,
    });
    if (matches.contacts.length > 0 || matches.customers.length > 0) {
      throw new CrmError("Possible duplicates found — link an existing record or confirm to create anyway.", 409, {
        matches,
      });
    }
  }

  const convertedStatus = await prisma.recordStatus.findFirst({
    where: { appliesTo: "LEAD", name: "Converted" },
  });
  if (!convertedStatus) {
    throw new CrmError("No 'Converted' lead status configured — seed the database.", 400);
  }
  const contactDefaultStatus = await prisma.recordStatus.findFirst({
    where: { appliesTo: "CONTACT", isDefault: true },
  });
  const customerDefaultStatus = await prisma.recordStatus.findFirst({
    where: { appliesTo: "CUSTOMER", isDefault: true },
  });

  // Resolve link targets up-front (scope-checked, 404 when invisible).
  let linkedAccount: Awaited<ReturnType<typeof getAccount>> | null = null;
  if (input.account.mode === "link") {
    linkedAccount = await getAccount(ctx, input.account.accountId);
  }
  let linkedContact: Awaited<ReturnType<typeof getContact>> | null = null;
  if (input.contact.mode === "link") {
    linkedContact = await getContact(ctx, input.contact.contactId);
  }
  let linkedCustomer: Awaited<ReturnType<typeof getCustomer>> | null = null;
  if (input.customer.mode === "link") {
    linkedCustomer = await getCustomer(ctx, input.customer.customerId);
  }
  if (input.account.mode === "create" && !lead.company) {
    throw new CrmError("Cannot create an account: the lead has no company.", 400);
  }

  const result = await prisma.$transaction(async (tx) => {
    // Re-check inside the transaction — a concurrent conversion must lose.
    const fresh = await tx.lead.findUnique({ where: { id: lead.id }, select: { convertedAt: true } });
    if (fresh?.convertedAt) throw new CrmError("Lead is already converted.", 409);

    const ownerUserId = lead.assignedUserId ?? ctx.userId;

    let accountId: string | null = linkedAccount?.id ?? null;
    if (input.account.mode === "create" && lead.company) {
      const account = await tx.account.create({
        data: { name: lead.company, ownerUserId, teamId: lead.assignedTeamId },
      });
      await appendActivity(tx, {
        subjectType: "ACCOUNT",
        subjectId: account.id,
        kind: "created",
        actorUserId: ctx.userId,
        payload: { from: "LEAD", leadId: lead.id },
      });
      accountId = account.id;
    }

    let contactId = linkedContact?.id ?? null;
    if (input.contact.mode === "create") {
      const contact = await tx.contact.create({
        data: {
          firstName: lead.firstName,
          lastName: lead.lastName,
          email: lead.email,
          phone: lead.phone,
          accountId,
          leadSource: lead.source,
          campaignId: lead.campaignId,
          statusId: contactDefaultStatus?.id,
          ownerUserId,
          teamId: lead.assignedTeamId,
        },
      });
      await appendActivity(tx, {
        subjectType: "CONTACT",
        subjectId: contact.id,
        kind: "created",
        actorUserId: ctx.userId,
        payload: { from: "LEAD", leadId: lead.id, label: `${lead.firstName} ${lead.lastName}` },
      });
      contactId = contact.id;
    }

    let customerId = linkedCustomer?.id ?? null;
    if (input.customer.mode === "create" && contactId) {
      const customer = await tx.customer.create({
        data: {
          firstName: lead.firstName,
          lastName: lead.lastName,
          email: lead.email,
          phone: lead.phone,
          contactId,
          source: "CONVERSION",
          campaignId: lead.campaignId,
          statusId: customerDefaultStatus?.id,
          ownerUserId,
          teamId: lead.assignedTeamId,
        },
      });
      await appendActivity(tx, {
        subjectType: "CUSTOMER",
        subjectId: customer.id,
        kind: "created",
        actorUserId: ctx.userId,
        payload: { from: "LEAD", leadId: lead.id },
      });
      customerId = customer.id;
    }

    // Open tasks and notes follow the person (content untouched).
    let movedTasks = 0;
    let movedNotes = 0;
    if (contactId) {
      movedTasks = (
        await tx.task.updateMany({
          where: { subjectType: "LEAD", subjectId: lead.id, status: { in: ["OPEN", "IN_PROGRESS"] } },
          data: { subjectType: "CONTACT", subjectId: contactId },
        })
      ).count;
      movedNotes = (
        await tx.note.updateMany({
          where: { subjectType: "LEAD", subjectId: lead.id },
          data: { subjectType: "CONTACT", subjectId: contactId },
        })
      ).count;
    }

    // Optional opportunity in the default pipeline's first open stage.
    let opportunityId: string | null = null;
    if (input.opportunity.mode === "create") {
      const pipeline =
        (await tx.pipeline.findFirst({ where: { isDefault: true } })) ??
        (await tx.pipeline.findFirst({ orderBy: { createdAt: "asc" } }));
      if (!pipeline) throw new CrmError("No pipeline configured for opportunities.", 400);
      const stage = await tx.pipelineStage.findFirst({
        where: { pipelineId: pipeline.id, type: "OPEN" },
        orderBy: { sortOrder: "asc" },
      });
      if (!stage) throw new CrmError("Default pipeline has no open stage.", 400);
      const opportunity = await tx.opportunity.create({
        data: {
          name: lead.company ? `${lead.company} — ${lead.lastName}` : `${lead.firstName} ${lead.lastName}`,
          accountId,
          contactId,
          customerId,
          ownerUserId: lead.assignedUserId ?? ctx.userId,
          teamId: lead.assignedTeamId,
          pipelineId: pipeline.id,
          stageId: stage.id,
          source: lead.source,
          probability: stage.probability,
        },
      });
      opportunityId = opportunity.id;
      await appendActivity(tx, {
        subjectType: "OPPORTUNITY",
        subjectId: opportunity.id,
        kind: "created",
        actorUserId: ctx.userId,
        payload: { from: "LEAD", leadId: lead.id },
      });
    }

    await tx.lead.update({
      where: { id: lead.id },
      data: {
        convertedContactId: contactId,
        convertedCustomerId: customerId,
        convertedOpportunityId: opportunityId,
        convertedAt: new Date(),
        statusId: convertedStatus.id,
      },
    });
    await appendActivity(tx, {
      subjectType: "LEAD",
      subjectId: lead.id,
      kind: "converted",
      actorUserId: ctx.userId,
      payload: { contactId, customerId, accountId, opportunityId },
    });
    await appendAudit(tx, {
      actorId: ctx.userId,
      action: "LEAD_CONVERTED",
      objectType: "Lead",
      objectId: lead.id,
      after: { contactId, customerId, accountId, opportunityId, movedTasks, movedNotes },
    });

    return { contactId, customerId, accountId, opportunityId };
  });

  return result;
}
