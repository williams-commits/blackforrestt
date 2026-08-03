import { prisma } from "../db";
import { getRedis } from "../redis";
import { appendAuditEvent } from "../ledger";
import { hashNetworkIdentifier } from "./crypto";

const WINDOW_SECONDS = 15 * 60;
const EMAIL_LIMIT = 5;
const NETWORK_LIMIT = 20;
const FAILURE_LOCK_THRESHOLD = 5;

const INCREMENT_WINDOW_SCRIPT = `
local count = redis.call('INCR', KEYS[1])
if count == 1 then
  redis.call('EXPIRE', KEYS[1], ARGV[1])
end
return count
`;

interface LocalCounter {
  count: number;
  expiresAt: number;
}

const localCounters = new Map<string, LocalCounter>();
let warnedAboutLocalThrottle = false;

export class LoginThrottledError extends Error {
  constructor() {
    super("Login temporarily unavailable.");
    this.name = "LoginThrottledError";
  }
}

export function requestNetworkAddress(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || request.headers.get("x-real-ip")?.trim() || "unknown";
}

function incrementLocal(key: string): number {
  const now = Date.now();
  const existing = localCounters.get(key);
  if (!existing || existing.expiresAt <= now) {
    localCounters.set(key, { count: 1, expiresAt: now + WINDOW_SECONDS * 1_000 });
    return 1;
  }
  existing.count += 1;
  return existing.count;
}

async function incrementCounters(emailKey: string, networkKey: string): Promise<[number, number]> {
  try {
    const redis = await getRedis();
    const [emailCountRaw, networkCountRaw] = await Promise.all([
      redis.eval(INCREMENT_WINDOW_SCRIPT, {
        keys: [emailKey],
        arguments: [WINDOW_SECONDS.toString()],
      }),
      redis.eval(INCREMENT_WINDOW_SCRIPT, {
        keys: [networkKey],
        arguments: [WINDOW_SECONDS.toString()],
      }),
    ]);
    return [Number(emailCountRaw), Number(networkCountRaw)];
  } catch (error) {
    // Production security controls fail closed. Local development may use a
    // process-local limiter so credentials login remains testable before the
    // Docker Redis service is started.
    if (process.env.NODE_ENV === "production") throw error;
    if (!warnedAboutLocalThrottle) {
      warnedAboutLocalThrottle = true;
      console.warn("Redis is unavailable; using the development-only in-memory login throttle.");
    }
    return [incrementLocal(emailKey), incrementLocal(networkKey)];
  }
}

export async function consumeLoginAttempt(email: string, networkAddress: string) {
  const emailHash = hashNetworkIdentifier(email.toLowerCase());
  const networkHash = hashNetworkIdentifier(networkAddress);
  const emailKey = `security:login:email:${emailHash}`;
  const networkKey = `security:login:network:${networkHash}`;
  const [emailCount, networkCount] = await incrementCounters(emailKey, networkKey);

  if (emailCount > EMAIL_LIMIT || networkCount > NETWORK_LIMIT) {
    await prisma.$transaction((tx) =>
      appendAuditEvent(tx, {
        action: "LOGIN_THROTTLED",
        entityType: "Authentication",
        metadata: { emailHash, networkHash, emailCount, networkCount },
      }),
    );
    throw new LoginThrottledError();
  }
  return { emailHash, networkHash };
}

export async function clearLoginThrottle(email: string): Promise<void> {
  const key = `security:login:email:${hashNetworkIdentifier(email.toLowerCase())}`;
  try {
    const redis = await getRedis();
    await redis.del(key);
  } catch (error) {
    if (process.env.NODE_ENV === "production") throw error;
    localCounters.delete(key);
  }
}

export async function recordLoginFailure(input: {
  userId?: string;
  emailHash: string;
  networkHash: string;
}) {
  await prisma.$transaction(async (tx) => {
    let lockedUntil: Date | null = null;
    let failures: number | null = null;
    if (input.userId) {
      const user = await tx.user.update({
        where: { id: input.userId },
        data: { failedLoginCount: { increment: 1 } },
        select: { failedLoginCount: true },
      });
      failures = user.failedLoginCount;
      if (failures >= FAILURE_LOCK_THRESHOLD) {
        const exponent = Math.min(failures - FAILURE_LOCK_THRESHOLD, 6);
        lockedUntil = new Date(Date.now() + 15 * 60_000 * 2 ** exponent);
        await tx.user.update({
          where: { id: input.userId },
          data: { lockedUntil },
        });
      }
    }
    await appendAuditEvent(tx, {
      actorId: input.userId ?? null,
      action: lockedUntil ? "ACCOUNT_LOCKED" : "LOGIN_FAILED",
      entityType: "Authentication",
      entityId: input.userId ?? null,
      metadata: {
        emailHash: input.emailHash,
        networkHash: input.networkHash,
        failures,
        lockedUntil: lockedUntil?.toISOString() ?? null,
      },
    });
  }, { isolationLevel: "Serializable" });
}

export async function recordLoginSuccess(input: {
  userId: string;
  sessionId: string;
  email: string;
  networkHash: string;
  mfa: boolean;
}) {
  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: input.userId },
      data: { failedLoginCount: 0, lockedUntil: null },
    });
    await appendAuditEvent(tx, {
      actorId: input.userId,
      action: "LOGIN_SUCCEEDED",
      entityType: "SecuritySession",
      entityId: input.sessionId,
      metadata: { networkHash: input.networkHash, mfa: input.mfa },
    });
  }, { isolationLevel: "Serializable" });
  await clearLoginThrottle(input.email);
}
