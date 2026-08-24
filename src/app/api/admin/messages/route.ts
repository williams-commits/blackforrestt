import { NextResponse } from "next/server";
import { z } from "zod";
import { AdminError, requireAdmin } from "@/server/admin";
import { AdminUserManagementError, adminDeleteThread, adminGetThread, adminMessageThreads, sendDirectMessage } from "@/server/adminUserManagement";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/admin/messages — the shared support inbox.
 *   No params: thread overview per customer (latest message, unread count, status).
 *   ?userId= : full thread with one customer plus the viewing operator's identity.
 */
export async function GET(req: Request) {
  try {
    const actorId = await requireAdmin("SUPPORT_READ");
    const params = new URL(req.url).searchParams;
    const userId = params.get("userId");
    if (userId) {
      const limitParam = Number(params.get("limit") ?? 0) || undefined;
      const thread = await adminGetThread({ adminId: actorId, userId, limit: limitParam });
      return NextResponse.json(thread);
    }
    const { threads, totalUnread } = await adminMessageThreads();
    return NextResponse.json({ viewerId: actorId, threads, totalUnread });
  } catch (error) {
    if (error instanceof AdminUserManagementError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    const status = error instanceof AdminError ? error.status : 500;
    return NextResponse.json({ error: status === 500 ? "Unable to load messages." : error instanceof Error ? error.message : "Unable to load messages." }, { status });
  }
}

const SendSchema = z.object({
  userId: z.string().trim().min(1),
  body: z.string().trim().min(1).max(4000),
});

/** DELETE /api/admin/messages?userId= — moderation: remove a customer's entire
 *  support thread. Audited; not available for operator-to-operator traffic. */
export async function DELETE(req: Request) {
  try {
    const actorId = await requireAdmin("SUPPORT_MANAGE");
    const userId = new URL(req.url).searchParams.get("userId");
    if (!userId) return NextResponse.json({ error: "A userId is required." }, { status: 400 });
    const result = await adminDeleteThread({ actorId, userId });
    return NextResponse.json({ ok: true, deleted: result.deleted });
  } catch (error) {
    if (error instanceof AdminUserManagementError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    const status = error instanceof AdminError ? error.status : 500;
    if (status === 500) console.error("Admin thread delete failed", error);
    return NextResponse.json({ error: status === 500 ? "Unable to delete the conversation." : error instanceof Error ? error.message : "Unable to delete the conversation." }, { status });
  }
}

/** POST /api/admin/messages — send a direct message to a customer. */
export async function POST(req: Request) {
  try {
    const actorId = await requireAdmin("SUPPORT_READ");
    const parsed = SendSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "A user and message body are required." }, { status: 400 });
    const message = await sendDirectMessage({
      senderId: actorId,
      recipientId: parsed.data.userId,
      body: parsed.data.body,
      notify: true,
    });
    return NextResponse.json({ ok: true, message }, { status: 201 });
  } catch (error) {
    if (error instanceof AdminUserManagementError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    const status = error instanceof AdminError ? error.status : 500;
    if (status === 500) console.error("Admin message send failed", error);
    return NextResponse.json({ error: status === 500 ? "Unable to send the message." : error instanceof Error ? error.message : "Unable to send the message." }, { status });
  }
}
