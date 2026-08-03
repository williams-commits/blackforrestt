import { NextResponse } from "next/server";
import { z } from "zod";
import { hub, TradingError } from "@/server/engine/hub";
import { prisma, resolveUserId } from "@/server/db";
import { auth } from "@/auth";
import { appendAuditEvent } from "@/server/ledger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const OpenSchema = z.object({
  symbol: z.string().trim().min(1).max(32).transform((value) => value.toUpperCase()),
  side: z.enum(["BUY", "SELL"]),
  volume: z.number().finite().min(0.01).max(100),
  type: z.enum(["CFD", "STRIKE"]),
  strikeRate: z.number().finite().positive().optional().nullable(),
  expiryMinutes: z.number().int().min(1).max(1_440).optional().nullable(),
  stopLoss: z.number().finite().positive().optional().nullable(),
  takeProfit: z.number().finite().positive().optional().nullable(),
}).superRefine((value, context) => {
  if (value.type === "STRIKE" && value.expiryMinutes == null) {
    context.addIssue({ code: "custom", path: ["expiryMinutes"], message: "Strike positions require an expiry." });
  }
  if (value.type === "CFD" && (value.strikeRate != null || value.expiryMinutes != null)) {
    context.addIssue({ code: "custom", path: ["type"], message: "CFD positions cannot include strike fields." });
  }
  if (value.type === "STRIKE" && (value.stopLoss != null || value.takeProfit != null)) {
    context.addIssue({ code: "custom", path: ["type"], message: "Strike positions cannot include SL/TP fields." });
  }
});

/** POST /api/positions — open a CFD or STRIKE position. */
export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = OpenSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid position.", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const session = await auth();
  const userId = await resolveUserId(session?.user?.id);
  const idempotencyKey = req.headers.get("idempotency-key")?.trim();
  if (!idempotencyKey || idempotencyKey.length < 6 || idempotencyKey.length > 128) {
    return NextResponse.json(
      { error: "A valid Idempotency-Key header is required." },
      { status: 400 },
    );
  }
  try {
    const result = await hub.openPositionReq({
      userId,
      symbol: parsed.data.symbol,
      side: parsed.data.side,
      volume: parsed.data.volume,
      type: parsed.data.type,
      strikeRate: parsed.data.strikeRate ?? null,
      expiryMinutes: parsed.data.expiryMinutes ?? null,
      stopLoss: parsed.data.stopLoss ?? null,
      takeProfit: parsed.data.takeProfit ?? null,
      idempotencyKey,
    });
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    if (error instanceof TradingError) {
      try {
        await prisma.$transaction((tx) => appendAuditEvent(tx, {
          domain: "EXECUTION",
          actorId: userId,
          action: "POSITION_OPEN_REJECTED",
          entityType: "PositionRequest",
          requestId: idempotencyKey,
          metadata: {
            symbol: parsed.data.symbol,
            side: parsed.data.side,
            volume: parsed.data.volume.toString(),
            code: error.code,
            reason: error.message,
            simulation: true,
          },
        }));
      } catch (auditError) {
        console.error("Position rejection audit failed:", auditError);
      }
      const status =
        error.code === "BLOCKED"
          ? 403
          : error.code === "INSUFFICIENT_FUNDS" || error.code === "CONFLICT"
            ? 409
            : 400;
      return NextResponse.json({ error: error.message, code: error.code }, { status });
    }
    console.error("Position open failed:", error);
    return NextResponse.json({ error: "Unable to open the position." }, { status: 500 });
  }
}

/** GET /api/positions?status=OPEN|CLOSED&limit=25&cursor=<position-id> */
export async function GET(req: Request) {
  const session = await auth();
  const userId = await resolveUserId(session?.user?.id);
  const url = new URL(req.url);
  const requestedStatus = url.searchParams.get("status") ?? "OPEN";
  if (requestedStatus !== "OPEN" && requestedStatus !== "CLOSED") {
    return NextResponse.json({ error: "status must be OPEN or CLOSED." }, { status: 400 });
  }
  const requestedLimit = Number(url.searchParams.get("limit") ?? 25);
  const limit = Number.isInteger(requestedLimit) ? Math.min(100, Math.max(1, requestedLimit)) : 25;
  const cursor = url.searchParams.get("cursor")?.trim() || null;

  const positions = await prisma.position.findMany({
    where: { userId, status: requestedStatus },
    orderBy: requestedStatus === "CLOSED" ? [{ closedAt: "desc" }, { id: "desc" }] : [{ openedAt: "desc" }, { id: "desc" }],
    take: limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  });
  const hasMore = positions.length > limit;
  const page = hasMore ? positions.slice(0, limit) : positions;

  return NextResponse.json({
    positions: page.map((position) => ({
      id: position.id,
      symbol: position.symbol,
      type: position.type,
      side: position.side,
      volume: Number(position.volume),
      openRate: Number(position.openRate),
      strikeRate: position.strikeRate != null ? Number(position.strikeRate) : null,
      currentRate: Number(position.currentRate),
      stopLoss: position.stopLoss != null ? Number(position.stopLoss) : null,
      takeProfit: position.takeProfit != null ? Number(position.takeProfit) : null,
      swap: Number(position.swap),
      commission: Number(position.commission),
      tradingCommission: Number(position.tradingCommission),
      profit: Number(position.profit),
      adminPnlAdjustment: Number(position.adminPnlAdjustment),
      netProfit: Number(position.netProfit),
      status: position.status,
      openedAt: position.openedAt.getTime(),
      openedTill: position.openedTill?.getTime() ?? null,
      closedAt: position.closedAt?.getTime() ?? null,
      closeReason: position.closeReason,
    })),
    nextCursor: hasMore ? page.at(-1)?.id ?? null : null,
  });
}
