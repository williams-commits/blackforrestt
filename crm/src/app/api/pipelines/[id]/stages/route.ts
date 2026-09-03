import { NextResponse } from "next/server";
import { CreateStage, createStage, requireSettingsAdmin } from "@/server/records/pipelines";
import { handleRouteError, parseJsonBody } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: RouteContext) {
  try {
    const ctx = await requireSettingsAdmin();
    const { id } = await context.params;
    const parsed = await parseJsonBody(request, CreateStage);
    if (!parsed.ok) return parsed.response;
    return NextResponse.json({ data: await createStage(ctx, id, parsed.data) }, { status: 201 });
  } catch (error) {
    return handleRouteError(error, "Unable to create stage.");
  }
}
