import { NextResponse } from "next/server";
import { UpdateLead, getLead, scopedContext, softDeleteLead, updateLead } from "@/server/records/leads";
import { handleRouteError, parseJsonBody } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
  try {
    const ctx = await scopedContext("LEADS_READ");
    const { id } = await context.params;
    return NextResponse.json({ data: await getLead(ctx, id) });
  } catch (error) {
    return handleRouteError(error, "Unable to load lead.");
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const ctx = await scopedContext("LEADS_EDIT");
    const { id } = await context.params;
    const parsed = await parseJsonBody(request, UpdateLead);
    if (!parsed.ok) return parsed.response;
    return NextResponse.json({ data: await updateLead(ctx, id, parsed.data) });
  } catch (error) {
    return handleRouteError(error, "Unable to update lead.");
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const ctx = await scopedContext("LEADS_DELETE");
    const { id } = await context.params;
    await softDeleteLead(ctx, id);
    return NextResponse.json({ data: { id } });
  } catch (error) {
    return handleRouteError(error, "Unable to delete lead.");
  }
}
