import { NextResponse } from "next/server";
import { prisma, resolveUserId } from "@/server/db";
import { auth } from "@/auth";
import { countUnreadDirectMessages } from "@/server/adminUserManagement";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Notification groups — the tab filters in the Notifications UI. */
const NOTIFICATION_GROUPS: Record<string, string[]> = {
  messages: ["ADMIN_CHAT", "ADMIN_MESSAGE", "ADMIN_BROADCAST", "CUSTOMER_MESSAGE"],
  payments: ["PAYMENT_APPROVED", "PAYMENT_REJECTED", "PAYMENT_PREPARED", "PAYMENT_CANCELLED", "PAYMENT_REVERSED"],
  trades: ["TRADE_OPENED", "TRADE_CLOSED"],
  account: ["ACCOUNT_STATUS"],
};

/**
 * GET /api/notifications — persisted notification history.
 *   Default: latest 10 (toast polling, backwards compatible).
 *   ?scope=all&limit=&offset= : full history for the notifications page.
 * Always returns unreadCount / unreadMessages for badge UIs.
 */
export async function GET(req: Request) {
  const session = await auth();
  const userId = await resolveUserId(session?.user?.id);
  const params = new URL(req.url).searchParams;
  const scope = params.get("scope") ?? "recent";
  const group = params.get("group");
  const groupTypes = group && group in NOTIFICATION_GROUPS ? NOTIFICATION_GROUPS[group] : null;
  const limit = Math.min(100, Math.max(1, Number(params.get("limit") ?? 10) || 10));
  const offset = Math.max(0, Number(params.get("offset") ?? 0) || 0);

  // Lightweight badge poll — just the three counts.
  if (scope === "counts") {
    const [unreadCount, unreadMessages, openSupportCases] = await Promise.all([
      prisma.notification.count({ where: { userId, readAt: null } }),
      countUnreadDirectMessages(userId),
      prisma.supportCase.count({ where: { userId, status: { in: ["OPEN", "IN_PROGRESS", "WAITING_CUSTOMER"] } } }),
    ]);
    return NextResponse.json({ unreadCount, unreadMessages, openSupportCases });
  }

  const baseWhere = { userId, ...(groupTypes ? { type: { in: groupTypes } } : {}) };
  const [notifications, unreadCount, unreadMessages, groupCountRows] = await Promise.all([
    prisma.notification.findMany({
      where: baseWhere,
      orderBy: { createdAt: "desc" },
      take: limit,
      skip: offset,
      select: { id: true, type: true, title: true, body: true, readAt: true, toastedAt: true, createdAt: true, metadata: true },
    }),
    prisma.notification.count({ where: { ...baseWhere, readAt: null } }),
    countUnreadDirectMessages(userId),
    prisma.notification.groupBy({ by: ["type"], where: { userId }, _count: { _all: true } }),
  ]);
  // Per-group totals for the tab chips (across ALL notifications, not the page).
  const groupCounts: Record<string, number> = { all: 0, messages: 0, payments: 0, trades: 0, account: 0 };
  for (const row of groupCountRows) {
    groupCounts.all += row._count._all;
    for (const [name, types] of Object.entries(NOTIFICATION_GROUPS)) {
      if (types.includes(row.type)) groupCounts[name] += row._count._all;
    }
  }

  return NextResponse.json({
    scope,
    group: group ?? "all",
    groupCounts,
    notifications: notifications.map((item) => ({
      ...item,
      createdAt: item.createdAt.toISOString(),
      readAt: item.readAt?.toISOString() ?? null,
      toastedAt: item.toastedAt?.toISOString() ?? null,
    })),
    unreadCount,
    unreadMessages,
  });
}

/**
 * PATCH /api/notifications — acknowledgment modes.
 *   { ids: string[] }        : mark the given notifications READ (user opened
 *                              the Notifications tab / clicked an item).
 *   { all: true }            : mark every unread notification read.
 *   { ids, toasted: true }   : toast-layer acknowledgment only — records that
 *                              the toast was DISPLAYED without consuming the
 *                              unread state (readAt stays null), so the tab
 *                              badge survives and reloads don't re-toast.
 */
export async function PATCH(req: Request) {
  const session = await auth();
  const userId = await resolveUserId(session?.user?.id);
  const body = await req.json().catch(() => ({} as { ids?: unknown; all?: boolean; toasted?: boolean }));
  const ids = Array.isArray(body.ids)
    ? body.ids.filter((id: unknown): id is string => typeof id === "string" && id.length > 0)
    : [];

  if (body.all !== true && ids.length === 0) return NextResponse.json({ updated: 0 });

  const where = body.all === true
    ? { userId, readAt: null }
    : { userId, readAt: null, id: { in: ids } };

  const data = body.toasted === true ? { toastedAt: new Date() } : { readAt: new Date(), toastedAt: new Date() };
  const result = await prisma.notification.updateMany({ where, data });
  return NextResponse.json({ updated: result.count });
}
