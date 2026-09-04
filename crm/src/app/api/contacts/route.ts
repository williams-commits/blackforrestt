import { NextResponse } from "next/server";
import { CreateContact, createContact, listContacts } from "@/server/records/contacts";
import { scopedContext } from "@/server/records/leads";
import { customFieldFilters, parseListQuery } from "@/server/listQuery";
import { handleRouteError, parseJsonBody } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const ctx = await scopedContext("CONTACTS_READ");
    const params = new URL(request.url).searchParams;
    const query = parseListQuery(params);
    const { total, rows } = await listContacts(ctx, query, {
      accountId: params.get("accountId") ?? undefined,
      statusId: params.get("statusId") ?? undefined,
    }, customFieldFilters(params));
    return NextResponse.json({ data: rows, meta: { page: query.page, pageSize: query.pageSize, total } });
  } catch (error) {
    return handleRouteError(error, "Unable to load contacts.");
  }
}

export async function POST(request: Request) {
  try {
    const ctx = await scopedContext("CONTACTS_CREATE");
    const parsed = await parseJsonBody(request, CreateContact);
    if (!parsed.ok) return parsed.response;
    return NextResponse.json({ data: await createContact(ctx, parsed.data) }, { status: 201 });
  } catch (error) {
    return handleRouteError(error, "Unable to create contact.");
  }
}
