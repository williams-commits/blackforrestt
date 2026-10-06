import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { storage } from "@/server/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Liveness + dependency reachability. Caddy health checks target this, so
 * the response stays 200 while the DATABASE is up; the attachment-storage
 * probe is reported as a field (not a failure) — a read-only/unwritable
 * volume breaks uploads but shouldn't take the container out of rotation.
 */
export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch (error) {
    console.error("[crm/health] database check failed", error);
    return NextResponse.json(
      { status: "degraded", database: "down", timestamp: new Date().toISOString() },
      { status: 503 },
    );
  }

  // Write-and-clean probe: proves the volume is writable by THIS process
  // user (EACCES on a root-owned volume is the classic "upload not working
  // online" cause that never reproduces in local dev).
  let storageStatus = "up";
  try {
    const probeKey = `.health-probe-${randomUUID()}`;
    await storage().put(probeKey, Buffer.from("ok"), "text/plain");
    await storage().delete(probeKey);
  } catch (error) {
    storageStatus = `down: ${error instanceof Error ? error.message : "write failed"}`;
  }

  return NextResponse.json({
    status: "ok",
    database: "up",
    storage: storageStatus,
    timestamp: new Date().toISOString(),
  });
}
