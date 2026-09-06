import { NextResponse } from "next/server";
import { requirePermission } from "@/server/guard";
import { CreatePotentialStatus, createPotentialStatus, listPotentialStatuses } from "@/server/records/potentialStatuses";
import { handleRouteError, parseJsonBody } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try { await requirePermission("LEADS_READ"); return NextResponse.json({ data: await listPotentialStatuses() }); }
  catch (error) { return handleRouteError(error, "Unable to load potential statuses."); }
}

export async function POST(request: Request) {
  try {
    const ctx = await requirePermission("SETTINGS_MANAGE");
    const parsed = await parseJsonBody(request, CreatePotentialStatus);
    if (!parsed.ok) return parsed.response;
    return NextResponse.json({ data: await createPotentialStatus(ctx, parsed.data) }, { status: 201 });
  } catch (error) { return handleRouteError(error, "Unable to create potential status."); }
}