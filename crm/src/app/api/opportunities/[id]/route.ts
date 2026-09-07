import { NextResponse } from "next/server";
import {
  UpdateOpportunity,
  getOpportunity,
  softDeleteOpportunity,
  updateOpportunity,
} from "@/server/records/opportunities";
import { scopedContext } from "@/server/records/leads";
import type { Permission } from "@/server/permissions";
import { handleRouteError, parseJsonBody } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
  try {
    const ctx = await scopedContext("OPPORTUNITIES_VIEW");
    const { id } = await context.params;
    return NextResponse.json({ data: await getOpportunity(ctx, id) });
  } catch (error) {
    return handleRouteError(error, "Unable to load opportunity.");
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const parsed = await parseJsonBody(request, UpdateOpportunity);
    if (!parsed.ok) return parsed.response;
    const input = parsed.data;
    const hasCoreEdit = Object.keys(input).some((key) => !["stageId", "ownerUserId", "teamId"].includes(key));
    const required: Permission = hasCoreEdit ? "OPPORTUNITIES_EDIT" : input.stageId !== undefined ? "OPPORTUNITIES_CHANGE_STATUS" : "OPPORTUNITIES_ASSIGN";
    const ctx = await scopedContext(required);
    return NextResponse.json({ data: await updateOpportunity(ctx, id, input) });
  } catch (error) {
    return handleRouteError(error, "Unable to update opportunity.");
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const ctx = await scopedContext("OPPORTUNITIES_DELETE");
    const { id } = await context.params;
    await softDeleteOpportunity(ctx, id);
    return NextResponse.json({ data: { id } });
  } catch (error) {
    return handleRouteError(error, "Unable to delete opportunity.");
  }
}
