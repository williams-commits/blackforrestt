import { NextResponse } from "next/server";
import { z } from "zod";
import { hub, type TradingErrorCode } from "@/server/engine/hub";
import { resolveUserId } from "@/server/db";
import { auth } from "@/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const IdSchema = z.string().cuid();
const CloseSchema = z.object({
  acknowledgeStalePrice: z.boolean().default(false),
});

/** POST /api/positions/[id]/close — close at the executable or acknowledged stale mark. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!IdSchema.safeParse(id).success) {
    return NextResponse.json({ error: "Invalid position id." }, { status: 400 });
  }

  let body: unknown = {};
  const rawBody = await req.text();
  if (rawBody.trim()) {
    try {
      body = JSON.parse(rawBody) as unknown;
    } catch {
      return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
    }
  }
  const parsed = CloseSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid close request.", details: parsed.error.flatten() }, { status: 400 });
  }

  const session = await auth();
  // Defense-in-depth: middleware normally 401s first, but if it is ever
  // bypassed resolveUserId THROWS — answer 401 instead of an unhandled 500.
  let userId: string;
  try {
    userId = await resolveUserId(session?.user?.id);
  } catch {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  try {
    const result = await hub.closePositionReq(userId, id, parsed.data.acknowledgeStalePrice);
    if (!result) {
      return NextResponse.json({ error: "Position not found or already closed." }, { status: 404 });
    }
    return NextResponse.json(result);
  } catch (error) {
    const tradingError = getTradingErrorDetails(error);
    if (tradingError) {
      const status = tradingError.code === "VALIDATION" ? 400 : tradingError.code === "BLOCKED" ? 403 : 409;
      return NextResponse.json({ error: tradingError.message, code: tradingError.code }, { status });
    }
    console.error(`Position close failed for ${id}:`, error);
    return NextResponse.json({ error: "Unable to close the position." }, { status: 500 });
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
    candidate.code !== "BLOCKED"
  ) return null;
  return { message: candidate.message, code: candidate.code };
}
