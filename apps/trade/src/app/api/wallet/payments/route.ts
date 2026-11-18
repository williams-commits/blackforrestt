import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { resolveUserId } from "@/server/db";
import { listCustomerPayments } from "@/server/payments";
import { paymentMethodLabel, revealMethodDetails, type PaymentMethod } from "@/server/paymentMethodDetails";
import {
  customerFinanceDescription,
  customerFinanceReference,
  customerPaymentType,
} from "@/lib/customerFinancePresentation";

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
      type: customerPaymentType(request.type, Number(request.transaction.amount)),
      status: request.status,
      amount: request.type === "ADMIN_ADJUSTMENT"
        ? request.transaction.amount.abs().toFixed(8)
        : request.amount.toFixed(8),
      reason: request.type === "ADMIN_ADJUSTMENT"
        ? customerFinanceDescription(request.type, request.transaction.description)
        : null,
      asset: request.asset,
      method: request.type === "ADMIN_ADJUSTMENT" ? "MANUAL" : request.method,
      methodLabel: request.type === "ADMIN_ADJUSTMENT"
        ? "Manual"
        : paymentMethodLabel(request.method as PaymentMethod),
      methodDetailsSummary: request.methodDetailsSummary ?? request.beneficiarySummary,
      methodDetails: revealMethodDetails(request.methodDetailsEncrypted ?? request.beneficiaryEncrypted),
      reference: customerFinanceReference(
        request.type,
        request.userReference ?? request.externalReference,
        request.transaction.id,
      ),
      beneficiarySummary: request.beneficiarySummary,
      riskHoldUntil: request.riskHoldUntil?.toISOString() ?? null,
      reconciliationStatus: request.reconciliationStatus,
      reviewerNote: request.reviewerNote,
      createdAt: request.createdAt.toISOString(),
      reviewedAt: request.type === "ADMIN_ADJUSTMENT" ? null : request.reviewedAt?.toISOString() ?? null,
      proofs: request.proofs.map((proof) => ({
        id: proof.id,
        status: proof.status,
        declaredMime: proof.declaredMime,
        detectedMime: proof.detectedMime,
        sizeBytes: proof.sizeBytes,
        uploadedAt: proof.uploadedAt.toISOString(),
        finalizedAt: proof.finalizedAt?.toISOString() ?? null,
      })),
      events: request.type === "ADMIN_ADJUSTMENT"
        ? request.events
          .filter((event) => event.type === "APPROVED")
          .map((event) => ({ type: "CONFIRMED", createdAt: event.createdAt.toISOString() }))
        : request.events.map((event) => ({
          type: event.type,
          createdAt: event.createdAt.toISOString(),
        })),
    })),
  });
}
