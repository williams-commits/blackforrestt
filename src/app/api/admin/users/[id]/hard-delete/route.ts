import { NextResponse } from "next/server";
import { z } from "zod";
import { AdminError, requireAdmin } from "@/server/admin";
import { AdminUserManagementError, adminHardDeleteUser } from "@/server/adminUserManagement";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Schema = z.object({ reason: z.string().trim().min(10).max(500) });

/** POST /api/admin/users/[id]/hard-delete — permanently delete a SOFT-DELETED
 *  account (two-step by design: soft delete first, purge second). Financial
 *  history is protected: accounts with ledger transactions are refused. */
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const actorId = await requireAdmin("USER_ACCESS_MANAGE");
    const { id } = await context.params;
    const parsed = Schema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: "A purge reason of at least 10 characters is required." }, { status: 400 });
    }
    const result = await adminHardDeleteUser({ actorId, userId: id, reason: parsed.data.reason });
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    if (error instanceof AdminUserManagementError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    const status = error instanceof AdminError ? error.status : 500;
    if (status === 500) console.error("Admin hard delete failed", error);
    return NextResponse.json({ error: status === 500 ? "Unable to permanently delete the account." : error instanceof Error ? error.message : "Unable to permanently delete the account." }, { status });
  }
}
