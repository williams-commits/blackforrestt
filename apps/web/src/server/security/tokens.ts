import { Prisma } from "@prisma/client";
import { prisma } from "../db";
import { appendAuditEvent } from "../ledger";
import { hashSecurityToken, randomOpaqueToken } from "./crypto";

export type TokenPurpose = "EMAIL_VERIFICATION" | "PASSWORD_RESET";

const TOKEN_TTL_MS: Record<TokenPurpose, number> = {
  EMAIL_VERIFICATION: 24 * 60 * 60_000,
  PASSWORD_RESET: 30 * 60_000,
};

export async function issueSecurityToken(input: {
  userId: string;
  type: TokenPurpose;
}) {
  const token = randomOpaqueToken();
  const expiresAt = new Date(Date.now() + TOKEN_TTL_MS[input.type]);
  const record = await prisma.$transaction(async (tx) => {
    await tx.securityToken.updateMany({
      where: { userId: input.userId, type: input.type, consumedAt: null },
      data: { consumedAt: new Date() },
    });
    const created = await tx.securityToken.create({
      data: {
        userId: input.userId,
        type: input.type,
        tokenHash: hashSecurityToken(token),
        expiresAt,
      },
    });
    await appendAuditEvent(tx, {
      actorId: input.userId,
      action: `${input.type}_TOKEN_ISSUED`,
      entityType: "SecurityToken",
      entityId: created.id,
      metadata: { expiresAt: expiresAt.toISOString() },
    });
    return created;
  }, { isolationLevel: "Serializable" });
  return { token, expiresAt, record };
}

export async function consumeSecurityToken<T>(input: {
  token: string;
  type: TokenPurpose;
  apply: (
    tx: Prisma.TransactionClient,
    record: Prisma.SecurityTokenGetPayload<Record<string, never>>,
  ) => Promise<T>;
}): Promise<T | null> {
  const now = new Date();
  return prisma.$transaction(async (tx) => {
    const record = await tx.securityToken.findUnique({
      where: { tokenHash: hashSecurityToken(input.token) },
    });
    if (
      !record ||
      record.type !== input.type ||
      record.consumedAt ||
      record.expiresAt <= now
    ) {
      return null;
    }
    const consumed = await tx.securityToken.updateMany({
      where: {
        id: record.id,
        consumedAt: null,
        expiresAt: { gt: now },
      },
      data: { consumedAt: now },
    });
    if (consumed.count !== 1) return null;
    return input.apply(tx, record);
  }, { isolationLevel: "Serializable" });
}

export function applicationOrigin(): string {
  const value = process.env.APP_ORIGIN?.split(",")[0]?.trim();
  if (!value) {
    if (process.env.NODE_ENV === "production") throw new Error("APP_ORIGIN is required.");
    return "http://localhost:3000";
  }
  const parsed = new URL(value);
  const isLoopback = parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1" || parsed.hostname === "::1";
  if (process.env.NODE_ENV === "production" && parsed.protocol !== "https:" && !isLoopback) {
    throw new Error("APP_ORIGIN must use HTTPS in production except on loopback development hosts.");
  }
  return parsed.origin;
}


export { emailProviderConfigured as securityEmailProviderConfigured } from "../email/provider";

/**
 * Development-only email preview. This makes local registration, verification,
 * and password recovery testable without weakening production verification.
 * The raw single-use token is returned only when NODE_ENV is not production.
 */
export function developmentEmailPreviewEnabled(): boolean {
  return (
    process.env.NODE_ENV !== "production" &&
    (process.env.DEV_EMAIL_PREVIEW ?? "true").toLowerCase() === "true"
  );
}

export async function deliverSecurityEmail(input: {
  to: string;
  template: "verify-email" | "password-reset";
  actionUrl: string;
  expiresAt: Date;
  userId?: string;
  idempotencyKey?: string;
}) {
  const { sendImmediateEmail } = await import("../email/service");
  const user = input.userId ? await prisma.user.findUnique({ where: { id: input.userId }, select: { name: true } }) : null;
  const result = await sendImmediateEmail({
    userId: input.userId,
    to: input.to,
    template: input.template,
    variables: { name: user?.name ?? "there", actionUrl: input.actionUrl, expiresAt: input.expiresAt.toISOString() },
    idempotencyKey: input.idempotencyKey,
  });
  if (result.delivery !== "sent") throw new Error("Email delivery provider is not configured.");
}
