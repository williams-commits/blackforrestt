import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { resolveUserId } from "@/server/db";
import { hub } from "@/server/engine/hub";
import { cancelPayment, PaymentError } from "@/server/payments";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const userId = await resolveUserId(session?.user?.id);
  const { id } = await context.params;
  const commandKey = request.headers.get("idempotency-key")?.trim() ?? "";
  try {
    const result = await cancelPayment({ paymentRequestId: id, userId, commandKey });
    if (!result.replayed) {
      // Cancelling a withdrawal releases reserved funds — push the fresh
      // account snapshot so open tabs update live.
      await hub.publishAccountMetrics(userId).catch((error) => {
        console.error("Unable to broadcast payment cancellation account update", error);
      });
    }
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    if (error instanceof PaymentError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
    }
    throw error;
  }
}
