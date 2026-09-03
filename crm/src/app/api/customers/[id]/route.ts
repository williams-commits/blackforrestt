import { NextResponse } from "next/server";
import { UpdateCustomer, getCustomer, softDeleteCustomer, updateCustomer } from "@/server/records/customers";
import { scopedContext } from "@/server/records/leads";
import { handleRouteError, parseJsonBody } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
  try {
    const ctx = await scopedContext("CUSTOMERS_READ");
    const { id } = await context.params;
    return NextResponse.json({ data: await getCustomer(ctx, id) });
  } catch (error) {
    return handleRouteError(error, "Unable to load customer.");
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const ctx = await scopedContext("CUSTOMERS_EDIT");
    const { id } = await context.params;
    const parsed = await parseJsonBody(request, UpdateCustomer);
    if (!parsed.ok) return parsed.response;
    return NextResponse.json({ data: await updateCustomer(ctx, id, parsed.data) });
  } catch (error) {
    return handleRouteError(error, "Unable to update customer.");
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const ctx = await scopedContext("CUSTOMERS_DELETE");
    const { id } = await context.params;
    await softDeleteCustomer(ctx, id);
    return NextResponse.json({ data: { id } });
  } catch (error) {
    return handleRouteError(error, "Unable to delete customer.");
  }
}
