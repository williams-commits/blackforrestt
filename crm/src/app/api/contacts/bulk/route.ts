import { NextResponse } from "next/server";
import { bulkRecords, BulkRecordAction } from "@/server/records/bulk";
import { scopedContext } from "@/server/records/leads";
import { handleRouteError, parseJsonBody } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const ctx = await scopedContext("CONTACTS_EDIT");
    const parsed = await parseJsonBody(request, BulkRecordAction);
    if (!parsed.ok) return parsed.response;
    const result = await bulkRecords(ctx, "contacts", parsed.data);
    return NextResponse.json({ data: result });
  } catch (error) {
    return handleRouteError(error, "Unable to perform bulk action.");
  }
}
