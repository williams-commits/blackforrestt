import { NextResponse } from "next/server";
import {
  CreateOpportunity,
  OpportunityFilters,
  createOpportunity,
  listOpportunities,
} from "@/server/records/opportunities";
import { scopedContext } from "@/server/records/leads";
import { parseListQuery } from "@/server/listQuery";
import { handleRouteError, parseJsonBody } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const ctx = await scopedContext("OPPORTUNITIES_READ");
    const params = new URL(request.url).searchParams;
    const query = parseListQuery(params);
    const filters = OpportunityFilters.parse({
      pipelineId: params.get("pipelineId") ?? undefined,
      stageId: params.get("stageId") ?? undefined,
      status: params.get("status") ?? undefined,
    });
    const { total, rows } = await listOpportunities(ctx, query, filters);
    return NextResponse.json({ data: rows, meta: { page: query.page, pageSize: query.pageSize, total } });
  } catch (error) {
    return handleRouteError(error, "Unable to load opportunities.");
  }
}

export async function POST(request: Request) {
  try {
    const ctx = await scopedContext("OPPORTUNITIES_CREATE");
    const parsed = await parseJsonBody(request, CreateOpportunity);
    if (!parsed.ok) return parsed.response;
    return NextResponse.json({ data: await createOpportunity(ctx, parsed.data) }, { status: 201 });
  } catch (error) {
    return handleRouteError(error, "Unable to create opportunity.");
  }
}
