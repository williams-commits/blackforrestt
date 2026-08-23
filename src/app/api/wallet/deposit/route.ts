import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { resolveUserId, withSerializableRetry } from "@/server/db";
import { userMutationMutex } from "@/server/locks";
import { appendAuditEvent } from "@/server/ledger";
import { PaymentAmountSchema } from "@/server/moneyValidation";
import {
  DepositRequestSchema,
  paymentMethodLabel,
  preparePaymentMethodDetails,
} from "@/server/paymentMethodDetails";
import { isPaymentMethodAllowed } from "@/server/userSettings";
import { queueUserEmail } from "@/server/email/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Schema = DepositRequestSchema.extend({ amount: PaymentAmountSchema });

/** Create a manual deposit request. Funds are credited only after finance approval. */
export async function POST(req: Request) {
  const session = await auth();
  const userId = await resolveUserId(session?.user?.id);
  const parsed = Schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid deposit request.", details: parsed.error.flatten() }, { status: 400 });
  }
  // Method availability follows the resolved user settings (env defaults →
  // group → profile), so admin overrides change API behavior — the env var is
  // only the global default, not a hard lock.
  if (!(await isPaymentMethodAllowed(userId, parsed.data.method))) {
    return NextResponse.json({ error: "This payment method is not available.", code: "METHOD_DISABLED" }, { status: 400 });
  }

  let methodDetails: ReturnType<typeof preparePaymentMethodDetails>;
  try {
    methodDetails = preparePaymentMethodDetails("DEPOSIT", parsed.data.method, parsed.data.details);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Complete the required details for the selected deposit method.", details: error.flatten() }, { status: 400 });
    }
    throw error;
  }

  const idempotencyKey = req.headers.get("idempotency-key")?.trim();
  if (!idempotencyKey || idempotencyKey.length < 6 || idempotencyKey.length > 128) {
    return NextResponse.json({ error: "A valid Idempotency-Key header is required." }, { status: 400 });
  }

  const reference = idempotencyKey;
  const amount = parsed.data.amount;
  const userReference = parsed.data.reference
    ?? methodDetails.normalized.providerReference
    ?? methodDetails.normalized.transferReference
    ?? methodDetails.normalized.transactionHash;
  const methodLabel = paymentMethodLabel(parsed.data.method);

  return userMutationMutex.runExclusive(userId, async () => {
    const result = await withSerializableRetry(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`payment-request:${userId}:${reference}`}))`;
      const existing = await tx.transaction.findUnique({
        where: { userId_reference: { userId, reference } },
        include: { paymentRequest: true },
      });
      if (existing) {
        if (
          existing.type !== "DEPOSIT" ||
          !existing.amount.equals(amount) ||
          existing.paymentRequest?.method !== parsed.data.method ||
          existing.paymentRequest?.methodDetailsFingerprint !== methodDetails.fingerprint
        ) return { kind: "conflict" as const };
        return { kind: "ok" as const, transaction: existing, paymentRequest: existing.paymentRequest, replayed: true };
      }

      const transaction = await tx.transaction.create({
        data: {
          userId,
          type: "DEPOSIT",
          status: "PENDING",
          amount,
          asset: "USD",
          description: `Manual deposit via ${methodLabel}`,
          reference,
        },
      });
      const paymentRequest = await tx.paymentRequest.create({
        data: {
          userId,
          transactionId: transaction.id,
          type: "DEPOSIT",
          amount,
          asset: "USD",
          method: parsed.data.method,
          userReference,
          methodDetailsEncrypted: methodDetails.encrypted,
          methodDetailsFingerprint: methodDetails.fingerprint,
          methodDetailsSummary: methodDetails.summary,
        },
      });
      await tx.paymentEvent.create({
        data: {
          paymentRequestId: paymentRequest.id,
          type: "CREATED",
          actorId: userId,
          metadata: { type: "DEPOSIT", amount: amount.toFixed(8), asset: "USD", method: parsed.data.method, methodSummary: methodDetails.summary },
        },
      });
      await tx.notification.create({
        data: {
          userId,
          type: "PAYMENT_CREATED",
          title: "Deposit request created",
          body: parsed.data.method === "CARD"
            ? "Your card deposit is queued for finance review against the card processor reference."
            : "Upload and verify your payment proof so finance can review this deposit.",
          metadata: { paymentRequestId: paymentRequest.id },
        },
      });
      await queueUserEmail(tx, {
        userId,
        template: "payment-created",
        variables: {
          paymentType: "Deposit",
          amount: amount.toFixed(2),
          asset: "USD",
          method: methodLabel,
          reference: userReference ?? reference,
        },
      });
      await appendAuditEvent(tx, {
        actorId: userId,
        action: "PAYMENT_REQUEST_CREATED",
        entityType: "PaymentRequest",
        entityId: paymentRequest.id,
        metadata: { type: "DEPOSIT", amount: amount.toFixed(8), asset: "USD", method: parsed.data.method, methodSummary: methodDetails.summary },
      });
      return { kind: "ok" as const, transaction, paymentRequest, replayed: false };
    }, { operation: `create deposit ${reference}` });

    if (result.kind === "conflict") {
      return NextResponse.json({ error: "Idempotency key is already in use." }, { status: 409 });
    }
    return NextResponse.json({
      ok: true,
      replayed: result.replayed,
      transaction: result.transaction.id,
      paymentRequest: result.paymentRequest?.id,
      status: result.transaction.status,
      // Card deposits settle against the processor reference — no receipt needed.
      proofRequired: parsed.data.method !== "CARD",
    }, { status: result.replayed ? 200 : 202 });
  });
}
