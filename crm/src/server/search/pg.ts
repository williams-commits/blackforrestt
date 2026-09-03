import { prisma } from "@/server/db";
import { assignedScopeWhere, ownerScopeWhere } from "@/server/scope";
import type { ScopedContext } from "@/server/records/leads";
import type { SearchHit, SearchProvider } from "@/server/search/types";

/**
 * Postgres search provider: case-insensitive partial matching (ILIKE)
 * accelerated by pg_trgm GIN indexes (see the search_trgm migration).
 * Also matches record IDs for support workflows ("find by id suffix" is
 * not supported by design — exact/prefix id only).
 */

const contains = (q: string) => ({ contains: q, mode: "insensitive" as const });

export const pgSearch: SearchProvider = {
  async search(ctx: ScopedContext, query: string, perType: number): Promise<SearchHit[]> {
    const q = query.trim();
    if (q.length < 2) return [];
    const hits: SearchHit[] = [];
    const leadScope = assignedScopeWhere(ctx.userId, ctx.scope, ctx.teamIds);
    const ownerScope = ownerScopeWhere(ctx.userId, ctx.scope, ctx.teamIds);

    const [leads, contacts, accounts, customers, opportunities, tasks] = await Promise.all([
      prisma.lead.findMany({
        where: {
          deletedAt: null,
          convertedAt: null,
          ...leadScope,
          OR: [
            { firstName: contains(q) },
            { lastName: contains(q) },
            { email: contains(q) },
            { phone: contains(q) },
            { company: contains(q) },
            { externalId: contains(q) },
            { id: { startsWith: q } },
          ],
        },
        select: { id: true, firstName: true, lastName: true, email: true, company: true },
        take: perType,
        orderBy: { updatedAt: "desc" },
      }),
      prisma.contact.findMany({
        where: {
          deletedAt: null,
          ...ownerScope,
          OR: [
            { firstName: contains(q) },
            { lastName: contains(q) },
            { email: contains(q) },
            { jobTitle: contains(q) },
            { id: { startsWith: q } },
          ],
        },
        select: { id: true, firstName: true, lastName: true, email: true, jobTitle: true },
        take: perType,
        orderBy: { updatedAt: "desc" },
      }),
      prisma.account.findMany({
        where: {
          deletedAt: null,
          ...ownerScope,
          OR: [{ name: contains(q) }, { industry: contains(q) }, { city: contains(q) }, { id: { startsWith: q } }],
        },
        select: { id: true, name: true, industry: true, city: true },
        take: perType,
        orderBy: { updatedAt: "desc" },
      }),
      prisma.customer.findMany({
        where: {
          deletedAt: null,
          ...ownerScope,
          OR: [
            { firstName: contains(q) },
            { lastName: contains(q) },
            { email: contains(q) },
            { id: { startsWith: q } },
          ],
        },
        select: { id: true, firstName: true, lastName: true, email: true },
        take: perType,
        orderBy: { updatedAt: "desc" },
      }),
      prisma.opportunity.findMany({
        where: {
          deletedAt: null,
          ...ownerScope,
          OR: [{ name: contains(q) }, { source: contains(q) }, { id: { startsWith: q } }],
        },
        select: { id: true, name: true, stage: { select: { name: true } } },
        take: perType,
        orderBy: { updatedAt: "desc" },
      }),
      prisma.task.findMany({
        where: {
          ownerUserId: ctx.userId,
          status: { in: ["OPEN", "IN_PROGRESS"] },
          OR: [{ title: contains(q) }, { description: contains(q) }],
        },
        select: { id: true, title: true, dueAt: true },
        take: perType,
        orderBy: { updatedAt: "desc" },
      }),
    ]);

    for (const lead of leads) {
      hits.push({
        objectType: "LEAD",
        id: lead.id,
        label: `${lead.firstName} ${lead.lastName}`,
        subtitle: lead.company ?? lead.email ?? null,
        url: `/leads/${lead.id}`,
      });
    }
    for (const contact of contacts) {
      hits.push({
        objectType: "CONTACT",
        id: contact.id,
        label: `${contact.firstName} ${contact.lastName}`,
        subtitle: contact.jobTitle ?? contact.email ?? null,
        url: `/contacts/${contact.id}`,
      });
    }
    for (const account of accounts) {
      hits.push({
        objectType: "ACCOUNT",
        id: account.id,
        label: account.name,
        subtitle: [account.industry, account.city].filter(Boolean).join(" · ") || null,
        url: `/accounts/${account.id}`,
      });
    }
    for (const customer of customers) {
      hits.push({
        objectType: "CUSTOMER",
        id: customer.id,
        label: `${customer.firstName} ${customer.lastName}`,
        subtitle: customer.email,
        url: `/customers/${customer.id}`,
      });
    }
    for (const opportunity of opportunities) {
      hits.push({
        objectType: "OPPORTUNITY",
        id: opportunity.id,
        label: opportunity.name,
        subtitle: opportunity.stage?.name ?? null,
        url: `/opportunities/${opportunity.id}`,
      });
    }
    for (const task of tasks) {
      hits.push({
        objectType: "TASK",
        id: task.id,
        label: task.title,
        subtitle: task.dueAt ? `due ${task.dueAt.toLocaleDateString()}` : null,
        url: `/tasks`,
      });
    }
    return hits;
  },
};
