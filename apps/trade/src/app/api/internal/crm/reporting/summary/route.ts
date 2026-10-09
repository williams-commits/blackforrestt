import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/server/db";
import { requireBridgeToken } from "@/server/crmBridge";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * CRM bridge: aggregated reporting summary for a set of linked platform
 * users — the trading half of the unified conversion→activation funnel.
 * ONE request for the whole id set (no N+1 across the bridge): counts and
 * sums are computed with `userId IN (...)` aggregates on this side.
 *
 * Read-only, token-gated, capped at 500 ids per call (the CRM chunks).
 */

const SummaryRequest = z.object({
  platformUserIds: z.array(z.string().trim().min(5).max(64)).min(1).max(500),
  since: z.string().datetime(),
});

export async function POST(request: Request) {
  const denied = requireBridgeToken(request);
  if (denied) return denied;

  const parsed = SummaryRequest.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid reporting request." }, { status: 400 });
  }
  const { platformUserIds, since } = parsed.data;
  const ids = [...new Set(platformUserIds)];
  const sinceDate = new Date(since);

  const [matchedAccounts, depositors, activeGroups, volumeAggregate] = await Promise.all([
    prisma.user.count({ where: { id: { in: ids }, deletedAt: null } }),
    // Activation milestone: has EVER had an approved deposit.
    prisma.paymentRequest.groupBy({
      by: ["userId"],
      where: { userId: { in: ids }, type: "DEPOSIT", status: "APPROVED" },
      _count: { _all: true },
    }),
    // Trading activity inside the reporting window.
    prisma.position.groupBy({
      by: ["userId"],
      where: { userId: { in: ids }, openedAt: { gte: sinceDate } },
      _count: { _all: true },
    }),
    prisma.position.aggregate({
      where: { userId: { in: ids }, openedAt: { gte: sinceDate } },
      _sum: { volume: true, commission: true, tradingCommission: true },
    }),
  ]);

  // Decimal→Number is safe at reporting magnitudes (display only).
  const revenue = Number(volumeAggregate._sum.commission ?? 0) + Number(volumeAggregate._sum.tradingCommission ?? 0);

  return NextResponse.json({
    data: {
      version: 1,
      matchedAccounts,
      deposited: depositors.length,
      activeTraders: activeGroups.length,
      volumeLots: volumeAggregate._sum.volume?.toFixed(2) ?? "0",
      commissionRevenue: revenue.toFixed(2),
    },
  });
}
