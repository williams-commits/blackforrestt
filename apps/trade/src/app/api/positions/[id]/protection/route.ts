import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { hub, TradingError } from "@/server/engine/hub";
import { resolveUserId } from "@/server/db";
import { consumeRateLimit, RateLimitedError } from "@/server/security/rateLimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const IdSchema = z.string().cuid();
const ProtectionSchema = z.object({
  stopLoss: z.number().finite().positive().nullable(),
  takeProfit: z.number().finite().positive().nullable(),
}).strict();

/** PATCH /api/positions/[id]/protection — update only an open CFD's SL/TP. */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!IdSchema.safeParse(id).success) {
    return NextResponse.json({ error: "Invalid position id." }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  const parsed = ProtectionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Provide valid stop-loss and take-profit levels, using null to clear a level." },
      { status: 400 },
    );
  }

  const session = await auth();
  let userId: string;
  try {
    userId = await resolveUserId(session?.user?.id);
  } catch {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    await consumeRateLimit({
      scope: "position-protection",
      identifier: userId,
      limit: 30,
      windowSeconds: 60,
    });
  } catch (error) {
    if (error instanceof RateLimitedError) {
      return NextResponse.json(
        { error: error.message },
        { status: 429, headers: { "Retry-After": String(error.retryAfterSeconds) } },
      );
    }
    console.error("Position protection rate limit unavailable:", error);
    return NextResponse.json({ error: "Position updates are temporarily unavailable." }, { status: 503 });
  }

  try {
    const result = await hub.updatePositionProtectionReq(
      userId,
      id,
      parsed.data.stopLoss,
      parsed.data.takeProfit,
    );
    if (!result) {
      return NextResponse.json({ error: "Position not found or already closed." }, { status: 404 });
    }
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof TradingError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.code === "CONFLICT" ? 409 : 400 },
      );
    }
    console.error(`Position protection update failed for ${id}:`, error);
    return NextResponse.json({ error: "Unable to update position protection." }, { status: 500 });
  }
}
