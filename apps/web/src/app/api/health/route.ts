import { NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { hub } from "@/server/engine/hub";
import { getRedis } from "@/server/redis";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Lightweight liveness/readiness probe for orchestration. */
export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    const redis = await getRedis();
    await redis.ping();
    const engineReady = hub.isReady();
    return NextResponse.json(
      { status: engineReady ? "ready" : "starting", database: "up", redis: "up", engine: engineReady ? "up" : "starting" },
      { status: engineReady ? 200 : 503 },
    );
  } catch (error) {
    console.error("Health check failed", error);
    return NextResponse.json(
      { status: "unavailable", database: "unknown", redis: "unknown", engine: hub.isReady() ? "up" : "down" },
      { status: 503 },
    );
  }
}
