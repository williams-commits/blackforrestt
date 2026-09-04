import { NextResponse } from "next/server";
import { CreateRecord, createRecord, listRecords } from "@/server/records/customObjects";
import { scopedContext } from "@/server/records/leads";
import { parseListQuery } from "@/server/listQuery";
import { handleRouteError, parseJsonBody } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ key: string }> };

export async function GET(request: Request, context: RouteContext) {
  try {
    const ctx = await scopedContext("LEADS_READ");
    const { key } = await context.params;
    const query = parseListQuery(new URL(request.url).searchParams);
    const { total, rows } = await listRecords(ctx, key, query);
    return NextResponse.json({
      data: rows,
      meta: { page: query.page, pageSize: query.pageSize, total },
    });
  } catch (error) {
    return handleRouteError(error, "Unable to load records.");
  }
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const ctx = await scopedContext("LEADS_CREATE");
    const { key } = await context.params;
    const parsed = await parseJsonBody(request, CreateRecord);
    if (!parsed.ok) return parsed.response;
    return NextResponse.json({ data: await createRecord(ctx, key, parsed.data) }, { status: 201 });
  } catch (error) {
    return handleRouteError(error, "Unable to create record.");
  }
}
