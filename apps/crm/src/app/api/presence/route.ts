import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/server/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** A user is "online" while their heartbeat is fresher than this window. */
const ONLINE_WINDOW_MS = 90_000;

/**
 * Presence heartbeat: every open CRM client POSTs this periodically while
 * the app is in use. Reps and owners can then see who is online without
 * anyone exposing anything beyond "active in the CRM right now".
 */
export async function POST() {
  const session = await auth();
  if (!session?.user?.id) return new Response("Unauthorized", { status: 401 });
  await prisma.user.update({
    where: { id: session.user.id },
    data: { lastSeenAt: new Date() },
  });
  return NextResponse.json({ data: { ok: true } });
}

/** Who is online right now (any active staff member can see the team). */
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return new Response("Unauthorized", { status: 401 });
  const online = await prisma.user.findMany({
    where: { status: "ACTIVE", lastSeenAt: { gte: new Date(Date.now() - ONLINE_WINDOW_MS) } },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
  return NextResponse.json({ data: { online, serverTime: new Date().toISOString() } });
}
