import { NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { auth } from "@/auth";
import { prisma } from "@/server/db";
import { appendAuditEvent } from "@/server/ledger";
import {
  encryptSensitiveString,
  generateRecoveryCodes,
  generateTotpSecret,
  hashRecoveryCode,
  totpUri,
} from "@/server/security/crypto";
import { verifyMfaFactor } from "@/server/security/mfa";
import { revokeAllSecuritySessions } from "@/server/security/sessions";
import { appendSecurityAudit } from "@/server/security/audit";
import { brandName } from "@/lib/branding";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PasswordSchema = z.object({ currentPassword: z.string().min(1).max(128) });
const ConfirmSchema = z.object({ code: z.string().trim().min(6).max(64) });
const DisableSchema = z.object({
  currentPassword: z.string().min(1).max(128),
  code: z.string().trim().min(6).max(64),
});

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      mfaEnabledAt: true,
      _count: { select: { recoveryCodes: { where: { usedAt: null } } } },
    },
  });
  return NextResponse.json({
    enabled: user?.mfaEnabledAt != null,
    enabledAt: user?.mfaEnabledAt?.toISOString() ?? null,
    recoveryCodesRemaining: user?._count.recoveryCodes ?? 0,
  });
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const parsed = PasswordSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Current password is required." }, { status: 400 });
  const user = await prisma.user.findUnique({ where: { id: session.user.id } });
  if (!user?.passwordHash || !(await bcrypt.compare(parsed.data.currentPassword, user.passwordHash))) {
    await appendSecurityAudit({
      actorId: session.user.id,
      action: "MFA_ENROLLMENT_REJECTED",
      entityType: "User",
      entityId: session.user.id,
      metadata: { reason: "CURRENT_PASSWORD" },
    });
    return NextResponse.json({ error: "Current password is incorrect." }, { status: 403 });
  }
  if (user.mfaEnabledAt) return NextResponse.json({ error: "MFA is already enabled." }, { status: 409 });

  const secret = generateTotpSecret();
  await prisma.$transaction(async (tx) => {
    await tx.mfaRecoveryCode.deleteMany({ where: { userId: user.id } });
    await tx.user.update({
      where: { id: user.id },
      data: {
        mfaSecretEncrypted: encryptSensitiveString(secret),
        mfaLastUsedStep: null,
      },
    });
    await appendAuditEvent(tx, {
      actorId: user.id,
      action: "MFA_ENROLLMENT_STARTED",
      entityType: "User",
      entityId: user.id,
    });
  }, { isolationLevel: "Serializable" });
  return NextResponse.json({
    secret,
    otpauthUri: totpUri({
      secret,
      email: user.email ?? user.id,
      issuer: brandName(),
    }),
  });
}

export async function PATCH(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const parsed = ConfirmSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "A valid authenticator code is required." }, { status: 400 });

  const recoveryCodes = generateRecoveryCodes();
  const result = await prisma.$transaction(async (tx) => {
    const user = await tx.user.findUnique({ where: { id: session.user.id } });
    if (!user?.mfaSecretEncrypted || user.mfaEnabledAt) return null;
    const factor = await verifyMfaFactor(tx, {
      userId: user.id,
      encryptedSecret: user.mfaSecretEncrypted,
      code: parsed.data.code,
    });
    if (factor !== "TOTP") {
      await appendAuditEvent(tx, {
        actorId: user.id,
        action: "MFA_ENROLLMENT_CONFIRMATION_FAILED",
        entityType: "User",
        entityId: user.id,
      });
      return null;
    }
    const enabledAt = new Date();
    await tx.mfaRecoveryCode.createMany({
      data: recoveryCodes.map((code) => ({
        userId: user.id,
        codeHash: hashRecoveryCode(code),
      })),
    });
    await tx.user.update({ where: { id: user.id }, data: { mfaEnabledAt: enabledAt } });
    if (session.securitySessionId) {
      await tx.securitySession.updateMany({
        where: { id: session.securitySessionId, userId: user.id, revokedAt: null },
        data: { mfaVerifiedAt: enabledAt },
      });
    }
    await appendAuditEvent(tx, {
      actorId: user.id,
      action: "MFA_ENABLED",
      entityType: "User",
      entityId: user.id,
      metadata: { recoveryCodeCount: recoveryCodes.length },
    });
    return enabledAt;
  }, { isolationLevel: "Serializable" });
  if (!result) return NextResponse.json({ error: "Enrollment is missing or the code is invalid." }, { status: 400 });
  return NextResponse.json({
    enabled: true,
    enabledAt: result.toISOString(),
    recoveryCodes,
  });
}

export async function DELETE(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const parsed = DisableSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Password and MFA code are required." }, { status: 400 });
  const user = await prisma.user.findUnique({ where: { id: session.user.id } });
  if (!user?.passwordHash || !user.mfaSecretEncrypted || !user.mfaEnabledAt) {
    await appendSecurityAudit({
      actorId: session.user.id,
      action: "MFA_DISABLE_REJECTED",
      entityType: "User",
      entityId: session.user.id,
      metadata: { reason: "NOT_ENABLED" },
    });
    return NextResponse.json({ error: "MFA is not enabled." }, { status: 409 });
  }
  if (!(await bcrypt.compare(parsed.data.currentPassword, user.passwordHash))) {
    await appendSecurityAudit({
      actorId: user.id,
      action: "MFA_DISABLE_REJECTED",
      entityType: "User",
      entityId: user.id,
      metadata: { reason: "CURRENT_PASSWORD" },
    });
    return NextResponse.json({ error: "Current password is incorrect." }, { status: 403 });
  }
  const disabled = await prisma.$transaction(async (tx) => {
    const factor = await verifyMfaFactor(tx, {
      userId: user.id,
      encryptedSecret: user.mfaSecretEncrypted!,
      code: parsed.data.code,
    });
    if (!factor) {
      await appendAuditEvent(tx, {
        actorId: user.id,
        action: "MFA_DISABLE_REJECTED",
        entityType: "User",
        entityId: user.id,
        metadata: { reason: "MFA_FACTOR" },
      });
      return false;
    }
    await tx.mfaRecoveryCode.deleteMany({ where: { userId: user.id } });
    await tx.user.update({
      where: { id: user.id },
      data: {
        mfaSecretEncrypted: null,
        mfaEnabledAt: null,
        mfaLastUsedStep: null,
      },
    });
    await tx.securitySession.updateMany({
      where: { userId: user.id },
      data: { mfaVerifiedAt: null },
    });
    await appendAuditEvent(tx, {
      actorId: user.id,
      action: "MFA_DISABLED",
      entityType: "User",
      entityId: user.id,
      metadata: { factor },
    });
    return true;
  }, { isolationLevel: "Serializable" });
  if (!disabled) return NextResponse.json({ error: "MFA code is invalid." }, { status: 403 });
  await revokeAllSecuritySessions({
    userId: user.id,
    exceptSessionId: session.securitySessionId,
    reason: "MFA_DISABLED",
  });
  return NextResponse.json({ disabled: true });
}
