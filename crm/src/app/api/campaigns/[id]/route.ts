import { NextResponse } from "next/server";
import {
  UpdateCampaign,
  deleteCampaign,
  getCampaign,
  updateCampaign,
} from "@/server/records/campaigns";
import { scopedContext } from "@/server/records/leads";
import { handleRouteError, parseJsonBody } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
  try {
    const ctx = await scopedContext("CAMPAIGNS_READ");
    const { id } = await context.params;
    return NextResponse.json({ data: await getCampaign(ctx, id) });
  } catch (error) {
    return handleRouteError(error, "Unable to load campaign.");
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const ctx = await scopedContext("CAMPAIGNS_EDIT");
    const { id } = await context.params;
    const parsed = await parseJsonBody(request, UpdateCampaign);
    if (!parsed.ok) return parsed.response;
    return NextResponse.json({ data: await updateCampaign(ctx, id, parsed.data) });
  } catch (error) {
    return handleRouteError(error, "Unable to update campaign.");
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const ctx = await scopedContext("CAMPAIGNS_DELETE");
    const { id } = await context.params;
    await deleteCampaign(ctx, id);
    return NextResponse.json({ data: { id } });
  } catch (error) {
    return handleRouteError(error, "Unable to delete campaign.");
  }
}
