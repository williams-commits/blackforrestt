import { NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { auth } from "@/auth";
import { prisma } from "@/server/db";
import { appendAuditEvent } from "@/server/ledger";
import { verifyMfaFactor } from "@/server/security/mfa";
import { STEP_UP_MAX_AGE_MS } from "@/server/security/sessions";
import { appendSecurityAudit } from "@/server/security/audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Schema = z.object({
  currentPassword: z.string().min(1).max(128),
  code: z.string().trim().min(6).max(64),
});

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id || !session.securitySessionId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const parsed = Schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Password and MFA code are required." }, { status: 400 });
  const user = await prisma.user.findUnique({ where: { id: session.user.id } });
  if (!user?.passwordHash || !user.mfaSecretEncrypted || !user.mfaEnabledAt) {
    await appendSecurityAudit({
      actorId: session.user.id,
      action: "STEP_UP_AUTHENTICATION_FAILED",
      entityType: "SecuritySession",
      entityId: session.securitySessionId,
      metadata: { reason: "MFA_NOT_ENABLED" },
    });
    return NextResponse.json({ error: "Enable MFA before authorizing withdrawals." }, { status: 403 });
  }
  if (!(await bcrypt.compare(parsed.data.currentPassword, user.passwordHash))) {
    await appendSecurityAudit({
      actorId: user.id,
      action: "STEP_UP_AUTHENTICATION_FAILED",
      entityType: "SecuritySession",
      entityId: session.securitySessionId,
      metadata: { reason: "CURRENT_PASSWORD" },
    });
    return NextResponse.json({ error: "Step-up authentication failed." }, { status: 403 });
  }
  const verified = await prisma.$transaction(async (tx) => {
    const activeSession = await tx.securitySession.findFirst({
      where: {
        id: session.securitySessionId,
        userId: user.id,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      select: { id: true },
    });
    if (!activeSession) {
      await appendAuditEvent(tx, {
        actorId: user.id,
        action: "STEP_UP_AUTHENTICATION_FAILED",
        entityType: "SecuritySession",
        entityId: session.securitySessionId,
        metadata: { reason: "SESSION_INACTIVE" },
      });
      return null;
    }
    const factor = await verifyMfaFactor(tx, {
      userId: user.id,
      encryptedSecret: user.mfaSecretEncrypted!,
      code: parsed.data.code,
    });
    if (!factor) {
      await appendAuditEvent(tx, {
        actorId: user.id,
        action: "STEP_UP_AUTHENTICATION_FAILED",
        entityType: "SecuritySession",
        entityId: session.securitySessionId,
        metadata: { reason: "MFA_FACTOR" },
      });
      return null;
    }
    const verifiedAt = new Date();
    const updated = await tx.securitySession.updateMany({
      where: {
        id: session.securitySessionId,
        userId: user.id,
        revokedAt: null,
        expiresAt: { gt: verifiedAt },
      },
      data: { mfaVerifiedAt: verifiedAt },
    });
    if (updated.count !== 1) return null;
    await appendAuditEvent(tx, {
      actorId: user.id,
      action: "STEP_UP_AUTHENTICATION_SUCCEEDED",
      entityType: "SecuritySession",
      entityId: session.securitySessionId,
      metadata: { factor },
    });
    return verifiedAt;
  }, { isolationLevel: "Serializable" });
  if (!verified) return NextResponse.json({ error: "Step-up authentication failed." }, { status: 403 });
  return NextResponse.json({
    verifiedAt: verified.toISOString(),
    validForSeconds: STEP_UP_MAX_AGE_MS / 1000,
  });
}
