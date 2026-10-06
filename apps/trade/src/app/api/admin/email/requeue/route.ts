import { NextResponse } from "next/server";
import { AdminError, requireAdmin } from "@/server/admin";
import { prisma } from "@/server/db";
import { appendAuditEvent } from "@/server/ledger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/admin/email/requeue — return terminally FAILED email deliveries to
 * the RETRY lane (attempts reset, immediate next attempt). Use after fixing the
 * underlying provider problem (revoked key, unverified domain, quota): without
 * this, a FAILED reset/verification email is permanently lost and the user has
 * no way to recover their account.
 */
export async function POST(request: Request) {
  try {
    const actorId = await requireAdmin("EMAIL_DELIVERY_MANAGE");
    const body = await request.json().catch(() => ({}));
    const ids = Array.isArray((body as { ids?: unknown }).ids)
      ? (body as { ids: string[] }).ids.filter((id) => typeof id === "string").slice(0, 500)
      : null;

    const where = ids ? { id: { in: ids }, status: "FAILED" as const } : { status: "FAILED" as const };
    const requeued = await prisma.emailDelivery.updateMany({
      where,
      data: { status: "RETRY", attempts: 0, nextAttemptAt: new Date() },
    });
    if (requeued.count > 0) {
      await prisma.$transaction((tx) =>
        appendAuditEvent(tx, {
          actorId,
          action: "EMAIL_DELIVERY_REQUEUED",
          entityType: "EmailDelivery",
          metadata: { count: requeued.count, ...(ids ? { requestedIds: ids.length } : { scope: "all-failed" }) },
        }),
      );
    }
    return NextResponse.json({ ok: true, requeued: requeued.count });
  } catch (error) {
    const status = error instanceof AdminError ? error.status : 500;
    if (status === 500) console.error("Email requeue failed", error);
    return NextResponse.json(
      { error: status === 500 ? "Unable to requeue email deliveries." : (error as Error).message },
      { status },
    );
  }
}
