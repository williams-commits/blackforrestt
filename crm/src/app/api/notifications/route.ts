import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { CrmError } from "@/server/guard";
import { countUnread, listNotifications, markAllRead, markNotificationRead, NotificationQuery, sweepOverdueTasks, sweepPlatformPresence } from "@/server/notifications";
import { handleRouteError } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function requireUserId(): Promise<string> {
  const session = await auth();
  if (!session?.user?.id) throw new CrmError("Unauthorized", 401);
  return session.user.id;
}

export async function GET(request: Request) {
  try {
    const userId = await requireUserId();
    // Lazy sweep: overdue/due-today notifications fire on read (idempotent).
    await sweepOverdueTasks(userId);
    await sweepPlatformPresence(userId);
    const query = NotificationQuery.parse(Object.fromEntries(new URL(request.url).searchParams));
    const [notifications, unread] = await Promise.all([
      listNotifications(userId, query),
      countUnread(userId),
    ]);
    return NextResponse.json({ data: notifications.rows, meta: { unread, total: notifications.total, page: notifications.page, pageSize: notifications.pageSize, hasMore: notifications.hasMore } });
  } catch (error) {
    return handleRouteError(error, "Unable to load notifications.");
  }
}

export async function PATCH(request: Request) {
  try {
    const userId = await requireUserId();
    const body = await request.json().catch(() => ({})) as { id?: unknown; read?: unknown };
    if (typeof body.id === "string") {
      const updated = await markNotificationRead(userId, body.id, body.read !== false);
      return NextResponse.json({ data: { updated } });
    }
    const updated = await markAllRead(userId);
    return NextResponse.json({ data: { marked: updated } });
  } catch (error) {
    return handleRouteError(error, "Unable to update notifications.");
  }
}
