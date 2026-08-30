/**
 * Periodic data-retention maintenance: a single Redis-leased leader runs the
 * sweep (multi-replica safe, same lease pattern as the reconciliation
 * scheduler). Prunes:
 *   - KYC identity documents past their retention window (applyRetention —
 *     previously implemented but never invoked; compliance required it).
 *   - Expired security tokens and long-dead security sessions.
 *   - Read notifications and terminal email deliveries past their windows.
 *
 * AuditEvent is deliberately NEVER pruned here: it is a hash-chained,
 * tamper-evident financial record whose legal retention outweighs table size.
 * Archived-audit design (if ever needed) must re-link the chain.
 */
import { randomUUID } from "node:crypto";
import { prisma } from "./db";
import { getRedis } from "./redis";
import { log } from "./logger";
import { appendAuditEvent } from "./ledger";
import { applyRetention } from "./security/kycDocuments";

const DEFAULT_INTERVAL_MS = 6 * 60 * 60_000; // every 6 hours
const LOCK_KEY = "maintenance:scheduler:leader";
const LOCK_LEASE_MS = 5 * 60_000;

function enabled(): boolean {
  return (process.env.MAINTENANCE_ENABLED ?? (process.env.NODE_ENV === "production" ? "true" : "false")).toLowerCase() === "true";
}

function intervalMs(): number {
  const value = Number(process.env.MAINTENANCE_INTERVAL_MS ?? DEFAULT_INTERVAL_MS);
  if (!Number.isFinite(value) || value < 60 * 60_000) return DEFAULT_INTERVAL_MS;
  return Math.floor(value);
}

function days(name: string, fallback: number): number {
  const value = Number(process.env[name]);
  if (!Number.isFinite(value) || value < 1) return fallback;
  return Math.min(3650, Math.floor(value));
}

export interface MaintenanceSummary {
  kycDocumentsDeleted: number;
  securityTokensPruned: number;
  securitySessionsPruned: number;
  notificationsPruned: number;
  emailDeliveriesPruned: number;
}

/** One maintenance pass. Every prune is bounded and safe to re-run. */
export async function runMaintenance(now = new Date()): Promise<MaintenanceSummary> {
  // KYC retention loops its internal 500-document batches to completion.
  let kycDocumentsDeleted = 0;
  for (let pass = 0; pass < 20; pass += 1) {
    const deleted = await applyRetention(now);
    kycDocumentsDeleted += deleted;
    if (deleted < 500) break;
  }

  const tokenCutoff = new Date(now.getTime() - days("RETENTION_SECURITY_TOKEN_DAYS", 30) * 86_400_000);
  const sessionCutoff = new Date(now.getTime() - days("RETENTION_SECURITY_SESSION_DAYS", 90) * 86_400_000);
  const notificationCutoff = new Date(now.getTime() - days("RETENTION_NOTIFICATION_DAYS", 180) * 86_400_000);
  const emailCutoff = new Date(now.getTime() - days("RETENTION_EMAIL_DELIVERY_DAYS", 90) * 86_400_000);

  const [securityTokensPruned, securitySessionsPruned, notificationsPruned, emailDeliveriesPruned] =
    await Promise.all([
      // Expired tokens keep their grace window so just-used reset links
      // cannot be resurrected from a prune race.
      prisma.securityToken.deleteMany({ where: { expiresAt: { lt: tokenCutoff } } }),
      // Only sessions that are BOTH ended (revoked/expired) AND old.
      prisma.securitySession.deleteMany({
        where: {
          OR: [{ revokedAt: { lt: sessionCutoff } }, { expiresAt: { lt: sessionCutoff } }],
        },
      }),
      // Read notifications only — unread ones are the user's pending signal.
      prisma.notification.deleteMany({
        where: { readAt: { not: null }, createdAt: { lt: notificationCutoff } },
      }),
      prisma.emailDelivery.deleteMany({
        where: { status: { in: ["SENT", "SKIPPED"] }, updatedAt: { lt: emailCutoff } },
      }),
    ]);

  const summary: MaintenanceSummary = {
    kycDocumentsDeleted,
    securityTokensPruned: securityTokensPruned.count,
    securitySessionsPruned: securitySessionsPruned.count,
    notificationsPruned: notificationsPruned.count,
    emailDeliveriesPruned: emailDeliveriesPruned.count,
  };

  const total = Object.values(summary).reduce((sum, count) => sum + count, 0);
  if (total > 0) {
    // Audited as maintenance provenance (what the retention policy removed).
    // FAILED email deliveries are retained — they are the operator's failure
    // signal until acknowledged.
    await prisma.$transaction((tx) =>
      appendAuditEvent(tx, {
        action: "MAINTENANCE_RETENTION_APPLIED",
        entityType: "System",
        metadata: { ...summary, at: now.toISOString() },
      }),
    ).catch((error) => log.error("maintenance audit append failed", { error: String(error) }));
  }
  return summary;
}

class MaintenanceScheduler {
  private timer: NodeJS.Timeout | null = null;
  private running = false;

  start(): void {
    if (this.timer || !enabled()) return;
    const interval = intervalMs();
    // Delay the startup pass off the boot critical path.
    const firstRun = setTimeout(() => void this.pass(), 60_000);
    firstRun.unref?.();
    this.timer = setInterval(() => void this.pass(), interval);
    this.timer.unref?.();
    log.info("maintenance scheduler started", { intervalMs: interval });
  }

  async stop(): Promise<void> {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  private async pass(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      const redis = await getRedis();
      const token = randomUUID();
      const acquired = await redis.set(LOCK_KEY, token, { NX: true, PX: LOCK_LEASE_MS });
      if (acquired !== "OK") return; // another replica owns the sweep
      try {
        const summary = await runMaintenance();
        log.info("maintenance pass complete", { ...summary });
      } finally {
        await redis.del(LOCK_KEY).catch(() => undefined);
      }
    } catch (error) {
      log.error("maintenance pass failed", { error: String(error) });
    } finally {
      this.running = false;
    }
  }
}

const globalForScheduler = globalThis as unknown as {
  __blckforest_maintenance_scheduler?: MaintenanceScheduler;
};
export const maintenanceScheduler =
  globalForScheduler.__blckforest_maintenance_scheduler ?? new MaintenanceScheduler();
if (process.env.NODE_ENV !== "production") {
  globalForScheduler.__blckforest_maintenance_scheduler = maintenanceScheduler;
}
