import { NextResponse } from "next/server";
import { z } from "zod";
import { AdminError, requireAdmin } from "@/server/admin";
import { AdminUserManagementError, adminNotifyUser } from "@/server/adminUserManagement";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Schema = z.object({
  title: z.string().trim().min(3).max(120),
  body: z.string().trim().min(3).max(2000),
});

/** POST /api/admin/users/[id]/notify — send an in-app notification to one user. */
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const actorId = await requireAdmin("USER_ACCESS_MANAGE");
    const { id } = await context.params;
    const parsed = Schema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "Title (3–120) and message (3–2000) are required." }, { status: 400 });
    await adminNotifyUser({ actorId, userId: id, title: parsed.data.title, body: parsed.data.body });
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (error) {
    if (error instanceof AdminUserManagementError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    const status = error instanceof AdminError ? error.status : 500;
    return NextResponse.json({ error: status === 500 ? "Unable to send the notification." : error instanceof Error ? error.message : "Unable to send the notification." }, { status });
  }
}
