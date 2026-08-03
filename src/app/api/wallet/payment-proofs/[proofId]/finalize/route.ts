import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { resolveUserId } from "@/server/db";
import { finalizePaymentProof, PaymentError } from "@/server/payments";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(_request: Request, context: { params: Promise<{ proofId: string }> }) {
  const session = await auth();
  const userId = await resolveUserId(session?.user?.id);
  const { proofId } = await context.params;
  try {
    const result = await finalizePaymentProof({ userId, proofId });
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof PaymentError) return NextResponse.json({ error: error.message }, { status: error.status });
    throw error;
  }
}
