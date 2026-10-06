import { randomUUID } from "node:crypto";
import type { ReconciliationRunTrigger } from "@prisma/client";
import { getRedis } from "./redis";
import {
  runReconciliation,
  scheduledReconciliationReference,
  type ReconciliationRunOptions,
  type RunSummary,
} from "./reconciliation";

const DEFAULT_INTERVAL_MS = 5 * 60_000;
const MIN_INTERVAL_MS = 60_000;
const DEFAULT_LOCK_LEASE_MS = 60_000;
const LOCK_KEY = "reconciliation:scheduler:leader";

const RENEW_SCRIPT = `
if redis.call('GET', KEYS[1]) == ARGV[1] then
  return redis.call('PEXPIRE', KEYS[1], ARGV[2])
end
return 0
`;

const RELEASE_SCRIPT = `
if redis.call('GET', KEYS[1]) == ARGV[1] then
  return redis.call('DEL', KEYS[1])
end
return 0
`;

function configuredInterval(): number {
  const value = Number(process.env.RECONCILIATION_INTERVAL_MS ?? DEFAULT_INTERVAL_MS);
  if (!Number.isFinite(value) || value <= 0) return DEFAULT_INTERVAL_MS;
  return Math.max(MIN_INTERVAL_MS, Math.floor(value));
}

function configuredLease(): number {
  const value = Number(process.env.RECONCILIATION_LOCK_LEASE_MS ?? DEFAULT_LOCK_LEASE_MS);
  if (!Number.isFinite(value) || value < 15_000) return DEFAULT_LOCK_LEASE_MS;
  return Math.floor(value);
}

function completedWindow(now: Date, interval: number): { windowStart: Date; windowEnd: Date } {
  const endMs = Math.floor(now.getTime() / interval) * interval;
  return {
    windowStart: new Date(endMs - interval),
    windowEnd: new Date(endMs),
  };
}

export class ReconciliationSchedulerBusyError extends Error {
  constructor() {
    super("Another reconciliation worker currently owns the scheduler lease.");
    this.name = "ReconciliationSchedulerBusyError";
  }
}

/**
 * Single reconciliation scheduler for a multi-replica deployment. Redis grants
 * one renewable lease while PostgreSQL run references provide durable replay
 * safety. Scheduled and manual invocations share this exact execution path.
 */
class ReconciliationScheduler {
  private timer: NodeJS.Timeout | null = null;
  private running: Promise<RunSummary> | null = null;
  private stopping = false;

  start(): void {
    if (this.timer) return;
    this.stopping = false;
    const interval = configuredInterval();
    // Catch up the most recently completed window immediately after startup.
    void this.runScheduledWindow("STARTUP_CATCHUP").catch((error) => {
      if (!(error instanceof ReconciliationSchedulerBusyError)) {
        console.error("Startup reconciliation failed:", error);
      }
    });
    this.timer = setInterval(() => {
      void this.runScheduledWindow("SCHEDULED").catch((error) => {
        if (!(error instanceof ReconciliationSchedulerBusyError)) {
          console.error("Scheduled reconciliation failed:", error);
        }
      });
    }, interval);
    this.timer.unref?.();
    console.info(`Reconciliation scheduler started (interval ${interval}ms).`);
  }

  async stop(): Promise<void> {
    this.stopping = true;
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    if (this.running) {
      await Promise.race([
        this.running.catch(() => undefined),
        new Promise<void>((resolve) => setTimeout(resolve, 10_000)),
      ]);
    }
  }

  async runNow(options: ReconciliationRunOptions): Promise<RunSummary> {
    if (this.stopping) throw new Error("Reconciliation scheduler is stopping.");
    if (this.running) throw new ReconciliationSchedulerBusyError();

    const pending = this.withDistributedLease(options);
    this.running = pending;
    try {
      return await pending;
    } finally {
      if (this.running === pending) this.running = null;
    }
  }

  private async runScheduledWindow(trigger: Extract<ReconciliationRunTrigger, "SCHEDULED" | "STARTUP_CATCHUP">) {
    const interval = configuredInterval();
    const { windowStart, windowEnd } = completedWindow(new Date(), interval);
    return this.runNow({
      trigger,
      reference: scheduledReconciliationReference(windowStart, windowEnd),
      windowStart,
      windowEnd,
    });
  }

  private async withDistributedLease(options: ReconciliationRunOptions): Promise<RunSummary> {
    const redis = await getRedis();
    const leaseMs = configuredLease();
    const token = randomUUID();
    const acquired = await redis.set(LOCK_KEY, token, { NX: true, PX: leaseMs });
    if (acquired !== "OK") throw new ReconciliationSchedulerBusyError();

    let leaseLost = false;
    let renewing = false;
    const renewEvery = Math.max(5_000, Math.floor(leaseMs / 3));
    const renewal = setInterval(() => {
      if (renewing || leaseLost) return;
      renewing = true;
      void redis
        .eval(RENEW_SCRIPT, {
          keys: [LOCK_KEY],
          arguments: [token, leaseMs.toString()],
        })
        .then((renewed) => {
          if (Number(renewed) !== 1) leaseLost = true;
        })
        .catch(() => {
          leaseLost = true;
        })
        .finally(() => {
          renewing = false;
        });
    }, renewEvery);
    renewal.unref?.();

    try {
      const result = await runReconciliation(options);
      if (leaseLost) {
        throw new Error(
          "The reconciliation worker lost its distributed lease. Review the completed run before retrying.",
        );
      }
      if (result.caseCount > 0) {
        console.warn(
          `Reconciliation run ${result.reference} found ${result.caseCount} case(s), ${result.blockCount} block(s).`,
        );
      }
      return result;
    } finally {
      clearInterval(renewal);
      await redis
        .eval(RELEASE_SCRIPT, { keys: [LOCK_KEY], arguments: [token] })
        .catch(() => undefined);
    }
  }
}

const globalForScheduler = globalThis as unknown as {
  __blckforest_recon_scheduler?: ReconciliationScheduler;
};
export const reconciliationScheduler =
  globalForScheduler.__blckforest_recon_scheduler ?? new ReconciliationScheduler();
if (process.env.NODE_ENV !== "production") {
  globalForScheduler.__blckforest_recon_scheduler = reconciliationScheduler;
}
