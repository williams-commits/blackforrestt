import { NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { requireBridgeToken } from "@/server/crmBridge";
import { hub } from "@/server/engine/hub";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Read-only CRM bridge endpoint for linked-user presence and open positions. */
export async function GET(request: Request) {
  const denied = requireBridgeToken(request);
  if (denied) return denied;
  const ids = [...new Set((new URL(request.url).searchParams.get("platformUserIds") ?? "").split(",").map((id) => id.trim()).filter(Boolean))].slice(0, 100);
  if (ids.length === 0) return NextResponse.json({ data: [] });
  const online = hub.onlineUserIds();
  const positions = await prisma.position.findMany({
    where: { userId: { in: ids }, status: "OPEN" },
    orderBy: { openedAt: "desc" },
    take: 500,
    select: { id: true, userId: true, symbol: true, side: true, type: true, volume: true, openRate: true, currentRate: true, netProfit: true, openedAt: true },
  });
  return NextResponse.json({
    data: ids.map((platformUserId) => {
      const userPositions = positions.filter((position) => position.userId === platformUserId);
      return {
        platformUserId,
        online: online.has(platformUserId),
        openPositions: userPositions.length,
        positions: userPositions.map((position) => ({
          id: position.id,
          symbol: position.symbol,
          side: position.side,
          type: position.type,
          volume: position.volume.toString(),
          openRate: position.openRate.toString(),
          currentRate: position.currentRate.toString(),
          netProfit: position.netProfit.toString(),
          openedAt: position.openedAt.toISOString(),
        })),
      };
    }),
  });
}