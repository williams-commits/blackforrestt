import { createHash, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/server/db";
import { notify, subjectNotificationContext, type NotifiableType } from "@/server/notifications";
import { appendActivity } from "@/server/activity";
import { logger } from "@/server/observability";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Trade → CRM event ingest — the push half of the integration contract.
 * Token-gated exactly like the bridge in the other direction (constant-time
 * shared secret, 503 until configured). Semantics:
 *
 *  - Idempotent: the event id IS the PlatformEventLog primary key; a replay
 *    returns 200 { duplicate: true } and creates nothing.
 *  - Link-scoped: events for platform users with no linked CRM customer are
 *    dropped (200 { dropped: "unlinked" }) — no platform PII is persisted.
 *  - Owner-routed: the linked customer's owner receives the notification;
 *    nobody else. Amount/asset/state is the only financial context carried.
 *  - Realtime: appending a customer activity row rides the existing SSE
 *    change-stream, so connected clients (bell, center) refresh live.
 */

const PlatformEvent = z.object({
  id: z.string().uuid(),
  version: z.literal(1),
  type: z.enum(["payment.status_changed", "payment.requires_review", "kyc.status_changed", "account.state_changed"]),
  occurredAt: z.string().datetime(),
  platformUserId: z.string().trim().min(5).max(64),
  payload: z.record(z.string(), z.unknown()).default({}),
});

function requireEventsToken(request: Request): NextResponse | null {
  const expected = process.env.TRADE_EVENTS_TOKEN;
  if (!expected) {
    return NextResponse.json({ error: "Trade events endpoint is not configured." }, { status: 503 });
  }
  const header = request.headers.get("authorization") ?? "";
  const presented = header.startsWith("Bearer ") ? header.slice(7) : "";
  const expectedHash = createHash("sha256").update(expected).digest();
  const presentedHash = createHash("sha256").update(presented).digest();
  if (presented.length === 0 || !timingSafeEqual(expectedHash, presentedHash)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  return null;
}

interface MappedNotification {
  type: NotifiableType;
  title: string;
  payload: Record<string, unknown>;
  activityKind: "updated";
}

function mapEvent(
  type: z.infer<typeof PlatformEvent>["type"],
  payload: Record<string, unknown>,
  customerLabel: string,
): MappedNotification | null {
  const paymentType = typeof payload.paymentType === "string" ? payload.paymentType : "payment";
  const status = typeof payload.status === "string" ? payload.status : "";
  const state = typeof payload.state === "string" ? payload.state : "";
  const amount = typeof payload.amount === "string" ? payload.amount : null;
  const asset = typeof payload.asset === "string" ? payload.asset : null;
  const amountText = amount ? `${amount} ${asset ?? ""}`.trim() : "";

  switch (type) {
    case "payment.status_changed":
      if (!status) return null;
      return {
        type: "PAYMENT_STATUS_CHANGED",
        title: `${paymentType === "deposit" ? "Deposit" : "Withdrawal"} ${status}${amountText ? ` — ${amountText}` : ""}`,
        payload: { label: customerLabel, paymentType, status, amount, asset },
        activityKind: "updated",
      };
    case "payment.requires_review":
      return {
        type: "PAYMENT_STATUS_CHANGED",
        title: `${paymentType === "deposit" ? "Deposit" : "Withdrawal"} needs review${amountText ? ` — ${amountText}` : ""}`,
        payload: { label: customerLabel, paymentType, status: "needs review", amount, asset },
        activityKind: "updated",
      };
    case "kyc.status_changed":
      if (!status) return null;
      return {
        type: "KYC_STATUS_CHANGED",
        title: `KYC ${status === "approved" ? "approved" : status}`,
        payload: { label: customerLabel, status },
        activityKind: "updated",
      };
    case "account.state_changed":
      if (!state) return null;
      return {
        type: "ACCOUNT_STATE_CHANGED",
        title: `Trading account ${state}`,
        payload: { label: customerLabel, state },
        activityKind: "updated",
      };
  }
}

export async function POST(request: Request) {
  const denied = requireEventsToken(request);
  if (denied) return denied;

  const parsed = PlatformEvent.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid event envelope." }, { status: 400 });
  }
  const event = parsed.data;

  // Idempotency — the producer's uuid is the primary key. A racing duplicate
  // lands here as a unique-constraint rejection, which is the same answer.
  const existing = await prisma.platformEventLog.findUnique({ where: { id: event.id }, select: { id: true } });
  if (existing) {
    return NextResponse.json({ data: { duplicate: true } });
  }

  const customer = await prisma.customer.findFirst({
    where: { platformUserId: event.platformUserId, deletedAt: null },
    select: { id: true, firstName: true, lastName: true, ownerUserId: true },
  });
  if (!customer) {
    // Unlinked platform user — acknowledge (so Trade doesn't retry) without
    // persisting anything about them.
    return NextResponse.json({ data: { dropped: "unlinked" } });
  }

  const label = `${customer.firstName} ${customer.lastName}`;
  const mapped = mapEvent(event.type, event.payload, label);
  if (!mapped) {
    return NextResponse.json({ error: "Event payload missing required fields." }, { status: 422 });
  }

  await prisma.$transaction(async (tx) => {
    await tx.platformEventLog.create({
      data: { id: event.id, type: event.type, platformUserId: event.platformUserId },
    });
    await appendActivity(tx, {
      subjectType: "CUSTOMER",
      subjectId: customer.id,
      kind: mapped.activityKind,
      payload: { platformEvent: event.type, title: mapped.title },
    });
  });

  await notify({
    recipientUserId: customer.ownerUserId,
    type: mapped.type,
    payload: { ...mapped.payload, title: mapped.title },
    context: { ...subjectNotificationContext("CUSTOMER", customer.id), href: `/customers/${customer.id}?tab=platform` },
  });

  logger.info("platform_event_ingested", { type: event.type, customerId: customer.id });
  return NextResponse.json({ data: { accepted: true } });
}
