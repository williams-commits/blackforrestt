import { NextResponse } from "next/server";
import { AdminError, requireAdmin } from "@/server/admin";
import { AdminUserManagementError, adminSetTemporaryPassword } from "@/server/adminUserManagement";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** POST /api/admin/users/[id]/temporary-password — set a random 6-character
 *  alphanumeric temporary password. The code is returned exactly once in the
 *  response and never logged or emailed; all sessions are revoked so the user
 *  signs in fresh with the new password. */
export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const actorId = await requireAdmin("USER_ACCESS_MANAGE");
    const { id } = await context.params;
    const result = await adminSetTemporaryPassword({ actorId, userId: id });
    return NextResponse.json({ ok: true, temporaryPassword: result.temporaryPassword });
  } catch (error) {
    if (error instanceof AdminUserManagementError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    const status = error instanceof AdminError ? error.status : 500;
    if (status === 500) console.error("Admin temporary password failed", error);
    return NextResponse.json({ error: status === 500 ? "Unable to set the temporary password." : error instanceof Error ? error.message : "Unable to set the temporary password." }, { status });
  }
}
