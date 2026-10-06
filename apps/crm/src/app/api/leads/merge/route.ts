import { NextResponse } from "next/server";
import { MergeLeads, mergeLeads } from "@/server/records/merge";
import { scopedContext } from "@/server/records/leads";
import { handleRouteError, parseJsonBody } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const ctx = await scopedContext("LEADS_EDIT");
    const parsed = await parseJsonBody(request, MergeLeads);
    if (!parsed.ok) return parsed.response;
    return NextResponse.json({ data: await mergeLeads(ctx, parsed.data) });
  } catch (error) {
    return handleRouteError(error, "Unable to merge leads.");
  }
}
