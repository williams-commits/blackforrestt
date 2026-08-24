import { NextResponse } from "next/server";
import { AdminError, hasAdminPermission, requireAdminContext } from "@/server/admin";
import { prisma } from "@/server/db";
import { hub } from "@/server/engine/hub";
import { getMarketDataMode } from "@/server/engine/marketDataMode";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Aggregate-only operations overview. Each statistic is omitted unless the
 * active role can enter the corresponding operational module. */
export async function GET() {
  try {
    const context = await requireAdminContext("ADMIN_DASHBOARD");
    const can = (permission: Parameters<typeof hasAdminPermission>[1]) => hasAdminPermission(context, permission);
    const [
      totalUsers,
      verifiedUsers,
      openPositions,
      closedPositions,
      pendingKyc,
      pendingPayments,
      openReconciliationCases,
      activeBlocks,
      openSupportCases,
      pendingChanges,
      auditEvents,
      loggedInSessions,
      tradingUsers,
    ] = await Promise.all([
      can("USER_READ") ? prisma.user.count() : null,
      can("USER_READ") ? prisma.user.count({ where: { verified: true } }) : null,
      can("EXECUTION_READ") ? prisma.position.count({ where: { status: "OPEN" } }) : null,
      can("EXECUTION_READ") ? prisma.position.count({ where: { status: "CLOSED" } }) : null,
      can("KYC_READ") ? prisma.kycSubmission.count({ where: { status: "PENDING" } }) : null,
      can("PAYMENT_READ") ? prisma.paymentRequest.count({ where: { status: { in: ["PENDING", "AWAITING_APPROVAL"] } } }) : null,
      can("RECONCILIATION_READ") ? prisma.reconciliationCase.count({ where: { status: { not: "RESOLVED" } } }) : null,
      can("RECONCILIATION_READ") ? prisma.reconciliationBlock.count({ where: { releasedAt: null } }) : null,
      can("SUPPORT_READ") ? prisma.supportCase.count({ where: { status: { in: ["OPEN", "IN_PROGRESS", "WAITING_CUSTOMER"] } } }) : null,
      can("CHANGE_REQUEST_READ") ? prisma.adminChangeRequest.count({ where: { status: "PENDING" } }) : null,
      can("AUDIT_READ") ? prisma.auditEvent.count() : null,
      // Users with an unrevoked, unexpired security session (may be idle).
      can("USER_READ")
        ? prisma.securitySession.findMany({
            where: { revokedAt: null, expiresAt: { gt: new Date() } },
            select: { userId: true },
            distinct: ["userId"],
          })
        : null,
      // Distinct users holding at least one open position right now.
      can("EXECUTION_READ")
        ? prisma.position.findMany({
            where: { status: "OPEN" },
            select: { userId: true },
            distinct: ["userId"],
          })
        : null,
    ]);
    return NextResponse.json({
      roles: context.roles,
      permissions: context.permissions,
      environment: {
        simulationOnly: true,
        executionProvider: "NOT_CONFIGURED",
        marketDataMode: getMarketDataMode(),
      },
      stats: {
        ...(totalUsers != null ? { totalUsers, verifiedUsers } : {}),
        // Live presence: WebSocket-connected users (online), authenticated
        // sessions (logged in), and users holding open positions (trading).
        ...(totalUsers != null ? { usersOnline: hub.onlineUserIds().size } : {}),
        ...(loggedInSessions != null ? { usersLoggedIn: loggedInSessions.length } : {}),
        ...(tradingUsers != null ? { usersTrading: tradingUsers.length } : {}),
        ...(openPositions != null ? { openPositions, closedPositions } : {}),
        ...(pendingKyc != null ? { pendingKyc } : {}),
        ...(pendingPayments != null ? { pendingPayments } : {}),
        ...(openReconciliationCases != null ? { openReconciliationCases, activeBlocks } : {}),
        ...(openSupportCases != null ? { openSupportCases } : {}),
        ...(pendingChanges != null ? { pendingChanges } : {}),
        ...(auditEvents != null ? { auditEvents } : {}),
      },
    });
  } catch (error) {
    const status = error instanceof AdminError ? error.status : 500;
    return NextResponse.json({ error: status === 500 ? "Unable to load administrative overview." : (error as Error).message }, { status });
  }
}
