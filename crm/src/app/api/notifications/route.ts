import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { CrmError } from "@/server/guard";
import { countUnread, listNotifications, markAllRead, sweepOverdueTasks } from "@/server/notifications";
import { handleRouteError } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function requireUserId(): Promise<string> {
  const session = await auth();
  if (!session?.user?.id) throw new CrmError("Unauthorized", 401);
  return session.user.id;
}

export async function GET() {
  try {
    const userId = await requireUserId();
    // Lazy sweep: overdue/due-today notifications fire on read (idempotent).
    await sweepOverdueTasks(userId);
    const [notifications, unread] = await Promise.all([
      listNotifications(userId),
      countUnread(userId),
    ]);
    return NextResponse.json({ data: notifications, meta: { unread } });
  } catch (error) {
    return handleRouteError(error, "Unable to load notifications.");
  }
}

export async function PATCH() {
  try {
    const userId = await requireUserId();
    const updated = await markAllRead(userId);
    return NextResponse.json({ data: { marked: updated } });
  } catch (error) {
    return handleRouteError(error, "Unable to update notifications.");
  }
}
