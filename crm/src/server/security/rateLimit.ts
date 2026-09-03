/**
 * In-memory sliding-window rate limiter. Deliberately process-local: the
 * CRM ships as a single app container (see DEPLOYMENT.md), so this is
 * effective for its deployment model without new infrastructure. If the
 * CRM is ever scaled horizontally, swap this module for a Redis-backed
 * implementation — the interface stays the same.
 *
 * Fail-open by design in the sense that a limiter error never blocks a
 * request; exhausted limits DO block with a retry-after hint.
 */

interface WindowState {
  hits: number[];
  lockedUntil?: number;
}

const buckets = new Map<string, WindowState>();

/** Prune periodically so the map cannot grow unbounded. */
const PRUNE_INTERVAL_MS = 5 * 60 * 1000;
let lastPrune = Date.now();

function prune(now: number) {
  if (now - lastPrune < PRUNE_INTERVAL_MS) return;
  lastPrune = now;
  for (const [key, state] of buckets) {
    if (state.hits.every((hit) => now - hit > 60 * 60 * 1000) && !state.lockedUntil) {
      buckets.delete(key);
    }
  }
}

export interface ConsumeResult {
  allowed: boolean;
  retryAfterMs: number;
}

/** Sliding window: allow at most `limit` events per `windowMs` per key. */
export function consume(key: string, limit: number, windowMs: number): ConsumeResult {
  try {
    const now = Date.now();
    prune(now);
    const state = buckets.get(key) ?? { hits: [] };
    state.hits = state.hits.filter((hit) => now - hit < windowMs);
    if (state.hits.length >= limit) {
      const oldest = state.hits[0]!;
      buckets.set(key, state);
      return { allowed: false, retryAfterMs: windowMs - (now - oldest) };
    }
    state.hits.push(now);
    buckets.set(key, state);
    return { allowed: true, retryAfterMs: 0 };
  } catch {
    return { allowed: true, retryAfterMs: 0 }; // never fail the request on limiter faults
  }
}

/**
 * Login lockout: after `maxFailures` failed passwords for one email within
 * the window, further attempts are refused until the lock expires. A
 * successful login clears the counter.
 */
const LOGIN_MAX_FAILURES = 5;
const LOGIN_WINDOW_MS = 10 * 60 * 1000;
const LOGIN_LOCK_MS = 10 * 60 * 1000;

const loginKey = (email: string) => `login:${email.toLowerCase()}`;

export function loginIsLocked(email: string): boolean {
  const state = buckets.get(loginKey(email));
  return Boolean(state?.lockedUntil && state.lockedUntil > Date.now());
}

export function recordLoginFailure(email: string): void {
  const key = loginKey(email);
  const state = buckets.get(key) ?? { hits: [] };
  const now = Date.now();
  state.hits = state.hits.filter((hit) => now - hit < LOGIN_WINDOW_MS);
  state.hits.push(now);
  if (state.hits.length >= LOGIN_MAX_FAILURES) {
    state.lockedUntil = now + LOGIN_LOCK_MS;
    state.hits = [];
  }
  buckets.set(key, state);
}

export function clearLoginFailures(email: string): void {
  buckets.delete(loginKey(email));
}

/** Mutation throttle for the API layer (per client IP). */
export function consumeApiMutation(ip: string): ConsumeResult {
  return consume(`api-mutation:${ip}`, 120, 60 * 1000);
}
