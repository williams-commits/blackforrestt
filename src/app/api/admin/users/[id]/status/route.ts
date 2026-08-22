import { NextResponse } from "next/server";
import { z } from "zod";
import { AdminError, requireAdmin } from "@/server/admin";
import {
  AdminUserManagementError,
  setUserAccountStatus,
  type AccountStatusAction,
} from "@/server/adminUserManagement";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Schema = z.object({
  action: z.enum(["SUSPEND", "UNSUSPEND", "BLOCK", "UNBLOCK", "SOFT_DELETE", "RESTORE"]),
  note: z.string().trim().max(500).optional(),
});

/** PATCH /api/admin/users/[id]/status — suspend / block / soft-delete / restore. */
export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const actorId = await requireAdmin("USER_ACCESS_MANAGE");
    const { id } = await context.params;
    const parsed = Schema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "Invalid account action.", details: parsed.error.flatten() }, { status: 400 });
    const result = await setUserAccountStatus({
      actorId,
      userId: id,
      action: parsed.data.action as AccountStatusAction,
      note: parsed.data.note,
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    if (error instanceof AdminUserManagementError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    const status = error instanceof AdminError ? error.status : 500;
    if (status === 500) console.error("Account status change failed", error);
    return NextResponse.json({ error: status === 500 ? "Unable to update the account." : error instanceof Error ? error.message : "Unable to update the account." }, { status });
  }
}
