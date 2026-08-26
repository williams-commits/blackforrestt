/**
 * Referral engine — generates referral codes, processes rewards on first deposit.
 *
 * Uses the existing BONUS ledger mechanism (postClientEconomicEvent) for crediting,
 * the hash-chained audit trail, and the per-user/group settings cascade for
 * configurable reward amounts.
 */

import { Prisma } from "@prisma/client";
import { prisma } from "./db";
import { postClientEconomicEvent } from "./accountingCommands";
import { appendAuditEvent } from "./ledger";
import { resolveUserSettings } from "./userSettings";
import { tradeHostForDomain } from "../lib/branding";

const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no ambiguous chars (0/O, 1/I/L)
const CODE_LENGTH = 8;

/** Generate a random 8-char referral code (unambiguous alphabet). */
function randomCode(): string {
  let code = "";
  for (let i = 0; i < CODE_LENGTH; i++) {
    code += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  }
  return code;
}

/**
 * Get or create a user's referral code. Called on first access to the
 * Referrals tab or when generating a shareable link.
 */
export async function getOrCreateReferralCode(userId: string): Promise<string> {
  const existing = await prisma.referralCode.findUnique({ where: { userId } });
  if (existing) return existing.code;

  // Generate a unique code (retry on collision).
  for (let attempt = 0; attempt < 10; attempt++) {
    const code = randomCode();
    try {
      const created = await prisma.referralCode.create({
        data: { userId, code },
      });
      return created.code;
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") continue;
      throw e;
    }
  }
  throw new Error("Failed to generate a unique referral code after 10 attempts.");
}

/**
 * Create a pending referral relationship when a new user signs up with a code.
 * Returns the referral or null if the code is invalid/self-referral.
 */
export async function createReferral(
  referrerCode: string,
  referredUserId: string,
): Promise<{ id: string; referrerId: string } | null> {
  const code = referrerCode.trim().toUpperCase();
  if (!code) return null;

  const referrerCodeRow = await prisma.referralCode.findUnique({
    where: { code },
    select: { userId: true },
  });
  if (!referrerCodeRow) return null;

  // Prevent self-referral.
  if (referrerCodeRow.userId === referredUserId) return null;

  // Prevent double-referral (user already has a referrer).
  const existing = await prisma.referral.findUnique({ where: { referredId: referredUserId } });
  if (existing) return null;

  // Resolve reward amounts from referrer's settings (per-group overrides).
  const settings = await resolveUserSettings(referrerCodeRow.userId);
  // The referrer's referrals.enabled toggle governs their program: disabled
  // means their code is not accepted (same as an invalid code).
  if (!settings.referrals.enabled) return null;
  const referrerReward = settings.referrals?.referrerReward ?? 25;
  const referredReward = settings.referrals?.referredReward ?? 10;

  const referral = await prisma.referral.create({
    data: {
      referrerId: referrerCodeRow.userId,
      referredId: referredUserId,
      code,
      status: "PENDING",
      referrerReward,
      referredReward,
    },
    select: { id: true, referrerId: true },
  });

  return referral;
}

/**
 * Process a referral reward when the referred user makes their first deposit.
 * Credits both the referrer and the referred user, updates status, sends emails.
 * Idempotent — safe to call multiple times (status check prevents double-credit).
 */
