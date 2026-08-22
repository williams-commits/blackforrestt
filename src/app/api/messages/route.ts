import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { resolveUserId, prisma } from "@/server/db";
import { getUserMessageThread, sendDirectMessage, AdminUserManagementError } from "@/server/adminUserManagement";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * User-side chat with support/admins. GET returns the thread (auto-marking
 * admin→user messages read); POST sends a reply to any admin (routes to the
 * most recent admin correspondent, or any admin if none).
 */
export async function GET() {
  const session = await auth();
  const userId = await resolveUserId(session?.user?.id);
  const messages = await getUserMessageThread({ userId });
  const admins = await prisma.user.findMany({ where: { isAdmin: true }, select: { id: true } });
  const lastAdminMessage = [...messages].reverse().find((m) => admins.some((a) => a.id === m.senderId));
  return NextResponse.json({
    userId,
    messages: messages.map((m) => ({
      ...m,
      createdAt: m.createdAt.toISOString(),
      readAt: m.readAt?.toISOString() ?? null,
    })),
    hasThread: messages.length > 0,
    adminId: lastAdminMessage?.senderId ?? admins[0]?.id ?? null,
  });
}

export async function POST(req: Request) {
  const session = await auth();
  const userId = await resolveUserId(session?.user?.id);
  const body = (await req.json().catch(() => ({}))) as { body?: string };
  if (typeof body.body !== "string") {
    return NextResponse.json({ error: "A message body is required." }, { status: 400 });
  }
  try {
    // Route to the most recent admin correspondent; fall back to any admin.
    const admins = await prisma.user.findMany({
      where: { isAdmin: true, deletedAt: null },
      select: { id: true },
      orderBy: { createdAt: "asc" },
    });
    const thread = await getUserMessageThread({ userId, limit: 200 });
    const lastAdmin = [...thread].reverse().find((m) => admins.some((a) => a.id === m.senderId));
    const recipientId = lastAdmin?.senderId ?? admins[0]?.id;
    if (!recipientId) return NextResponse.json({ error: "No support operator available." }, { status: 503 });
    await sendDirectMessage({ senderId: userId, recipientId, body: body.body, notify: true });
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (error) {
    if (error instanceof AdminUserManagementError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    throw error;
  }
}
