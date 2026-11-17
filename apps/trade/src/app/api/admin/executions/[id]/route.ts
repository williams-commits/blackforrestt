import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { AdminError, requireAdmin } from "@/server/admin";
import { hub, type TradingErrorCode } from "@/server/engine/hub";

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
  let authorized = false;
  let action: "SET_PROFIT" | "CLOSE" | undefined;
  let positionId: string | undefined;
  try {
    const actorId = await requireAdmin("EXECUTION_MANAGE");
    const { id } = await context.params;
    authorized = true;
    positionId = id;
    const parsed = Body.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: "A valid action and audited operator reason are required." }, { status: 400 });
    }
    action = parsed.data.action;

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
    const tradingError = getTradingErrorDetails(error);
    if (tradingError) {
      const status = tradingError.code === "VALIDATION"
        ? 400
        : tradingError.code === "BLOCKED" || tradingError.code === "STALE_QUOTE_ACK_REQUIRED"
          ? 403
          : 409;
      return NextResponse.json({ error: tradingError.message, code: tradingError.code }, { status });
    }
    const reference = randomUUID();
    console.error(`Administrative position action failed [${reference}] for ${positionId ?? "unknown position"}:`, error);
    const diagnostic = authorized && action === "CLOSE"
      ? { reference, detail: diagnosticMessage(error) }
      : undefined;
    return NextResponse.json({
      error: "Unable to update the position.",
      ...(diagnostic ? { diagnostic } : {}),
    }, { status: 500 });
  }
}

function getTradingErrorDetails(error: unknown): { message: string; code: TradingErrorCode } | null {
  if (typeof error !== "object" || error === null) return null;
  const candidate = error as { name?: unknown; message?: unknown; code?: unknown };
  if (candidate.name !== "TradingError" || typeof candidate.message !== "string") return null;
  if (
    candidate.code !== "VALIDATION" &&
    candidate.code !== "INSUFFICIENT_FUNDS" &&
    candidate.code !== "CONFLICT" &&
    candidate.code !== "BLOCKED" &&
    candidate.code !== "STALE_QUOTE_ACK_REQUIRED"
  ) return null;
  return { message: candidate.message, code: candidate.code };
}

function diagnosticMessage(error: unknown): string {
  const message = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
  return message
    .replace(/(?:postgres(?:ql)?|redis|https?):\/\/\S+/gi, "[redacted URL]")
    .replace(/\bauthorization\s*[:=]\s*(?:bearer\s+)?\S+/gi, "authorization=[redacted]")
    .replace(/\b(password|secret|token|api[_-]?key)\s*[:=]\s*["']?\S+["']?/gi, "$1=[redacted]")
    .slice(0, 1_000);
}
