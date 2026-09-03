import { NextResponse } from "next/server";
import { CreateCustomer, createCustomer, listCustomers } from "@/server/records/customers";
import { scopedContext } from "@/server/records/leads";
import { parseListQuery } from "@/server/listQuery";
import { handleRouteError, parseJsonBody } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const ctx = await scopedContext("CUSTOMERS_READ");
    const params = new URL(request.url).searchParams;
    const query = parseListQuery(params);
    const { total, rows } = await listCustomers(ctx, query, {
      statusId: params.get("statusId") ?? undefined,
    });
    return NextResponse.json({ data: rows, meta: { page: query.page, pageSize: query.pageSize, total } });
  } catch (error) {
    return handleRouteError(error, "Unable to load customers.");
  }
}

export async function POST(request: Request) {
  try {
    const ctx = await scopedContext("CUSTOMERS_CREATE");
    const parsed = await parseJsonBody(request, CreateCustomer);
    if (!parsed.ok) return parsed.response;
    return NextResponse.json({ data: await createCustomer(ctx, parsed.data) }, { status: 201 });
  } catch (error) {
    return handleRouteError(error, "Unable to create customer.");
  }
}
