import { NextResponse } from "next/server";
import { z } from "zod";
import { CreateCampaign, createCampaign, listCampaigns, listCampaignsPage } from "@/server/records/campaigns";
import { scopedContext } from "@/server/records/leads";
import { parseListQuery } from "@/server/listQuery";
import { handleRouteError, parseJsonBody } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CampaignFilters = z.object({
  status: z.enum(["DRAFT", "ACTIVE", "PAUSED", "COMPLETED"]).optional(),
});

export async function GET(request: Request) {
  try {
    const ctx = await scopedContext("CAMPAIGNS_VIEW");
    const params = new URL(request.url).searchParams;
    // Option-source callers (form dropdowns) hit /api/campaigns with no
    // pagination params and expect the full list — keep that contract.
    // Explicit page/pageSize opts into the standard paginated shape.
    if (!params.has("page") && !params.has("pageSize")) {
      return NextResponse.json({ data: await listCampaigns(ctx) });
    }
    const query = parseListQuery(params);
    const filters = CampaignFilters.parse({ status: params.get("status") ?? undefined });
    const { total, rows } = await listCampaignsPage(ctx, query);
    const filtered = filters.status ? rows.filter((row) => row.status === filters.status) : rows;
    return NextResponse.json({
      data: filtered,
      meta: { page: query.page, pageSize: query.pageSize, total: filters.status ? filtered.length : total },
    });
  } catch (error) {
    return handleRouteError(error, "Unable to load campaigns.");
  }
}

export async function POST(request: Request) {
  try {
    const ctx = await scopedContext("CAMPAIGNS_CREATE");
    const parsed = await parseJsonBody(request, CreateCampaign);
    if (!parsed.ok) return parsed.response;
    return NextResponse.json({ data: await createCampaign(ctx, parsed.data) }, { status: 201 });
  } catch (error) {
    return handleRouteError(error, "Unable to create campaign.");
  }
}
