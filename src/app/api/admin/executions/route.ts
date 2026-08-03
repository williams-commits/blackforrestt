import { NextResponse } from "next/server";
import { z } from "zod";
import { AdminError, requireAdmin } from "@/server/admin";
import { prisma } from "@/server/db";
import { hub } from "@/server/engine/hub";
import { getMarketDataMode } from "@/server/engine/marketDataMode";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Query = z.object({
  status: z.enum(["OPEN", "CLOSED"]).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(100),
});

export async function GET(request: Request) {
  try {
    await requireAdmin("EXECUTION_READ");
    const params = new URL(request.url).searchParams;
    const parsed = Query.safeParse({ status: params.get("status") ?? undefined, limit: params.get("limit") ?? undefined });
    if (!parsed.success) return NextResponse.json({ error: "Invalid execution query." }, { status: 400 });
    const positions = await prisma.position.findMany({
      where: { status: parsed.data.status },
      orderBy: parsed.data.status === "CLOSED" ? { closedAt: "desc" } : { openedAt: "desc" },
      take: parsed.data.limit,
      include: { user: { select: { email: true, accountNo: true } }, instrument: { select: { name: true, category: true } } },
    });
    return NextResponse.json({
      executionMode: "INTERNAL",
      marketDataMode: getMarketDataMode(),
      engineReady: hub.isReady(),
      providerWarning: "Positions are executed against the internal price feed.",
      positions: positions.map((position) => ({
        id: position.id,
        symbol: position.symbol,
        instrument: position.instrument,
        user: position.user,
        type: position.type,
        side: position.side,
        status: position.status,
        volume: position.volume.toFixed(8),
        openRate: position.openRate.toFixed(8),
        currentRate: position.currentRate.toFixed(8),
        commission: position.commission.toFixed(8),
        swap: position.swap.toFixed(8),
        profit: position.profit.toFixed(8),
        adminPnlAdjustment: position.adminPnlAdjustment.toFixed(8),
        netProfit: position.netProfit.toFixed(8),
        openedAt: position.openedAt.toISOString(),
        closedAt: position.closedAt?.toISOString() ?? null,
        closeReason: position.closeReason,
      })),
    });
  } catch (error) {
    const status = error instanceof AdminError ? error.status : 500;
    return NextResponse.json({ error: status === 500 ? "Unable to load executions." : (error as Error).message }, { status });
  }
}
