import { NextResponse } from "next/server";
import { BulkLeadAction, bulkLeads, scopedContext } from "@/server/records/leads";
import { handleRouteError, parseJsonBody } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const ctx = await scopedContext("LEADS_EDIT");
    const parsed = await parseJsonBody(request, BulkLeadAction);
    if (!parsed.ok) return parsed.response;
    const result = await bulkLeads(ctx, parsed.data);
    return NextResponse.json({ data: result });
  } catch (error) {
    return handleRouteError(error, "Unable to perform bulk action.");
  }
}
