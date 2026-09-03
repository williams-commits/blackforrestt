import { NextResponse } from "next/server";
import { UpdateStage, deleteStage, requireSettingsAdmin, updateStage } from "@/server/records/pipelines";
import { handleRouteError, parseJsonBody } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string; stageId: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const ctx = await requireSettingsAdmin();
    const { id, stageId } = await context.params;
    const parsed = await parseJsonBody(request, UpdateStage);
    if (!parsed.ok) return parsed.response;
    return NextResponse.json({ data: await updateStage(ctx, id, stageId, parsed.data) });
  } catch (error) {
    return handleRouteError(error, "Unable to update stage.");
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const ctx = await requireSettingsAdmin();
    const { id, stageId } = await context.params;
    await deleteStage(ctx, id, stageId);
    return NextResponse.json({ data: { id: stageId } });
  } catch (error) {
    return handleRouteError(error, "Unable to delete stage.");
  }
}
