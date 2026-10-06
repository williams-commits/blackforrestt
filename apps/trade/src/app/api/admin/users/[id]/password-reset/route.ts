import { NextResponse } from "next/server";
import { AdminError, requireAdmin } from "@/server/admin";
import { AdminUserManagementError, adminSendPasswordReset } from "@/server/adminUserManagement";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** POST /api/admin/users/[id]/password-reset — email the user a single-use
 *  password-reset link. The admin never sets the password; the user completes
 *  the reset through the standard /reset-password flow. */
export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const actorId = await requireAdmin("USER_ACCESS_MANAGE");
    const { id } = await context.params;
    const result = await adminSendPasswordReset({ actorId, userId: id });
    return NextResponse.json({
      ok: true,
      sent: result.sent,
      expiresAt: result.expiresAt.toISOString(),
      ...(result.previewUrl ? { previewUrl: result.previewUrl } : {}),
    });
  } catch (error) {
    if (error instanceof AdminUserManagementError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    const status = error instanceof AdminError ? error.status : 500;
    if (status === 500) console.error("Admin password reset failed", error);
    return NextResponse.json({ error: status === 500 ? "Unable to send the password reset." : error instanceof Error ? error.message : "Unable to send the password reset." }, { status });
  }
}
