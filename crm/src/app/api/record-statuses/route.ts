import { NextResponse } from "next/server";
import { requirePermission } from "@/server/guard";
import { CreateStatus, createStatus, listStatuses } from "@/server/records/statuses";
import { handleRouteError, parseJsonBody } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await requirePermission("LEADS_READ");
    return NextResponse.json({ data: await listStatuses() });
  } catch (error) {
    return handleRouteError(error, "Unable to load statuses.");
  }
}

export async function POST(request: Request) {
  try {
    const ctx = await requirePermission("SETTINGS_MANAGE");
    const parsed = await parseJsonBody(request, CreateStatus);
    if (!parsed.ok) return parsed.response;
    return NextResponse.json({ data: await createStatus(ctx, parsed.data) }, { status: 201 });
  } catch (error) {
    return handleRouteError(error, "Unable to create status.");
  }
}
