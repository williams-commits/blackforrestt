import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { CrmError } from "@/server/guard";
import { countUnread, listNotifications, markAllRead, markNotificationRead, markToasted, NotificationQuery, sweepOverdueTasks, sweepPlatformPresence, sweepTaskReminders } from "@/server/notifications";
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
    // Cheap counts scope for the steady-state bell poll: no sweeps, no list
    // query. The caller loads the full list only when unread actually grows
    // (the trading-platform toast cadence).
    if (new URL(request.url).searchParams.get("scope") === "counts") {
      const unread = await countUnread(userId);
      return NextResponse.json({ data: { unread } });
    }
    // Lazy sweep: overdue/due-today notifications fire on read (idempotent).
    await sweepOverdueTasks(userId);
    await sweepTaskReminders(userId);
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
    const body = await request.json().catch(() => ({})) as { id?: unknown; read?: unknown; ids?: unknown; toasted?: unknown };
    // Toast acknowledgements (platform pattern): decoupled from read state —
    // the unread badge survives the toast.
    if (Array.isArray(body.ids) && body.toasted === true) {
      const ids = body.ids.filter((id): id is string => typeof id === "string").slice(0, 100);
      const marked = await markToasted(userId, ids);
      return NextResponse.json({ data: { marked } });
    }
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
