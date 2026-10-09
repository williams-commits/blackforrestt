import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/server/db";
import { assignedScopeWhere, ownerScopeWhere } from "@/server/scope";
import { scopedContext } from "@/server/records/leads";
import { tradeActivationSummary } from "@/server/platformBridge";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Query = z.object({ days: z.coerce.number().int().min(7).max(365).default(30) });

/** How many linked platform ids one report run will consider. Beyond this
 *  the report is explicitly marked truncated rather than quietly wrong. */
const MAX_LINKED_IDS = 1000;
const TRADE_CHUNK = 500;

/**
 * Unified reporting foundation — the ONE composed report: customer
 * conversion → trading activation. CRM owns every CRM number (scoped by
 * the actor exactly like the dashboard); trading numbers come from the
 * Trade side's aggregated bridge endpoint in at most ⌈ids/500⌉ calls —
 * never per-customer. When the bridge is down the CRM half still renders
 * and `trade.available` is false; nothing is invented.
 */
export async function GET(request: Request) {
  try {
    const ctx = await scopedContext("REPORTS_VIEW");
    const parsed = Query.safeParse(Object.fromEntries(new URL(request.url).searchParams));
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid reporting window." }, { status: 400 });
    }
    const days = parsed.data.days;
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const leadScope = assignedScopeWhere(ctx.userId, ctx.scope, ctx.teamIds);

    const [leadsCreated, converted, linkedCustomers] = await Promise.all([
      prisma.lead.count({
        where: { deletedAt: null, createdAt: { gte: since }, ...leadScope },
      }),
      prisma.lead.count({
        where: { deletedAt: null, convertedAt: { gte: since }, ...leadScope },
      }),
      prisma.customer.findMany({
        where: { deletedAt: null, platformUserId: { not: null }, ...ownerScopeWhere(ctx.userId, ctx.scope, ctx.teamIds) },
        select: { platformUserId: true },
      }),
    ]);

    const linkedIds = linkedCustomers
      .map((customer) => customer.platformUserId!)
      .filter(Boolean);
    const truncated = linkedIds.length > MAX_LINKED_IDS;
    const considered = truncated ? linkedIds.slice(0, MAX_LINKED_IDS) : linkedIds;

    let trade: {
      available: boolean;
      matchedAccounts?: number;
      deposited?: number;
      activeTraders?: number;
      volumeLots?: string;
      commissionRevenue?: string;
    } = { available: false };

    if (considered.length > 0) {
      const chunks: string[][] = [];
      for (let i = 0; i < considered.length; i += TRADE_CHUNK) {
        chunks.push(considered.slice(i, i + TRADE_CHUNK));
      }
      const results = await Promise.all(chunks.map((chunk) => tradeActivationSummary(chunk, since)));
      if (results.every((result): result is NonNullable<typeof result> => result !== null)) {
        const merged = results.reduce(
          (acc, result) => ({
            matchedAccounts: acc.matchedAccounts + result.matchedAccounts,
            deposited: acc.deposited + result.deposited,
            activeTraders: acc.activeTraders + result.activeTraders,
            volumeLots: (Number(acc.volumeLots) + Number(result.volumeLots)).toFixed(2),
            commissionRevenue: (Number(acc.commissionRevenue) + Number(result.commissionRevenue)).toFixed(2),
          }),
          { matchedAccounts: 0, deposited: 0, activeTraders: 0, volumeLots: "0", commissionRevenue: "0" },
        );
        trade = { available: true, ...merged };
      }
    }

    return NextResponse.json({
      data: {
        days,
        crm: {
          leadsCreated,
          converted,
          linkedAccounts: considered.length,
          linkedTruncated: truncated,
        },
        trade,
        generatedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    const status = (error as { status?: number }).status ?? 500;
    if (status === 401 || status === 403) {
      return NextResponse.json({ error: "Not allowed." }, { status: 403 });
    }
    return NextResponse.json({ error: "Unable to load the unified report." }, { status: 500 });
  }
}
