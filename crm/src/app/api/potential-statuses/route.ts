import { NextResponse } from "next/server";
import { requireAnyPermission, requirePermission } from "@/server/guard";
import { subjectPermission } from "@/server/records/subjects";
import { CreatePotentialStatus, createPotentialStatus, listPotentialStatuses } from "@/server/records/potentialStatuses";
import { handleRouteError, parseJsonBody } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const subjectType = new URL(request.url).searchParams.get("subjectType");
    if (subjectType === "LEAD") await requireAnyPermission(subjectPermission("LEAD", "VIEW"), subjectPermission("LEAD", "CHANGE_POTENTIAL_STATUS"));
    else await requirePermission("POTENTIAL_STATUS_VIEW");
    return NextResponse.json({ data: await listPotentialStatuses() });
  }
  catch (error) { return handleRouteError(error, "Unable to load potential statuses."); }
}

export async function POST(request: Request) {
  try {
    const ctx = await requirePermission("POTENTIAL_STATUS_CREATE");
    const parsed = await parseJsonBody(request, CreatePotentialStatus);
    if (!parsed.ok) return parsed.response;
    return NextResponse.json({ data: await createPotentialStatus(ctx, parsed.data) }, { status: 201 });
  } catch (error) { return handleRouteError(error, "Unable to create potential status."); }
}
