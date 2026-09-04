import { prisma } from "../src/server/db";
import { CrmError } from "../src/server/guard";
import { createLead } from "../src/server/records/leads";
import type { ScopedContext } from "../src/server/records/leads";

/**
 * Shared test helpers: build ScopedContext values for each seeded role
 * WITHOUT HTTP — the services are the unit under test (authorization lives
 * there). Requires a seeded local database (npm run db:seed).
 */

export interface TestUser {
  ctx: ScopedContext;
  userId: string;
  cleanupIds: { leads: string[]; contacts: string[]; accounts: string[]; customers: string[]; opportunities: string[] };
}

async function contextFor(email: string): Promise<ScopedContext> {
  const user = await prisma.user.findUnique({
    where: { email },
    select: {
      id: true,
      name: true,
      status: true,
      role: { select: { key: true, scope: true, permissions: { select: { permission: true } } } },
    },
  });
  if (!user || user.status !== "ACTIVE") throw new Error(`Test user ${email} missing — run npm run db:seed`);
  return {
    userId: user.id,
    name: user.name,
    roleKey: user.role.key,
    scope: user.role.scope,
    permissions: user.role.permissions.map((entry) => entry.permission) as never,
    ip: "127.0.0.1",
    teamIds: [],
  };
}

export async function repContext(): Promise<ScopedContext> {
  const ctx = await contextFor("rep@crm.local");
  return { ...ctx, teamIds: await (await import("../src/server/scope")).visibleTeamIds(ctx.userId, ctx.scope) };
}

export async function rep2Context(): Promise<ScopedContext> {
  const ctx = await contextFor("rep2@crm.local");
  return { ...ctx, teamIds: await (await import("../src/server/scope")).visibleTeamIds(ctx.userId, ctx.scope) };
}

export async function managerContext(): Promise<ScopedContext> {
  const ctx = await contextFor("manager@crm.local");
  return { ...ctx, teamIds: await (await import("../src/server/scope")).visibleTeamIds(ctx.userId, ctx.scope) };
}

export async function viewerContext(): Promise<ScopedContext> {
  const ctx = await contextFor("viewer@crm.local");
  return { ...ctx, teamIds: await (await import("../src/server/scope")).visibleTeamIds(ctx.userId, ctx.scope) };
}

export async function adminContext(): Promise<ScopedContext> {
  const ctx = await contextFor("admin@crm.local");
  return { ...ctx, teamIds: await (await import("../src/server/scope")).visibleTeamIds(ctx.userId, ctx.scope) };
}

/** A throwaway lead assigned to the given context's user. */
export async function makeLead(ctx: ScopedContext, suffix: string): Promise<string> {
  const lead = await createLead(ctx, {
    firstName: "Test",
    lastName: `_${suffix}`,
    email: `test.${suffix}@example.com`,
    allowDuplicates: true,
  });
  return lead.id;
}

export async function assertThrows(
  fn: () => Promise<unknown>,
  status: number,
  label: string,
): Promise<void> {
  try {
    await fn();
  } catch (error) {
    if (error instanceof CrmError) {
      if (error.status !== status) {
        throw new Error(`${label}: expected ${status}, got ${error.status} (${error.message})`);
      }
      return;
    }
    throw error;
  }
  throw new Error(`${label}: expected CrmError ${status}, got success`);
}

export { prisma };
