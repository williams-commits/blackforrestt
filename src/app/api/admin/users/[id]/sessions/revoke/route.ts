import { NextResponse } from "next/server";
import { AdminError, requireAdmin } from "@/server/admin";
import { AdminUserManagementError, adminRevokeSessions } from "@/server/adminUserManagement";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** POST /api/admin/users/[id]/sessions/revoke — force sign-out everywhere.
 *  Revokes every active security session; the user can simply sign in again. */
export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const actorId = await requireAdmin("USER_ACCESS_MANAGE");
    const { id } = await context.params;
    const result = await adminRevokeSessions({ actorId, userId: id });
    return NextResponse.json({ ok: true, revoked: result.revoked });
  } catch (error) {
    if (error instanceof AdminUserManagementError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    const status = error instanceof AdminError ? error.status : 500;
    if (status === 500) console.error("Admin force sign-out failed", error);
    return NextResponse.json({ error: status === 500 ? "Unable to sign the user out." : error instanceof Error ? error.message : "Unable to sign the user out." }, { status });
  }
}
