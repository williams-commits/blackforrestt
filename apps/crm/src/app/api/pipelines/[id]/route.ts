import { NextResponse } from "next/server";
import { UpdatePipeline, deletePipeline, requireSettingsAdmin, updatePipeline } from "@/server/records/pipelines";
import { handleRouteError, parseJsonBody } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const ctx = await requireSettingsAdmin();
    const { id } = await context.params;
    const parsed = await parseJsonBody(request, UpdatePipeline);
    if (!parsed.ok) return parsed.response;
    return NextResponse.json({ data: await updatePipeline(ctx, id, parsed.data) });
  } catch (error) {
    return handleRouteError(error, "Unable to update pipeline.");
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const ctx = await requireSettingsAdmin();
    const { id } = await context.params;
    await deletePipeline(ctx, id);
    return NextResponse.json({ data: { id } });
  } catch (error) {
    return handleRouteError(error, "Unable to delete pipeline.");
  }
}
