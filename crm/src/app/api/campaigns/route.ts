import { NextResponse } from "next/server";
import { CreateCampaign, createCampaign, listCampaigns } from "@/server/records/campaigns";
import { scopedContext } from "@/server/records/leads";
import { handleRouteError, parseJsonBody } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const ctx = await scopedContext("CAMPAIGNS_READ");
    return NextResponse.json({ data: await listCampaigns(ctx) });
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
