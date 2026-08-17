import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { resolveUserId } from "@/server/db";
import { listCustomerPayments } from "@/server/payments";
import { paymentMethodLabel, revealMethodDetails, type PaymentMethod } from "@/server/paymentMethodDetails";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Safe customer payment timeline. It deliberately excludes proof storage keys,
 * hashes, and object bytes. Full method details are the customer's own input
 * and are returned for the expandable details view. */
export async function GET() {
  const session = await auth();
  const userId = await resolveUserId(session?.user?.id);
  const requests = await listCustomerPayments(userId);
  return NextResponse.json({
    requests: requests.map((request) => ({
      id: request.id,
      type: request.type,
      status: request.status,
      amount: request.amount.toFixed(8),
      asset: request.asset,
      method: request.method,
      methodLabel: paymentMethodLabel(request.method as PaymentMethod),
      methodDetailsSummary: request.methodDetailsSummary ?? request.beneficiarySummary,
      methodDetails: revealMethodDetails(request.methodDetailsEncrypted ?? request.beneficiaryEncrypted),
      userReference: request.userReference,
      beneficiarySummary: request.beneficiarySummary,
      riskHoldUntil: request.riskHoldUntil?.toISOString() ?? null,
      reconciliationStatus: request.reconciliationStatus,
      reviewerNote: request.reviewerNote,
      createdAt: request.createdAt.toISOString(),
      reviewedAt: request.reviewedAt?.toISOString() ?? null,
      proofs: request.proofs.map((proof) => ({
        id: proof.id,
        status: proof.status,
        declaredMime: proof.declaredMime,
        detectedMime: proof.detectedMime,
        sizeBytes: proof.sizeBytes,
        uploadedAt: proof.uploadedAt.toISOString(),
        finalizedAt: proof.finalizedAt?.toISOString() ?? null,
      })),
      events: request.events.map((event) => ({
        type: event.type,
        createdAt: event.createdAt.toISOString(),
      })),
    })),
  });
}
