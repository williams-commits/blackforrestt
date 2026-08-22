import { NextResponse } from "next/server";
import { z } from "zod";
import { AdminError, requireAdmin } from "@/server/admin";
import { AdminUserManagementError, adminGetThread, adminMessageThreads, sendDirectMessage } from "@/server/adminUserManagement";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/admin/messages?userId= — thread overview, or one full thread. */
export async function GET(req: Request) {
  try {
    await requireAdmin("SUPPORT_READ");
    const userId = new URL(req.url).searchParams.get("userId");
    if (userId) {
      const actorId = await requireAdmin("SUPPORT_READ");
      const messages = await adminGetThread({ adminId: actorId, userId });
      return NextResponse.json({
        messages: messages.map((m) => ({
          ...m,
          createdAt: m.createdAt.toISOString(),
          readAt: m.readAt?.toISOString() ?? null,
        })),
      });
    }
    return NextResponse.json({ threads: await adminMessageThreads() });
  } catch (error) {
    const status = error instanceof AdminError ? error.status : 500;
    return NextResponse.json({ error: status === 500 ? "Unable to load messages." : error instanceof Error ? error.message : "Unable to load messages." }, { status });
  }
}

const Schema = z.object({
  userId: z.string().trim().min(1),
  body: z.string().trim().min(1).max(4000),
});

/** POST /api/admin/messages — send a direct message to a customer. */
export async function POST(req: Request) {
  try {
    const actorId = await requireAdmin("SUPPORT_READ");
    const parsed = Schema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "A user and message body are required." }, { status: 400 });
    await sendDirectMessage({
      senderId: actorId,
      recipientId: parsed.data.userId,
      body: parsed.data.body,
      notify: true,
    });
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (error) {
    if (error instanceof AdminUserManagementError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    const status = error instanceof AdminError ? error.status : 500;
    if (status === 500) console.error("Admin message send failed", error);
    return NextResponse.json({ error: status === 500 ? "Unable to send the message." : error instanceof Error ? error.message : "Unable to send the message." }, { status });
  }
}
