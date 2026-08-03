import { NextResponse } from "next/server";
import { prisma, resolveUserId } from "@/server/db";
import { auth } from "@/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/notifications - latest account notifications for toast/UI feedback. */
export async function GET() {
  const session = await auth();
  const userId = await resolveUserId(session?.user?.id);
  const notifications = await prisma.notification.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: 10,
    select: { id: true, type: true, title: true, body: true, readAt: true, createdAt: true },
  });
  return NextResponse.json({
    notifications: notifications.map((item) => ({
      ...item,
      createdAt: item.createdAt.toISOString(),
      readAt: item.readAt?.toISOString() ?? null,
    })),
  });
}

/** PATCH /api/notifications - mark visible notifications as read. */
export async function PATCH(req: Request) {
  const session = await auth();
  const userId = await resolveUserId(session?.user?.id);
  const body = await req.json().catch(() => ({}));
  const ids = Array.isArray(body.ids)
    ? body.ids.filter((id: unknown): id is string => typeof id === "string" && id.length > 0)
    : [];
  if (ids.length === 0) return NextResponse.json({ updated: 0 });

  const result = await prisma.notification.updateMany({
    where: { userId, id: { in: ids }, readAt: null },
    data: { readAt: new Date() },
  });
  return NextResponse.json({ updated: result.count });
}
