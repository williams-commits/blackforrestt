import { NextResponse } from "next/server";
import { z } from "zod";
import { AdminError, requireAdmin } from "@/server/admin";
import { hub, TradingError } from "@/server/engine/hub";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("SET_PROFIT"),
    targetProfit: z.number().finite().min(-1_000_000).max(1_000_000),
    reason: z.string().trim().min(5).max(500),
  }),
  z.object({
    action: z.literal("CLOSE"),
    reason: z.string().trim().min(5).max(500),
  }),
]);

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const actorId = await requireAdmin("EXECUTION_MANAGE");
    const { id } = await context.params;
    const parsed = Body.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: "A valid action and audited operator reason are required." }, { status: 400 });
    }

    const result = parsed.data.action === "SET_PROFIT"
      ? await hub.adminAdjustPositionPnl({
          actorId,
          positionId: id,
          targetProfit: parsed.data.targetProfit,
          reason: parsed.data.reason,
        })
      : await hub.adminClosePosition({ actorId, positionId: id, reason: parsed.data.reason });

    return NextResponse.json({ ok: true, position: result.position, metrics: result.metrics });
  } catch (error) {
    if (error instanceof AdminError) return NextResponse.json({ error: error.message }, { status: error.status });
    if (error instanceof TradingError) {
      const status = error.code === "VALIDATION" ? 400 : error.code === "BLOCKED" ? 403 : 409;
      return NextResponse.json({ error: error.message, code: error.code }, { status });
    }
    console.error("Administrative position action failed:", error);
    return NextResponse.json({ error: "Unable to update the position." }, { status: 500 });
  }
}
