import { NextResponse } from "next/server";
import { UpdateCustomer, getCustomer, softDeleteCustomer, updateCustomer } from "@/server/records/customers";
import { scopedContext } from "@/server/records/leads";
import type { Permission } from "@/server/permissions";
import { handleRouteError, parseJsonBody } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
  try {
    const ctx = await scopedContext("CUSTOMERS_VIEW");
    const { id } = await context.params;
    return NextResponse.json({ data: await getCustomer(ctx, id) });
  } catch (error) {
    return handleRouteError(error, "Unable to load customer.");
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const parsed = await parseJsonBody(request, UpdateCustomer);
    if (!parsed.ok) return parsed.response;
    const input = parsed.data;
    const hasCoreEdit = Object.keys(input).some((key) => !["statusId", "ownerUserId", "teamId"].includes(key));
    const required: Permission = hasCoreEdit ? "CUSTOMERS_EDIT" : input.statusId !== undefined ? "CUSTOMERS_CHANGE_STATUS" : "CUSTOMERS_ASSIGN";
    const ctx = await scopedContext(required);
    return NextResponse.json({ data: await updateCustomer(ctx, id, input) });
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
