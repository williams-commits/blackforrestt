import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { resolveUserId, prisma } from "@/server/db";
import {
  getUserMessageThread,
  resolveSupportRecipient,
  sendDirectMessage,
  adminMessageThreads,
  AdminUserManagementError,
} from "@/server/adminUserManagement";
import { requireAdminContext } from "@/server/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * User-side support chat.
 *
 * GET — for a customer: their single shared thread with the support team,
 * enriched with sender identity. For an operator: a thread overview of the
 * shared support inbox (if they hold SUPPORT_READ), so their account page can
 * route them to the console instead of dumping customer messages into a
 * personal chat view.
 *
 * POST — customer sends a message. Routed to the operator who last replied in
 * their thread for continuity, or the longest-tenured active operator.
 * Operators must use /api/admin/messages; sending from here is rejected.
 */
export async function GET() {
  try {
    const session = await auth();
    const userId = await resolveUserId(session?.user?.id);
    const viewer = await prisma.user.findUnique({
      where: { id: userId },
      select: { isAdmin: true },
    });
    if (!viewer) return NextResponse.json({ error: "Account not found." }, { status: 404 });

    if (viewer.isAdmin) {
      let threads: Awaited<ReturnType<typeof adminMessageThreads>> | null = null;
      try {
        await requireAdminContext("SUPPORT_READ");
        threads = await adminMessageThreads();
      } catch {
        // Operator without SUPPORT_READ — the account tab still routes to /admin.
      }
      return NextResponse.json({ viewerId: userId, role: "operator", threads });
    }

    const { messages, hasMore } = await getUserMessageThread({ userId });
    const adminId = await resolveSupportRecipient(userId);
    return NextResponse.json({
      viewerId: userId,
      role: "customer",
      messages,
      hasMore,
      hasThread: messages.length > 0,
      adminId,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Sign in to view messages." }, { status: 401 });
    }
    throw error;
  }
}

const SendSchema = z.object({ body: z.string().trim().min(1).max(4000) });

export async function POST(req: Request) {
  try {
    const session = await auth();
    const userId = await resolveUserId(session?.user?.id);
    const parsed = SendSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: "A message body of 1–4000 characters is required." }, { status: 400 });
    }
    const sender = await prisma.user.findUnique({ where: { id: userId }, select: { isAdmin: true } });
    if (!sender) return NextResponse.json({ error: "Account not found." }, { status: 404 });
    if (sender.isAdmin) {
      return NextResponse.json(
        { error: "Operators reply to customers from the Operations console." },
        { status: 400 },
      );
    }
    const recipientId = await resolveSupportRecipient(userId);
    if (!recipientId) return NextResponse.json({ error: "No support operator available." }, { status: 503 });
    const message = await sendDirectMessage({ senderId: userId, recipientId, body: parsed.data.body, notify: true });
    return NextResponse.json({ ok: true, message }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Sign in to send messages." }, { status: 401 });
    }
    if (error instanceof AdminUserManagementError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    throw error;
  }
}
