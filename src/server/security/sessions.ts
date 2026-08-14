import { prisma } from "../db";
import { appendAuditEvent } from "../ledger";
import {
  hashNetworkIdentifier,
  randomSessionId,
} from "./crypto";

const SESSION_DURATION_MS = 30 * 24 * 60 * 60_000;
export const STEP_UP_MAX_AGE_MS = 10 * 60_000;

export async function createSecuritySession(input: {
  userId: string;
  deviceId: string;
  deviceName: string;
  userAgent?: string | null;
  networkAddress: string;
  mfaVerified: boolean;
}) {
  const now = new Date();
  return prisma.$transaction(async (tx) => {
    // Revoke any prior active sessions for the same (userId, deviceId) so
    // repeat logins from the same browser don't accumulate duplicate rows.
    const prior = await tx.securitySession.findMany({
      where: {
        userId: input.userId,
        deviceId: input.deviceId,
        revokedAt: null,
      },
      select: { id: true },
    });
    if (prior.length > 0) {
      await tx.securitySession.updateMany({
        where: { id: { in: prior.map((s) => s.id) } },
        data: { revokedAt: now },
      });
      await appendAuditEvent(tx, {
        actorId: input.userId,
        action: "SESSIONS_REVOKED",
        entityType: "SecuritySession",
        entityId: input.userId,
        metadata: { count: prior.length, reason: "SUPERSEDED" },
      });
    }

    const session = await tx.securitySession.create({
      data: {
        id: randomSessionId(),
        userId: input.userId,
        deviceId: input.deviceId.slice(0, 128),
        deviceName: input.deviceName.slice(0, 120),
        userAgent: input.userAgent?.slice(0, 500) ?? null,
        ipHash: hashNetworkIdentifier(input.networkAddress),
        mfaVerifiedAt: input.mfaVerified ? now : null,
        expiresAt: new Date(now.getTime() + SESSION_DURATION_MS),
      },
    });
    await appendAuditEvent(tx, {
      actorId: input.userId,
      action: "SECURITY_SESSION_CREATED",
      entityType: "SecuritySession",
      entityId: session.id,
      metadata: {
        deviceName: session.deviceName,
        mfaVerified: input.mfaVerified,
      },
    });
    return session;
  }, { isolationLevel: "Serializable" });
}

export async function validateSecuritySession(sessionId: string, userId: string) {
  const now = new Date();
  const session = await prisma.securitySession.findFirst({
    where: {
      id: sessionId,
      userId,
      revokedAt: null,
      expiresAt: { gt: now },
    },
  });
  if (!session) return null;
  if (now.getTime() - session.lastSeenAt.getTime() >= 5 * 60_000) {
    await prisma.securitySession.updateMany({
      where: { id: session.id, revokedAt: null },
      data: { lastSeenAt: now },
    });
  }
  return session;
}

export async function revokeSecuritySession(input: {
  actorId: string;
  sessionId: string;
  reason: string;
}) {
  return prisma.$transaction(async (tx) => {
    const session = await tx.securitySession.findFirst({
      where: { id: input.sessionId, userId: input.actorId },
    });
    if (!session) return false;
    if (!session.revokedAt) {
      await tx.securitySession.update({
        where: { id: session.id },
        data: { revokedAt: new Date() },
      });
      await appendAuditEvent(tx, {
        actorId: input.actorId,
        action: "SESSION_REVOKED",
        entityType: "SecuritySession",
        entityId: session.id,
        metadata: { reason: input.reason },
      });
    }
    return true;
  }, { isolationLevel: "Serializable" });
}

export async function revokeAllSecuritySessions(input: {
  userId: string;
  exceptSessionId?: string;
  reason: string;
}) {
  return prisma.$transaction(async (tx) => {
    const sessions = await tx.securitySession.findMany({
      where: {
        userId: input.userId,
        revokedAt: null,
        ...(input.exceptSessionId ? { id: { not: input.exceptSessionId } } : {}),
      },
      select: { id: true },
    });
    if (sessions.length === 0) return 0;
    await tx.securitySession.updateMany({
      where: { id: { in: sessions.map((session) => session.id) } },
      data: { revokedAt: new Date() },
    });
    await appendAuditEvent(tx, {
      actorId: input.userId,
      action: "SESSIONS_REVOKED",
      entityType: "User",
      entityId: input.userId,
      metadata: { count: sessions.length, reason: input.reason },
    });
    return sessions.length;
  }, { isolationLevel: "Serializable" });
}

export async function hasRecentStepUp(sessionId: string, userId: string) {
  const threshold = new Date(Date.now() - STEP_UP_MAX_AGE_MS);
  const session = await prisma.securitySession.findFirst({
    where: {
      id: sessionId,
      userId,
      revokedAt: null,
      expiresAt: { gt: new Date() },
      mfaVerifiedAt: { gte: threshold },
    },
    select: { id: true },
  });
  return session != null;
}
