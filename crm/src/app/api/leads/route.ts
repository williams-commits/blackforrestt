import { NextResponse } from "next/server";
import {
  CreateLead,
  LeadFilters,
  createLead,
  listLeads,
  scopedContext,
} from "@/server/records/leads";
import { parseListQuery } from "@/server/listQuery";
import { handleRouteError, parseJsonBody } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const ctx = await scopedContext("LEADS_READ");
    const params = new URL(request.url).searchParams;
    const query = parseListQuery(params);
    const filters = LeadFilters.parse({
      statusId: params.get("statusId") ?? undefined,
      priority: params.get("priority") ?? undefined,
      assignment: params.get("assignment") ?? "all",
    });
    const { total, rows } = await listLeads(ctx, query, filters);
    return NextResponse.json({
      data: rows,
      meta: { page: query.page, pageSize: query.pageSize, total },
    });
  } catch (error) {
    return handleRouteError(error, "Unable to load leads.");
  }
}

export async function POST(request: Request) {
  try {
    const ctx = await scopedContext("LEADS_CREATE");
    const parsed = await parseJsonBody(request, CreateLead);
    if (!parsed.ok) return parsed.response;
    const lead = await createLead(ctx, parsed.data);
    return NextResponse.json({ data: lead }, { status: 201 });
  } catch (error) {
    return handleRouteError(error, "Unable to create lead.");
  }
}
