import { NextResponse } from "next/server";
import { z } from "zod";
import { AdminError, requireAdmin } from "@/server/admin";
import {
  adjustUserBalance,
  AdminBalanceError,
  getUserFinanceHistory,
} from "@/server/adminBalance";
import { hub } from "@/server/engine/hub";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Query = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(100),
});
const AdjustmentBody = z.object({
  action: z.enum(["CREDIT", "DEBIT"]),
  amount: z.union([z.string(), z.number()]).transform((value) => String(value).trim()),
  reason: z.string().trim().min(5).max(500),
});

function commandKey(request: Request): string | null {
  const key = request.headers.get("idempotency-key")?.trim() ?? "";
  return /^[A-Za-z0-9._:-]{8,100}$/.test(key) ? key : null;
}

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin("USER_BALANCE_ADJUST");
    const { id } = await context.params;
    const url = new URL(request.url);
    const parsed = Query.safeParse({ limit: url.searchParams.get("limit") ?? undefined });
    if (!parsed.success) return NextResponse.json({ error: "Invalid history query." }, { status: 400 });
    return NextResponse.json(await getUserFinanceHistory(id, parsed.data.limit));
  } catch (error) {
    if (error instanceof AdminError || error instanceof AdminBalanceError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("User finance history failed", error);
    return NextResponse.json({ error: "Unable to load user finance history." }, { status: 500 });
  }
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const actorId = await requireAdmin("USER_BALANCE_ADJUST");
    const { id: userId } = await context.params;
    const key = commandKey(request);
    if (!key) return NextResponse.json({ error: "A valid idempotency-key header is required." }, { status: 400 });
    const parsed = AdjustmentBody.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: "A valid action, amount, and audited reason are required." }, { status: 400 });
    }
    const result = await adjustUserBalance({
      actorId,
      userId,
      action: parsed.data.action,
      amount: parsed.data.amount,
      reason: parsed.data.reason,
      commandKey: key,
    });
    await hub.publishAccountMetrics(userId).catch((error) => {
      console.error("Unable to broadcast administrative balance adjustment", error);
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    if (error instanceof AdminError || error instanceof AdminBalanceError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("Administrative balance adjustment failed", error);
    return NextResponse.json({ error: "Unable to adjust the user balance." }, { status: 500 });
  }
}
