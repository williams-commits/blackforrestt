import { NextResponse } from "next/server";
import { bulkRecords, BulkRecordAction } from "@/server/records/bulk";
import { scopedContext } from "@/server/records/leads";
import { handleRouteError, parseJsonBody } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    // VIEW is the floor: bulkRecords enforces the per-action permission
    // (ASSIGN / CHANGE_STATUS / MANAGE_TAGS / CREATE_TASK / DELETE) — a
    // blanket LEADS_EDIT gate locked status-only users out of bulk status changes.
    const ctx = await scopedContext("LEADS_VIEW");
    const parsed = await parseJsonBody(request, BulkRecordAction);
    if (!parsed.ok) return parsed.response;
    const result = await bulkRecords(ctx, "leads", parsed.data);
    return NextResponse.json({ data: result });
  } catch (error) {
    return handleRouteError(error, "Unable to perform bulk action.");
  }
}
