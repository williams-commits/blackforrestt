import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { AdminError, requireAdmin } from "@/server/admin";
import { prisma } from "@/server/db";
import { hub } from "@/server/engine/hub";
import { PaymentAmountSchema } from "@/server/moneyValidation";
import {
  approvePayment,
  PaymentError,
  preparePayment,
  reconcilePayment,
  rejectPayment,
  reversePayment,
} from "@/server/payments";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Schema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("PREPARE"), note: z.string().trim().max(1000).optional() }),
  z.object({ action: z.literal("APPROVE"), externalReference: z.string().trim().min(3).max(160).optional(), note: z.string().trim().max(1000).optional() }),
  z.object({ action: z.literal("REJECT"), note: z.string().trim().min(3).max(1000) }),
  z.object({ action: z.literal("REVERSE"), note: z.string().trim().min(3).max(1000) }),
  z.object({
    action: z.literal("RECONCILE"),
    reconciliationReference: z.string().trim().min(3).max(160),
    settledAmount: PaymentAmountSchema,
    note: z.string().trim().max(1000).optional(),
  }),
]);

/** Finance command endpoint. PREPARE and APPROVE must be performed by two
 * different administrators; all commands have a scoped idempotency key. */
export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const commandKey = request.headers.get("idempotency-key")?.trim() ?? "";
    const parsed = Schema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "Invalid payment command.", details: parsed.error.flatten() }, { status: 400 });
    const permission = parsed.data.action === "PREPARE" || parsed.data.action === "REJECT"
      ? "PAYMENT_PREPARE"
      : parsed.data.action === "RECONCILE"
        ? "PAYMENT_RECONCILE"
        : "PAYMENT_APPROVE";
    const actorId = await requireAdmin(permission);

    let result: { status: string; replayed: boolean } | null = null;
    switch (parsed.data.action) {
      case "PREPARE":
        result = await preparePayment({ paymentRequestId: id, actorId, commandKey, note: parsed.data.note });
        break;
      case "APPROVE":
        result = await approvePayment({
          paymentRequestId: id,
          actorId,
          commandKey,
          externalReference: parsed.data.externalReference,
          note: parsed.data.note,
        });
        break;
      case "REJECT":
        result = await rejectPayment({ paymentRequestId: id, actorId, commandKey, note: parsed.data.note });
        break;
      case "REVERSE":
        result = await reversePayment({ paymentRequestId: id, actorId, commandKey, note: parsed.data.note });
        break;
      case "RECONCILE": {
        const reconciliation = await reconcilePayment({
          paymentRequestId: id,
          actorId,
          commandKey,
          reconciliationReference: parsed.data.reconciliationReference,
          settledAmount: parsed.data.settledAmount,
          note: parsed.data.note,
        });
        result = { status: reconciliation.status, replayed: reconciliation.replayed };
        break;
      }
    }
    if (!result) return NextResponse.json({ error: "Unsupported payment command." }, { status: 400 });

    // APPROVE/REJECT/REVERSE move or release funds: broadcast a fresh account
    // snapshot so the customer's open sessions update live (instead of waiting
    // for their 30s fallback poll). First-time approvals also settle any
    // pending referral reward for deposits.
    if ((parsed.data.action === "APPROVE" || parsed.data.action === "REJECT" || parsed.data.action === "REVERSE") && !result.replayed) {
      const payment = await prisma.paymentRequest.findUnique({
        where: { id },
        select: { userId: true, type: true },
      });
      if (payment) {
        await hub.publishAccountMetrics(payment.userId).catch((error) => {
          console.error("Unable to broadcast payment account update", error);
          // Non-fatal — the payment command itself already committed.
        });
        if (parsed.data.action === "APPROVE" && result.status === "APPROVED" && payment.type === "DEPOSIT") {
          try {
            const { processReferralReward } = await import("@/server/referrals");
            await processReferralReward(payment.userId, actorId);
          } catch (error) {
            console.error("Referral reward processing failed", error);
            // Non-fatal — payment is already approved.
          }
        }
      }
    }

    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    if (error instanceof PaymentError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const fields = Array.isArray(error.meta?.target) ? error.meta!.target.map(String) : [];
      const isExternal = fields.includes("externalReference");
      return NextResponse.json({
        error: isExternal
          ? "That settlement reference is already used by another approved payment for this asset. Enter a unique reference, or leave it blank in simple mode to auto-generate one."
          : "This settlement or reconciliation reference is already in use for the asset.",
        code: "DUPLICATE_REFERENCE",
      }, { status: 409 });
    }
    const status = error instanceof AdminError ? error.status : 500;
    if (status === 500) console.error("Payment command failed", error);
    return NextResponse.json(
      { error: status === 500 ? "Unable to update payment request." : error instanceof Error ? error.message : "Unable to update payment request." },
      { status },
    );
  }
}
