import { NextResponse } from "next/server";
import { AdminError, requireAdmin } from "@/server/admin";
import { prisma } from "@/server/db";
import { hub } from "@/server/engine/hub";
import { getMarketDataMode } from "@/server/engine/marketDataMode";
import { getRedis } from "@/server/redis";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function check<T>(fn: () => Promise<T>) {
  const started = performance.now();
  try {
    await fn();
    return { status: "UP", latencyMs: Math.round(performance.now() - started), error: null };
  } catch (error) {
    return { status: "DOWN", latencyMs: Math.round(performance.now() - started), error: error instanceof Error ? error.message : "Unknown error" };
  }
}

export async function GET() {
  try {
    await requireAdmin("SERVICE_HEALTH_READ");
    const [database, redis, latestReconciliation, activeBlocks, emailStatusCounts, lastFailedEmail] = await Promise.all([
      check(() => prisma.$queryRaw`SELECT 1`),
      check(async () => { const client = await getRedis(); await client.ping(); }),
      prisma.reconciliationRun.findFirst({ orderBy: { startedAt: "desc" }, select: { status: true, startedAt: true, completedAt: true, errorMessage: true } }),
      prisma.reconciliationBlock.count({ where: { releasedAt: null } }),
      prisma.emailDelivery.groupBy({ by: ["status"], _count: { _all: true } }),
      prisma.emailDelivery.findFirst({ where: { status: "FAILED" }, orderBy: { updatedAt: "desc" }, select: { recipient: true, template: true, lastError: true, updatedAt: true } }),
    ]);
    const engine = { status: hub.isReady() ? "UP" : "STARTING", instrumentsLoaded: hub.listInstruments().length };
    const healthy = database.status === "UP" && redis.status === "UP" && engine.status === "UP";
    const emailCounts = Object.fromEntries(emailStatusCounts.map((row) => [row.status, row._count._all]));
    return NextResponse.json({
      status: healthy ? "HEALTHY" : "DEGRADED",
      checkedAt: new Date().toISOString(),
      simulationOnly: true,
      executionProvider: "NOT_CONFIGURED",
      marketDataMode: getMarketDataMode(),
      services: { database, redis, engine },
      emailDelivery: {
        counts: emailCounts,
        failed: emailCounts.FAILED ?? 0,
        lastFailed: lastFailedEmail
          ? { ...lastFailedEmail, updatedAt: lastFailedEmail.updatedAt.toISOString() }
          : null,
      },
      reconciliation: latestReconciliation ? { ...latestReconciliation, startedAt: latestReconciliation.startedAt.toISOString(), completedAt: latestReconciliation.completedAt?.toISOString() ?? null, activeBlocks } : { status: "NEVER_RUN", activeBlocks },
    });
  } catch (error) {
    const status = error instanceof AdminError ? error.status : 500;
    return NextResponse.json({ error: status === 500 ? "Unable to read service health." : (error as Error).message }, { status });
  }
}
