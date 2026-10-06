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
    // Storage/scanner outages must not surface as an opaque 500 — the client
    // shows this message and the proof stays PENDING_SCAN so a retry is safe.
    console.error("Payment proof finalization failed", error);
    return NextResponse.json({
      error: process.env.NODE_ENV === "production"
        ? "Payment proof verification is temporarily unavailable. Please try again shortly."
        : "Payment proof verification is unavailable. Check MinIO and KYC_SCANNER, then retry.",
    }, { status: 503 });
  }
}
