import { NextResponse } from "next/server";
import { bulkCampaigns, BulkCampaignAction } from "@/server/records/campaigns";
import { scopedContext } from "@/server/records/leads";
import { handleRouteError, parseJsonBody } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    // VIEW is the floor: bulkCampaigns enforces EDIT/DELETE per action and
    // re-checks campaign scope on every id.
    const ctx = await scopedContext("CAMPAIGNS_VIEW");
    const parsed = await parseJsonBody(request, BulkCampaignAction);
    if (!parsed.ok) return parsed.response;
    return NextResponse.json({ data: await bulkCampaigns(ctx, parsed.data) });
  } catch (error) {
    return handleRouteError(error, "Unable to perform bulk action.");
  }
}
