import { NextResponse } from "next/server";
import { prisma } from "@/server/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Liveness + database reachability. Caddy health checks can target this. */
export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({ status: "ok", database: "up", timestamp: new Date().toISOString() });
  } catch (error) {
    console.error("[crm/health] database check failed", error);
    return NextResponse.json(
      { status: "degraded", database: "down", timestamp: new Date().toISOString() },
      { status: 503 },
    );
  }
}
