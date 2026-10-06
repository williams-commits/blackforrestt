import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/server/db";
import { AdminError, requireAdmin } from "@/server/admin";
import { paymentMethodLabel, revealMethodDetails } from "@/server/paymentMethodDetails";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Query = z.object({
  status: z.enum(["PENDING", "AWAITING_APPROVAL", "APPROVED", "REJECTED", "CANCELLED", "REVERSED"]).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export async function GET(req: Request) {
  try {
    await requireAdmin("PAYMENT_READ");
    const params = new URL(req.url).searchParams;
    const parsed = Query.safeParse({ status: params.get("status") ?? undefined, limit: params.get("limit") ?? undefined });
    if (!parsed.success) return NextResponse.json({ error: "Invalid query." }, { status: 400 });

    const requests = await prisma.paymentRequest.findMany({
      where: { status: parsed.data.status },
      take: parsed.data.limit,
      orderBy: { createdAt: "desc" },
      include: {
        user: { select: { email: true, name: true, accountNo: true, verified: true } },
        transaction: { select: { reference: true, status: true } },
        proofs: {
          where: { deletedAt: null },
          select: { id: true, status: true, declaredMime: true, detectedMime: true, sizeBytes: true, uploadedAt: true, finalizedAt: true },
        },
      },
    });

    return NextResponse.json({
      requests: requests.map((item) => ({
        id: item.id,
        type: item.type,
        status: item.status,
        amount: item.amount.toFixed(8),
        asset: item.asset,
        method: item.method,
        methodLabel: paymentMethodLabel(item.method),
        methodDetailsSummary: item.methodDetailsSummary ?? item.beneficiarySummary,
        // Full decrypted details (e.g. the complete sending wallet address)
        // for the expandable finance-review view.
        methodDetails: revealMethodDetails(item.methodDetailsEncrypted ?? item.beneficiaryEncrypted),
        userReference: item.userReference,
        externalReference: item.externalReference,
        reviewerNote: item.reviewerNote,
        beneficiarySummary: item.beneficiarySummary,
        riskHoldUntil: item.riskHoldUntil?.toISOString() ?? null,
        preparedBy: item.preparedBy,
        preparedAt: item.preparedAt?.toISOString() ?? null,
        reviewedBy: item.reviewedBy,
        reviewedAt: item.reviewedAt?.toISOString() ?? null,
        reconciliationStatus: item.reconciliationStatus,
        reconciliationReference: item.reconciliationReference,
        reconciledAmount: item.reconciledAmount?.toFixed(8) ?? null,
        reconciledBy: item.reconciledBy,
        reconciledAt: item.reconciledAt?.toISOString() ?? null,
        reconciliationNote: item.reconciliationNote,
        createdAt: item.createdAt.toISOString(),
        user: item.user,
        transaction: item.transaction,
        proofs: item.proofs.map((proof) => ({
          id: proof.id,
          status: proof.status,
          declaredMime: proof.declaredMime,
          detectedMime: proof.detectedMime,
          sizeBytes: proof.sizeBytes,
          uploadedAt: proof.uploadedAt.toISOString(),
          finalizedAt: proof.finalizedAt?.toISOString() ?? null,
        })),
      })),
    });
  } catch (error) {
    const status = error instanceof AdminError ? error.status : 500;
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to list payment requests." }, { status });
  }
}
