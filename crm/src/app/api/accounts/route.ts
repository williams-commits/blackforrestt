import { NextResponse } from "next/server";
import { CreateAccount, createAccount, listAccounts } from "@/server/records/accounts";
import { scopedContext } from "@/server/records/leads";
import { customFieldFilters, parseListQuery } from "@/server/listQuery";
import { handleRouteError, parseJsonBody } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const ctx = await scopedContext("ACCOUNTS_READ");
    const params = new URL(request.url).searchParams;
    const query = parseListQuery(params);
    const { total, rows } = await listAccounts(ctx, query, customFieldFilters(params));
    return NextResponse.json({ data: rows, meta: { page: query.page, pageSize: query.pageSize, total } });
  } catch (error) {
    return handleRouteError(error, "Unable to load accounts.");
  }
}

export async function POST(request: Request) {
  try {
    const ctx = await scopedContext("ACCOUNTS_CREATE");
    const parsed = await parseJsonBody(request, CreateAccount);
    if (!parsed.ok) return parsed.response;
    return NextResponse.json({ data: await createAccount(ctx, parsed.data) }, { status: 201 });
  } catch (error) {
    return handleRouteError(error, "Unable to create account.");
  }
}
