import { z } from "zod";
import { prisma } from "@/server/db";
import { CrmError } from "@/server/guard";
import { appendAudit } from "@/server/audit";
import { appendActivity } from "@/server/activity";
import { normalizeEmail } from "@/server/normalize";
import type { ScopedContext } from "@/server/records/leads";
import { getCustomer as fetchCustomer } from "@/server/records/customers";

/**
 * Trading-platform bridge. The CRM NEVER writes to the platform database —
 * this module is the single read-only doorway: user lookup for
 * operator-confirmed linking, and the client-360 payload rendered on the
 * customer page. Every call degrades gracefully when the bridge is not
 * configured or the platform is unreachable.
 */

function bridgeConfig() {
  const url = process.env.PLATFORM_BRIDGE_URL?.replace(/\/$/, "");
  const token = process.env.PLATFORM_BRIDGE_TOKEN;
  return { url, token, enabled: Boolean(url && token) };
}

async function bridgeFetch(path: string): Promise<Response | null> {
  const { url, token, enabled } = bridgeConfig();
  if (!enabled) return null;
  try {
    return await fetch(`${url}${path}`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(4000),
    });
  } catch {
    return null; // platform unreachable — degrade, never crash the page
  }
}

export interface PlatformUserSummary {
  platformUserId: string;
  email: string | null;
  name: string | null;
  registeredAt: string;
  emailVerified: boolean;
}

export interface Client360 {
  user: {
    id: string;
    email: string | null;
    name: string | null;
    registeredAt: string;
    state: string;
    emailVerified: boolean;
  };
  kyc: { status: string; submittedAt: string | null; reviewedAt: string | null } | null;
  wallets: Array<{ asset: string; free: string; locked: string }>;
  payments: Array<{
    id: string;
    type: string;
    status: string;
    amount: string;
    asset: string;
    createdAt: string;
  }>;
  openPositions: number;
}

/** Look up a platform user by email (read-only, for link confirmation). */
export async function lookupPlatformUser(
  ctx: ScopedContext,
  email: string,
): Promise<{ found: false; reason: "disabled" | "unreachable" | "not-found" } | { found: true; user: PlatformUserSummary }> {
  const normalized = normalizeEmail(email);
  if (!normalized) throw new CrmError("A valid email is required.", 400);
  const response = await bridgeFetch(
    `/api/internal/crm/lookup?email=${encodeURIComponent(normalized)}`,
  );
  if (response === null) {
    return { found: false, reason: bridgeConfig().enabled ? "unreachable" : "disabled" };
  }
  if (response.status === 404) return { found: false, reason: "not-found" };
  if (!response.ok) {
    throw new CrmError("Platform bridge rejected the lookup.", 502);
  }
  const body = (await response.json()) as { data: PlatformUserSummary };
  return { found: true, user: body.data };
}

/** Fetch the client-360 payload for a linked customer; null when degraded. */
export async function client360(platformUserId: string): Promise<Client360 | null> {
  const response = await bridgeFetch(
    `/api/internal/crm/client-360?platformUserId=${encodeURIComponent(platformUserId)}`,
  );
  if (response === null || !response.ok) return null;
  const body = (await response.json()) as { data: Client360 };
  return body.data;
}

export const LinkCustomer = z.object({
  platformUserId: z.string().trim().min(5).max(64),
  /** Operator confirmation: the platform user's email must match this. */
  confirmedEmail: z.string().trim().email(),
});

export async function linkCustomerToPlatform(
  ctx: ScopedContext,
  customerId: string,
  input: z.infer<typeof LinkCustomer>,
) {
  const customer = await fetchCustomer(ctx, customerId);
  if (customer.platformUserId) {
    throw new CrmError("Customer is already linked to a platform user.", 409);
  }
  // The operator must confirm against a LIVE platform lookup — never trust
  // a pasted ID blindly.
  const lookup = await lookupPlatformUser(ctx, input.confirmedEmail);
  if (!lookup.found) {
    throw new CrmError(
      lookup.reason === "not-found"
        ? "No platform user with that email."
        : "Platform bridge unavailable — try again later.",
      lookup.reason === "not-found" ? 404 : 503,
    );
  }
  if (lookup.user.platformUserId !== input.platformUserId) {
    throw new CrmError("Platform user does not match the confirmed email.", 400);
  }
  const existingLink = await prisma.customer.findFirst({
    where: { platformUserId: input.platformUserId, deletedAt: null },
    select: { id: true },
  });
  if (existingLink) {
    throw new CrmError("Another customer is already linked to this platform user.", 409);
  }

  await prisma.$transaction(async (tx) => {
    await tx.customer.update({
      where: { id: customerId },
      data: { platformUserId: input.platformUserId },
    });
    await appendActivity(tx, {
      subjectType: "CUSTOMER",
      subjectId: customerId,
      kind: "updated",
      actorUserId: ctx.userId,
      payload: { platformLinked: true, platformEmail: lookup.user.email },
    });
    await appendAudit(tx, {
      actorId: ctx.userId,
      action: "CUSTOMER_PLATFORM_LINKED",
      objectType: "Customer",
      objectId: customerId,
      after: { platformUserId: input.platformUserId, platformEmail: lookup.user.email },
    });
  });
  return { platformUserId: input.platformUserId };
}

export async function unlinkCustomerFromPlatform(ctx: ScopedContext, customerId: string) {
  const customer = await fetchCustomer(ctx, customerId);
  if (!customer.platformUserId) {
    throw new CrmError("Customer is not linked.", 400);
  }
  await prisma.$transaction(async (tx) => {
    await tx.customer.update({ where: { id: customerId }, data: { platformUserId: null } });
    await appendActivity(tx, {
      subjectType: "CUSTOMER",
      subjectId: customerId,
      kind: "updated",
      actorUserId: ctx.userId,
      payload: { platformLinked: false },
    });
    await appendAudit(tx, {
      actorId: ctx.userId,
      action: "CUSTOMER_PLATFORM_UNLINKED",
      objectType: "Customer",
      objectId: customerId,
      before: { platformUserId: customer.platformUserId },
    });
  });
}
