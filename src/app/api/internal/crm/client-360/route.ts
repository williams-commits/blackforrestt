import { NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { requireBridgeToken } from "@/server/crmBridge";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * CRM bridge: read-only client-360 for a linked platform user — account
 * state, KYC status, wallet balances, and recent payment requests. The CRM
 * renders this on its Customer page; it can never write through here.
 */
export async function GET(request: Request) {
  const denied = requireBridgeToken(request);
  if (denied) return denied;
  const platformUserId = new URL(request.url).searchParams.get("platformUserId")?.trim() ?? "";
  if (!platformUserId) {
    return NextResponse.json({ error: "platformUserId is required." }, { status: 400 });
  }

  const user = await prisma.user.findFirst({
    where: { id: platformUserId, deletedAt: null },
    select: {
      id: true,
      email: true,
      name: true,
      createdAt: true,
      suspendedAt: true,
      blockedAt: true,
      emailVerifiedAt: true,
      kyc: { select: { status: true, submittedAt: true, reviewedAt: true } },
      wallets: { select: { asset: true, free: true, locked: true } },
    },
  });
  if (!user) {
    return NextResponse.json({ error: "Platform user not found." }, { status: 404 });
  }

  const payments = await prisma.paymentRequest.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: 5,
    select: {
      id: true,
      type: true,
      status: true,
      amount: true,
      asset: true,
      createdAt: true,
    },
  });
  const openPositions = await prisma.position.count({
    where: { userId: user.id, status: "OPEN" },
  });

  return NextResponse.json({
    data: {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        registeredAt: user.createdAt.toISOString(),
        state: user.blockedAt ? "BLOCKED" : user.suspendedAt ? "SUSPENDED" : "ACTIVE",
        emailVerified: Boolean(user.emailVerifiedAt),
      },
      kyc: user.kyc
        ? {
            status: user.kyc.status,
            submittedAt: user.kyc.submittedAt?.toISOString() ?? null,
            reviewedAt: user.kyc.reviewedAt?.toISOString() ?? null,
          }
        : null,
      wallets: user.wallets.map((wallet) => ({
        asset: wallet.asset,
        free: wallet.free.toString(),
        locked: wallet.locked.toString(),
      })),
      payments: payments.map((payment) => ({
        id: payment.id,
        type: payment.type,
        status: payment.status,
        amount: payment.amount.toString(),
        asset: payment.asset,
        createdAt: payment.createdAt.toISOString(),
      })),
      openPositions,
    },
  });
}
