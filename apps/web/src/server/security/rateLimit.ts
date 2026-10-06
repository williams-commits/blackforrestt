import { getRedis } from "../redis";
import { hashNetworkIdentifier } from "./crypto";

/**
 * Shared fixed-window rate limiter (Redis INCR + PEXPIRE, atomic via Lua).
 *
 * Semantics follow the login throttle: production fails CLOSED when Redis is
 * unavailable (a limiter that silently opens is not a control); development
 * falls back to a process-local counter so routes stay testable before the
 * Docker Redis service is up.
 *
 * Deliberately does NOT write an audit event on block: every blocked request
 * is attacker-driven, and audit appends serialize on a global advisory lock —
 * auditing blocks would let an attacker amplify a request flood into DB write
 * pressure. Route-level audits (e.g. LOGIN_THROTTLED) remain the pattern for
 * flows that need the signal.
 */

const INCREMENT_WINDOW_SCRIPT = `
local count = redis.call('INCR', KEYS[1])
if count == 1 then
  redis.call('PEXPIRE', KEYS[1], ARGV[1])
end
local ttl = redis.call('PTTL', KEYS[1])
return { count, ttl }
`;

export class RateLimitedError extends Error {
  /** Seconds until the window resets — use for the Retry-After header. */
  readonly retryAfterSeconds: number;

  constructor(retryAfterSeconds: number) {
    super("Too many requests. Please try again later.");
    this.name = "RateLimitedError";
    this.retryAfterSeconds = Math.max(1, Math.ceil(retryAfterSeconds));
  }
}

interface LocalCounter {
  count: number;
  expiresAt: number;
}

const localCounters = new Map<string, LocalCounter>();
let warnedAboutLocalLimiter = false;

function incrementLocal(key: string, windowMs: number): { count: number; ttlMs: number } {
  const now = Date.now();
  const existing = localCounters.get(key);
  if (!existing || existing.expiresAt <= now) {
    localCounters.set(key, { count: 1, expiresAt: now + windowMs });
    // Opportunistic sweep so the fallback map cannot grow unboundedly.
    if (localCounters.size > 10_000) {
      for (const [k, v] of localCounters) {
        if (v.expiresAt <= now) localCounters.delete(k);
      }
    }
    return { count: 1, ttlMs: windowMs };
  }
  existing.count += 1;
  return { count: existing.count, ttlMs: existing.expiresAt - now };
}

async function increment(key: string, windowMs: number): Promise<{ count: number; ttlMs: number }> {
  try {
    const redis = await getRedis();
    const result = await redis.eval(INCREMENT_WINDOW_SCRIPT, {
      keys: [key],
      arguments: [String(windowMs)],
    });
    const [countRaw, ttlRaw] = Array.isArray(result) ? result : [result, windowMs];
    return { count: Number(countRaw), ttlMs: Number(ttlRaw) > 0 ? Number(ttlRaw) : windowMs };
  } catch (error) {
    if (process.env.NODE_ENV === "production") throw error;
    if (!warnedAboutLocalLimiter) {
      warnedAboutLocalLimiter = true;
      console.warn("Redis is unavailable; using the development-only in-memory rate limiter.");
    }
    return incrementLocal(key, windowMs);
  }
}

/**
 * Consume one slot for `identifier` under `scope`. Throws RateLimitedError
 * when the limit is exceeded — map it to HTTP 429 with a Retry-After header.
 * Identifiers are hashed before use so no PII lands in Redis keys.
 */
export async function consumeRateLimit(input: {
  scope: string;
  identifier: string;
  limit: number;
  windowSeconds: number;
}): Promise<void> {
  const windowMs = Math.max(1, input.windowSeconds) * 1_000;
  const key = `security:ratelimit:${input.scope}:${hashNetworkIdentifier(input.identifier)}`;
  const { count, ttlMs } = await increment(key, windowMs);
  if (count > input.limit) throw new RateLimitedError(ttlMs / 1_000);
}
