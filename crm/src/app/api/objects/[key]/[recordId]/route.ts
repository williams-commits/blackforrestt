import { NextResponse } from "next/server";
import { UpdateRecord, getRecord, softDeleteRecord, updateRecord } from "@/server/records/customObjects";
import { scopedContext } from "@/server/records/leads";
import { handleRouteError, parseJsonBody } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ key: string; recordId: string }> };

export async function GET(_request: Request, context: RouteContext) {
  try {
    const ctx = await scopedContext("LEADS_READ");
    const { key, recordId } = await context.params;
    return NextResponse.json({ data: await getRecord(ctx, key, recordId) });
  } catch (error) {
    return handleRouteError(error, "Unable to load record.");
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const ctx = await scopedContext("LEADS_EDIT");
    const { key, recordId } = await context.params;
    const parsed = await parseJsonBody(request, UpdateRecord);
    if (!parsed.ok) return parsed.response;
    return NextResponse.json({ data: await updateRecord(ctx, key, recordId, parsed.data) });
  } catch (error) {
    return handleRouteError(error, "Unable to update record.");
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const ctx = await scopedContext("LEADS_DELETE");
    const { key, recordId } = await context.params;
    await softDeleteRecord(ctx, key, recordId);
    return NextResponse.json({ data: { id: recordId } });
  } catch (error) {
    return handleRouteError(error, "Unable to delete record.");
  }
}
