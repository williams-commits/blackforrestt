import { NextResponse } from "next/server";
import { UpdateLead, getLead, scopedContext, softDeleteLead, updateLead } from "@/server/records/leads";
import type { Permission } from "@/server/permissions";
import { handleRouteError, parseJsonBody } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
  try {
    const ctx = await scopedContext("LEADS_VIEW");
    const { id } = await context.params;
    return NextResponse.json({ data: await getLead(ctx, id) });
  } catch (error) {
    return handleRouteError(error, "Unable to load lead.");
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const parsed = await parseJsonBody(request, UpdateLead);
    if (!parsed.ok) return parsed.response;
    const input = parsed.data;
    const hasCoreEdit = Object.keys(input).some((key) => !["statusId", "potentialStatusId", "assignedUserId", "assignedTeamId"].includes(key));
    const required: Permission = hasCoreEdit
      ? "LEADS_EDIT"
      : input.statusId !== undefined
        ? "LEADS_CHANGE_STATUS"
        : input.potentialStatusId !== undefined
          ? "LEADS_CHANGE_POTENTIAL_STATUS"
          : "LEADS_ASSIGN";
    const ctx = await scopedContext(required);
    return NextResponse.json({ data: await updateLead(ctx, id, input) });
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