export async function processReferralReward(
  referredUserId: string,
  actorId: string = "system",
): Promise<{ rewarded: boolean; referralId?: string; referrerId?: string }> {
  const referral = await prisma.referral.findUnique({
    where: { referredId: referredUserId },
    select: { id: true, referrerId: true, status: true, referrerReward: true, referredReward: true },
  });

  if (!referral || referral.status !== "PENDING") {
    return { rewarded: false };
  }

  // Check that this is actually the user's first real deposit (not demo funding).
  const depositCount = await prisma.paymentRequest.count({
    where: {
      userId: referredUserId,
      type: "DEPOSIT",
      status: "APPROVED",
    },
  });
  if (depositCount === 0) return { rewarded: false };

  const referrerAmount = Number(referral.referrerReward);
  const referredAmount = Number(referral.referredReward);

  // Per-user/group maxCreditBonus caps total bonus accumulation. Each side's
  // reward is clamped to their remaining headroom (skipped entirely at 0) —
  // resolved per user, defaulting to the platform cap when unset.
  const [referrerHeadroom, referredHeadroom] = await Promise.all([
    bonusHeadroom(referral.referrerId),
    bonusHeadroom(referredUserId),
  ]);
  const cappedReferrerAmount = Math.max(0, Math.min(referrerAmount, referrerHeadroom));
  const cappedReferredAmount = Math.max(0, Math.min(referredAmount, referredHeadroom));

  // Atomically update status first (prevents concurrent double-processing).
  const updated = await prisma.referral.updateMany({
    where: { id: referral.id, status: "PENDING" },
    data: { status: "COMPLETED", completedAt: new Date() },
  });
  if (updated.count === 0) return { rewarded: false }; // Already processed.

  // Credit referrer (own transaction, idempotent key prevents double-credit).
  if (cappedReferrerAmount > 0) {
    await postClientEconomicEvent({
      userId: referral.referrerId,
      kind: "BONUS",
      clientAmount: new Prisma.Decimal(cappedReferrerAmount),
      asset: "USD",
      idempotencyKey: `referral-referrer-${referral.id}`,
      description: `Referral bonus — your referral made their first deposit`,
      sourceType: "ReferralReward",
      sourceId: referral.id,
    });
  }

  // Credit referred user.
  if (cappedReferredAmount > 0) {
    await postClientEconomicEvent({
      userId: referredUserId,
      kind: "BONUS",
      clientAmount: new Prisma.Decimal(cappedReferredAmount),
      asset: "USD",
      idempotencyKey: `referral-referred-${referral.id}`,
      description: `Sign-up bonus from referral code`,
      sourceType: "ReferralReward",
      sourceId: referral.id,
    });
  }

  // Audit.
  await prisma.$transaction(async (tx) => {
    await appendAuditEvent(tx, {
      actorId,
      action: "REFERRAL_REWARD_PROCESSED",
      entityType: "Referral",
      entityId: referral.id,
      metadata: {
        referrerId: referral.referrerId,
        referredId: referredUserId,
        referrerReward: cappedReferrerAmount,
        referredReward: cappedReferredAmount,
        ...(cappedReferrerAmount < referrerAmount || cappedReferredAmount < referredAmount
          ? { cappedByMaxCreditBonus: true }
          : {}),
      },
    });
  });

  return { rewarded: true, referralId: referral.id, referrerId: referral.referrerId };
}

/**
 * Remaining bonus headroom for a user under their resolved balance
 * .maxCreditBonus (per-user → group → platform default): the cap minus
 * bonuses already granted (BONUS transactions). Returns a large number when
 * no cap applies (null cap = unlimited).
 */
async function bonusHeadroom(userId: string): Promise<number> {
  const settings = await resolveUserSettings(userId);
  const cap = settings.balance.maxCreditBonus;
  if (cap == null) return Number.POSITIVE_INFINITY;
  const granted = await prisma.transaction.aggregate({
    where: { userId, type: "BONUS", status: "COMPLETED" },
    _sum: { amount: true },
  });
  const total = Number(granted._sum.amount ?? 0);
  return Math.max(0, cap - total);
}

/** Increment click count when someone visits a referral link. */
export async function trackReferralClick(code: string): Promise<void> {
  try {
    await prisma.referralCode.update({
      where: { code: code.toUpperCase() },
      data: { clicks: { increment: 1 } },
    });
  } catch {
    // Non-fatal — invalid codes silently ignored.
  }
}

/** Get referral stats for a user (for the Referrals tab). The optional
 *  fallbackDomain is the REQUESTING family — used when the user has no stored
 *  brandDomain (accounts created before per-brand signups), so a legacy
 *  customer browsing referrals on agilefgs.com still gets an agilefgs link. */
export async function getReferralStats(userId: string, fallbackDomain?: string | null) {
  const [code, referrer, referrals] = await Promise.all([
    getOrCreateReferralCode(userId),
    prisma.user.findUnique({ where: { id: userId }, select: { brandDomain: true } }),
    prisma.referral.findMany({
      where: { referrerId: userId },
      select: {
        id: true,
        status: true,
        referrerReward: true,
        createdAt: true,
        completedAt: true,
        referred: { select: { name: true, email: true, accountNo: true, verified: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const total = referrals.length;
  const completed = referrals.filter((r) => r.status === "COMPLETED").length;
  const pending = referrals.filter((r) => r.status === "PENDING").length;
  const totalEarned = referrals
    .filter((r) => r.status === "COMPLETED")
    .reduce((sum, r) => sum + Number(r.referrerReward), 0);

  return {
    code,
    // Referral links stay in the REFERRER'S brand family — an Agile FGS
    // customer's link points at trade.agilefgs.com, never the primary host.
    link: `${tradeHostForDomain(referrer?.brandDomain ?? fallbackDomain)}/register?ref=${code}`,
    stats: { total, completed, pending, totalEarned },
    referrals: referrals.map((r) => ({
      id: r.id,
      status: r.status,
      reward: Number(r.referrerReward),
      createdAt: r.createdAt.toISOString(),
      completedAt: r.completedAt?.toISOString() ?? null,
      referred: {
        name: r.referred.name,
        email: r.referred.email?.replace(/(.{2}).*(@.*)/, "$1***$2") ?? null,
        accountNo: r.referred.accountNo,
        verified: r.referred.verified,
      },
    })),
  };
}
