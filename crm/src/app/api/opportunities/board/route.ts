import { NextResponse } from "next/server";
import { board } from "@/server/records/opportunities";
import { defaultPipelineId } from "@/server/records/pipelines";
import { scopedContext } from "@/server/records/leads";
import { handleRouteError } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Kanban payload: pipeline + stages + scoped opportunities + aggregates. */
export async function GET(request: Request) {
  try {
    const ctx = await scopedContext("OPPORTUNITIES_READ");
    const params = new URL(request.url).searchParams;
    let pipelineId = params.get("pipelineId") ?? undefined;
    if (!pipelineId) {
      pipelineId = (await defaultPipelineId()) ?? undefined;
    }
    if (!pipelineId) {
      return NextResponse.json({
        data: { pipeline: null, stages: [], opportunities: [], aggregates: null },
      });
    }
    const includeClosed = params.get("includeClosed") === "1";
    return NextResponse.json({ data: await board(ctx, pipelineId, includeClosed) });
  } catch (error) {
    return handleRouteError(error, "Unable to load board.");
  }
}
