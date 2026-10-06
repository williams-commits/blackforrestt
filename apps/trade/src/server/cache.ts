/**
 * Best-effort Redis cache for ephemeral external-feed data (news, economic
 * calendar). Never throws: if REDIS_URL is unset or Redis is unreachable, the
 * helpers resolve to a miss so the caller can fetch fresh and continue.
 *
 * This intentionally mirrors the connect-on-demand pattern in redis.ts but
 * swallows connection errors rather than propagating them, because external-feed
 * caching is an optimization, not a correctness requirement.
 */
import { getRedis } from "@/server/redis";

/** Read a cached JSON value, or null on any failure / miss. */
export async function cacheGet<T>(key: string): Promise<T | null> {
  if (!process.env.REDIS_URL?.trim()) return null;
  try {
    const redis = await getRedis();
    const raw = await redis.get(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

/** Write a JSON value with a TTL (seconds). Never throws. */
export async function cacheSet(key: string, value: unknown, ttlSeconds: number): Promise<void> {
  if (!process.env.REDIS_URL?.trim()) return;
  try {
    const redis = await getRedis();
    await redis.set(key, JSON.stringify(value), { EX: ttlSeconds });
  } catch {
    // Caching is best-effort; ignore write failures.
  }
}
