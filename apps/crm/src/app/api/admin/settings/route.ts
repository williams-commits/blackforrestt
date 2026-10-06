import { NextResponse } from "next/server";
import { requireAnyPermission, requirePermission } from "@/server/guard";
import { UpdateSetting, listSettings, updateSetting } from "@/server/records/adminManage";
import { handleRouteError, parseJsonBody } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await requireAnyPermission("ADMIN_ACCESS", "SETTINGS_MANAGE");
    return NextResponse.json({ data: await listSettings() });
  } catch (error) {
    return handleRouteError(error, "Unable to load settings.");
  }
}

export async function PUT(request: Request) {
  try {
    const ctx = await requirePermission("SETTINGS_MANAGE");
    const parsed = await parseJsonBody(request, UpdateSetting);
    if (!parsed.ok) return parsed.response;
    return NextResponse.json({ data: await updateSetting(ctx, parsed.data) });
  } catch (error) {
    return handleRouteError(error, "Unable to save setting.");
  }
}
