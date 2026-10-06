import { NextResponse } from "next/server";
import { AdminError, requireAdminContext } from "@/server/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const context = await requireAdminContext();
    return NextResponse.json({
      actorId: context.actorId,
      roles: context.roles,
      permissions: context.permissions,
      legacySuperAdmin: context.legacySuperAdmin,
    });
  } catch (error) {
    const status = error instanceof AdminError ? error.status : 500;
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to resolve admin context." }, { status });
  }
}
