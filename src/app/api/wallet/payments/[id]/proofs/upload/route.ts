import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { resolveUserId } from "@/server/db";
import { PaymentError, receivePaymentProof } from "@/server/payments";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Same-origin multipart payment-proof upload. The browser never receives a storage URL. */
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const userId = await resolveUserId(session?.user?.id);
  const { id } = await context.params;
  const form = await request.formData().catch(() => null);
  if (!form) return NextResponse.json({ error: "Expected multipart/form-data." }, { status: 400 });
  const file = form.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "A payment proof file is required." }, { status: 400 });
  try {
    // The proof type is resolved from the file's magic bytes server-side
    // (see resolveProofMime) — the browser's MIME reporting is not trusted,
    // so OS-level .jpeg/.jpg mapping quirks can't reject valid files.
    const result = await receivePaymentProof({
      userId,
      paymentRequestId: id,
      bytes: Buffer.from(await file.arrayBuffer()),
    });
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    if (error instanceof PaymentError) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error("Payment proof upload failed", error);
    return NextResponse.json({
      error: process.env.NODE_ENV === "production"
        ? "Payment proof upload is temporarily unavailable. Please try again shortly."
        : "Payment proof upload is unavailable. Check MinIO, then retry.",
    }, { status: 503 });
  }
}
