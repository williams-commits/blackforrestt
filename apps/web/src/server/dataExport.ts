/**
 * Self-service personal-data export (GDPR Art. 20 / data portability).
 * Collects everything the platform holds about one user, EXCLUDING secrets
 * (password hashes, MFA secrets, encrypted payment method details — those
 * are either credentials or unrecoverable ciphertext) and other people's
 * data (counterparty identity in messages stays, as correspondence is the
 * user's own record; admin-internal notes on the user's support cases are
 * operator work product and are included for transparency).
 */
import { prisma } from "./db";
import { appendAuditEvent } from "./ledger";
import { log, requestIdOf } from "./logger";

const HISTORY_LIMIT = 500;

export async function buildUserDataExport(userId: string, request?: Request): Promise<Record<string, unknown>> {
  const [
    user,
    wallets,
    metrics,
    positions,
    transactions,
    payments,
    notifications,
    messagesSent,
    messagesReceived,
    supportCases,
    referralsGiven,
    referralCodeRows,
    kycSubmissions,
    sessions,
    auditTrail,
  ] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true, email: true, name: true, accountNo: true, createdAt: true,
        verified: true, emailVerifiedAt: true, brandDomain: true,
        suspendedAt: true, blockedAt: true, deletedAt: true,
        isAdmin: true, mfaEnabledAt: true,
      },
    }),
    prisma.wallet.findMany({ where: { userId }, select: { asset: true, free: true, locked: true } }),
    prisma.accountMetrics.findUnique({
      where: { userId },
      select: { balance: true, credit: true, margin: true, floatingPl: true },
    }),
    prisma.position.findMany({
      where: { userId },
      orderBy: { openedAt: "desc" },
      take: HISTORY_LIMIT,
      select: {
        symbol: true, side: true, type: true, volume: true, status: true,
        openRate: true, currentRate: true, profit: true, swap: true,
        openedAt: true, closedAt: true, closeReason: true,
      },
    }),
    prisma.transaction.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: HISTORY_LIMIT,
      select: { type: true, status: true, amount: true, asset: true, description: true, reference: true, createdAt: true },
    }),
    prisma.paymentRequest.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: HISTORY_LIMIT,
      select: {
        type: true, status: true, amount: true, asset: true, method: true,
        externalReference: true, createdAt: true, reviewedAt: true,
        reconciliationStatus: true, reviewerNote: true,
      },
    }),
    prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: HISTORY_LIMIT,
      select: { type: true, title: true, body: true, createdAt: true, readAt: true },
    }),
    prisma.directMessage.findMany({
      where: { senderId: userId },
      orderBy: { createdAt: "desc" },
      take: 250,
      select: { body: true, createdAt: true, readAt: true },
    }),
    prisma.directMessage.findMany({
      where: { recipientId: userId },
      orderBy: { createdAt: "desc" },
      take: 250,
      select: { body: true, createdAt: true, readAt: true },
    }),
    prisma.supportCase.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 100,
      select: { reference: true, subject: true, category: true, priority: true, status: true, resolutionNote: true, createdAt: true, resolvedAt: true, closedAt: true },
    }),
    prisma.referral.findMany({
      where: { referrerId: userId },
      orderBy: { createdAt: "desc" },
      take: 200,
      select: { status: true, referrerReward: true, createdAt: true, completedAt: true },
    }),
    prisma.referralCode.findMany({
      where: { userId },
      select: { code: true, createdAt: true },
    }),
    prisma.kycSubmission.findMany({
      where: { userId },
      orderBy: { submittedAt: "desc" },
      select: { status: true, submittedAt: true, reviewedAt: true, note: true },
    }),
    prisma.securitySession.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: { deviceId: true, deviceName: true, userAgent: true, createdAt: true, revokedAt: true, lastSeenAt: true },
    }),
    prisma.auditEvent.findMany({
      where: { actorId: userId },
      orderBy: { createdAt: "desc" },
      take: 200,
      select: { action: true, entityType: true, createdAt: true, metadata: true },
    }),
  ]);

  if (!user) throw new Error("User not found.");

  await prisma.$transaction((tx) =>
    appendAuditEvent(tx, {
      actorId: userId,
      action: "PERSONAL_DATA_EXPORTED",
      entityType: "User",
      entityId: userId,
      requestId: request ? requestIdOf(request) : null,
      metadata: { via: "self-service" },
    }),
  ).catch((error) => log.error("export audit append failed", { error: String(error) }));

  return {
    exportedAt: new Date().toISOString(),
    scope: "All personal data held by the platform for this account, excluding credentials and unrecoverable ciphertext.",
    profile: user,
    wallets,
    accountMetrics: metrics,
    positions,
    transactions,
    payments,
    notifications,
    messages: { sent: messagesSent, received: messagesReceived },
    supportCases,
    referrals: { code: referralCodeRows, given: referralsGiven },
    kycSubmissions,
    securitySessions: sessions,
    auditTrail,
  };
}
