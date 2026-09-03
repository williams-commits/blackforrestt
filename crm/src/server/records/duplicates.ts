import type { Prisma } from "@prisma/client";
import { prisma } from "@/server/db";
import { normalizeEmail, normalizePhone } from "@/server/normalize";
import { assignedScopeWhere, ownerScopeWhere } from "@/server/scope";
import type { ScopedContext } from "@/server/records/leads";

/**
 * Duplicate detection. Matches are exact comparisons on the NORMALIZED
 * dedup keys (email, phone, externalId) — the same normalization every
 * write path applies — so matching is stable across sources. Matches are
 * always scope-filtered: users never see records outside their visibility.
 */

export interface MatchInput {
  email?: string | null;
  phone?: string | null;
  externalId?: string | null;
  excludeLeadId?: string;
}

export interface DuplicateMatch {
  objectType: "LEAD" | "CONTACT" | "CUSTOMER";
  id: string;
  label: string;
  email: string | null;
  matchOn: string[];
}

function matchKeys(input: MatchInput): { email: string | null; phone: string | null; externalId: string | null } {
  return {
    email: normalizeEmail(input.email),
    phone: normalizePhone(input.phone),
    externalId: input.externalId?.trim() || null,
  };
}

/**
 * Search leads, contacts, and customers for records sharing any normalized
 * dedup key with the input. Returns empty lists when no keys are provided.
 */
export async function findMatches(
  ctx: ScopedContext,
  input: MatchInput,
): Promise<{ leads: DuplicateMatch[]; contacts: DuplicateMatch[]; customers: DuplicateMatch[] }> {
  const keys = matchKeys(input);
  if (!keys.email && !keys.phone && !keys.externalId) {
    return { leads: [], contacts: [], customers: [] };
  }

  const leadConditions: Prisma.LeadWhereInput[] = [];
  const contactConditions: Prisma.ContactWhereInput[] = [];
  const customerConditions: Prisma.CustomerWhereInput[] = [];
  if (keys.email) {
    const eq = { equals: keys.email, mode: "insensitive" as const };
    leadConditions.push({ email: eq });
    contactConditions.push({ email: eq });
    customerConditions.push({ email: eq });
  }
  if (keys.phone) {
    const eq = { equals: keys.phone };
    leadConditions.push({ phone: eq });
    contactConditions.push({ phone: eq });
    customerConditions.push({ phone: eq });
  }
  if (keys.externalId) {
    leadConditions.push({ externalId: keys.externalId });
    contactConditions.push({ externalId: keys.externalId });
    // Customer has no externalId column — it matches on email/phone only.
  }

  const [leadRows, contactRows, customerRows] = await Promise.all([
    prisma.lead.findMany({
      where: {
        deletedAt: null,
        ...(input.excludeLeadId ? { id: { not: input.excludeLeadId } } : {}),
        ...assignedScopeWhere(ctx.userId, ctx.scope, ctx.teamIds),
        OR: leadConditions,
      },
      select: { id: true, firstName: true, lastName: true, email: true, phone: true, externalId: true },
      take: 10,
    }),
    prisma.contact.findMany({
      where: {
        deletedAt: null,
        ...ownerScopeWhere(ctx.userId, ctx.scope, ctx.teamIds),
        OR: contactConditions,
      },
      select: { id: true, firstName: true, lastName: true, email: true, phone: true, externalId: true },
      take: 10,
    }),
    prisma.customer.findMany({
      where: {
        deletedAt: null,
        ...ownerScopeWhere(ctx.userId, ctx.scope, ctx.teamIds),
        OR: customerConditions,
      },
      select: { id: true, firstName: true, lastName: true, email: true, phone: true },
      take: 10,
    }),
  ]);

  const matchOnFor = (row: { email: string | null; phone: string | null; externalId?: string | null }) => {
    const on: string[] = [];
    if (keys.email && row.email?.toLowerCase() === keys.email) on.push("email");
    if (keys.phone && row.phone === keys.phone) on.push("phone");
    if (keys.externalId && row.externalId === keys.externalId) on.push("externalId");
    return on;
  };

  return {
    leads: leadRows.map((row) => ({
      objectType: "LEAD" as const,
      id: row.id,
      label: `${row.firstName} ${row.lastName}`,
      email: row.email,
      matchOn: matchOnFor(row),
    })),
    contacts: contactRows.map((row) => ({
      objectType: "CONTACT" as const,
      id: row.id,
      label: `${row.firstName} ${row.lastName}`,
      email: row.email,
      matchOn: matchOnFor(row),
    })),
    customers: customerRows.map((row) => ({
      objectType: "CUSTOMER" as const,
      id: row.id,
      label: `${row.firstName} ${row.lastName}`,
      email: row.email,
      matchOn: matchOnFor(row),
    })),
  };
}

/** True when any object type has at least one match. */
export function hasMatches(matches: Awaited<ReturnType<typeof findMatches>>): boolean {
  return matches.leads.length + matches.contacts.length + matches.customers.length > 0;
}
