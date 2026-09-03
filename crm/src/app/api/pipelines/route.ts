import { NextResponse } from "next/server";
import { CreatePipeline, createPipeline, listPipelines, requireSettingsAdmin } from "@/server/records/pipelines";
import { requirePermission } from "@/server/guard";
import { handleRouteError, parseJsonBody } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await requirePermission("OPPORTUNITIES_READ");
    return NextResponse.json({ data: await listPipelines() });
  } catch (error) {
    return handleRouteError(error, "Unable to load pipelines.");
  }
}

export async function POST(request: Request) {
  try {
    const ctx = await requireSettingsAdmin();
    const parsed = await parseJsonBody(request, CreatePipeline);
    if (!parsed.ok) return parsed.response;
    return NextResponse.json({ data: await createPipeline(ctx, parsed.data) }, { status: 201 });
  } catch (error) {
    return handleRouteError(error, "Unable to create pipeline.");
  }
}
