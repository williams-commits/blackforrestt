/**
 * NextAuth (Auth.js v5) configuration.
 *
 * Uses the Credentials provider against our Prisma User table with bcrypt
 * password hashing. The browser holds a signed JWT, while a durable security
 * session record provides device visibility and immediate revocation.
 */
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/server/db";
import { appendAuditEvent } from "@/server/ledger";
import {
  consumeLoginAttempt,
  recordLoginFailure,
  recordLoginSuccess,
  requestNetworkAddress,
} from "@/server/security/loginThrottle";
import { verifyMfaFactor } from "@/server/security/mfa";
import {
  createSecuritySession,
  revokeSecuritySession,
  validateSecuritySession,
} from "@/server/security/sessions";

const CredentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  mfaCode: z.string().trim().max(64).optional(),
  deviceId: z.string().trim().min(8).max(128),
  deviceName: z.string().trim().min(1).max(120),
});

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: "jwt" },
  // Trust forwarded host headers automatically only in development. Production
  // deployments must opt in after the reverse proxy is configured correctly.
  trustHost:
    process.env.NODE_ENV !== "production" ||
    (process.env.AUTH_TRUST_HOST ?? "false").toLowerCase() === "true",
  pages: {
    signIn: "/login",
  },
  providers: [
    Credentials({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
        mfaCode: { label: "MFA code", type: "text" },
        deviceId: { label: "Device id", type: "text" },
        deviceName: { label: "Device name", type: "text" },
      },
      async authorize(raw, request) {
        const parsed = CredentialsSchema.safeParse(raw);
        if (!parsed.success) return null;
        const { password, mfaCode, deviceId, deviceName } = parsed.data;
        const email = parsed.data.email.toLowerCase();
        const networkAddress = requestNetworkAddress(request);
        const throttle = await consumeLoginAttempt(email, networkAddress);
        const user = await prisma.user.findUnique({
          where: { email },
          include: {
            adminRoles: {
              where: { revokedAt: null },
              select: { role: true },
            },
          },
        });
        if (!user || !user.passwordHash) {
          await recordLoginFailure({
            emailHash: throttle.emailHash,
            networkHash: throttle.networkHash,
          });
          return null;
        }

        if (user.lockedUntil && user.lockedUntil > new Date()) {
          await prisma.$transaction((tx) =>
            appendAuditEvent(tx, {
              actorId: user.id,
              action: "LOCKED_ACCOUNT_LOGIN_BLOCKED",
              entityType: "User",
              entityId: user.id,
              metadata: {
                lockedUntil: user.lockedUntil?.toISOString() ?? null,
                networkHash: throttle.networkHash,
              },
            }),
          );
          return null;
        }
        // Admin account-management states (suspend / block / soft-delete) all
        // block sign-in. Audited so operators can see blocked attempts.
        const managementBlockReason = user.deletedAt
          ? "DELETED"
          : user.blockedAt
            ? "BLOCKED"
            : user.suspendedAt
              ? "SUSPENDED"
              : null;
        if (managementBlockReason) {
          await prisma.$transaction((tx) =>
            appendAuditEvent(tx, {
              actorId: user.id,
              action: "ACCOUNT_STATE_LOGIN_BLOCKED",
              entityType: "User",
              entityId: user.id,
              metadata: { reason: managementBlockReason, networkHash: throttle.networkHash },
            }),
          );
          return null;
        }
        if (!user.emailVerifiedAt) {
          await prisma.$transaction((tx) =>
            appendAuditEvent(tx, {
              actorId: user.id,
              action: "UNVERIFIED_EMAIL_LOGIN_BLOCKED",
              entityType: "User",
              entityId: user.id,
              metadata: { networkHash: throttle.networkHash },
            }),
          );
          return null;
        }
        if (!user.passwordHash) return null;
        const ok = await bcrypt.compare(password, user.passwordHash);
        if (!ok) {
          await recordLoginFailure({
            userId: user.id,
            emailHash: throttle.emailHash,
            networkHash: throttle.networkHash,
          });
          return null;
        }

        let mfaVerified = false;
        if (user.mfaEnabledAt) {
          if (!user.mfaSecretEncrypted || !mfaCode) {
            await recordLoginFailure({
              userId: user.id,
              emailHash: throttle.emailHash,
              networkHash: throttle.networkHash,
            });
            return null;
          }
          const factor = await prisma.$transaction(
            async (tx) => {
              const result = await verifyMfaFactor(tx, {
                userId: user.id,
                encryptedSecret: user.mfaSecretEncrypted!,
                code: mfaCode,
              });
              if (result) {
                await appendAuditEvent(tx, {
                  actorId: user.id,
                  action: "MFA_LOGIN_VERIFIED",
                  entityType: "User",
                  entityId: user.id,
                  metadata: { factor: result },
                });
              }
              return result;
            },
            { isolationLevel: "Serializable" },
          );
          if (!factor) {
            await recordLoginFailure({
              userId: user.id,
              emailHash: throttle.emailHash,
              networkHash: throttle.networkHash,
            });
            return null;
          }
          mfaVerified = true;
        }

        const securitySession = await createSecuritySession({
          userId: user.id,
          deviceId,
          deviceName,
          userAgent: request.headers.get("user-agent"),
          networkAddress,
          mfaVerified,
        });
        await recordLoginSuccess({
          userId: user.id,
          sessionId: securitySession.id,
          email,
          networkHash: throttle.networkHash,
          mfa: mfaVerified,
        });
        return {
          id: user.id,
          email: user.email ?? undefined,
          name: user.name ?? undefined,
          role: user.isAdmin || user.adminRoles.length > 0 ? "admin" : "user",
          adminRoles: user.adminRoles.map((assignment) => assignment.role),
          securitySessionId: securitySession.id,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
        token.adminRoles = user.adminRoles;
        token.securitySessionId = user.securitySessionId;
        return token;
      }
      if (
        typeof token.id === "string" &&
        typeof token.securitySessionId === "string"
      ) {
        const active = await validateSecuritySession(token.securitySessionId, token.id);
        if (!active) {
          delete token.id;
          delete token.role;
          delete token.adminRoles;
          delete token.securitySessionId;
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (typeof token.id === "string" && session.user) {
        session.user.id = token.id;
      }
      if (typeof token.role === "string" && session.user) {
        session.user.role = token.role;
      }
      if (Array.isArray(token.adminRoles) && session.user) {
        session.user.adminRoles = token.adminRoles.filter((role): role is string => typeof role === "string");
      }
      session.securitySessionId =
        typeof token.securitySessionId === "string"
          ? token.securitySessionId
          : undefined;
      return session;
    },
  },
  events: {
    async signOut(message) {
      if (
        "token" in message &&
        typeof message.token?.id === "string" &&
        typeof message.token.securitySessionId === "string"
      ) {
        await revokeSecuritySession({
          actorId: message.token.id,
          sessionId: message.token.securitySessionId,
          reason: "SIGN_OUT",
        });
      }
    },
  },
});

/** Hash a password for storage. */
export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 12);
}
