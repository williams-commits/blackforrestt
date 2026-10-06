import { NextResponse } from "next/server";
import { LinkCustomer, linkCustomerToPlatform, unlinkCustomerFromPlatform } from "@/server/platformBridge";
import { scopedContext } from "@/server/records/leads";
import { handleRouteError, parseJsonBody } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: RouteContext) {
  try {
    const ctx = await scopedContext("CUSTOMERS_EDIT");
    const { id } = await context.params;
    const parsed = await parseJsonBody(request, LinkCustomer);
    if (!parsed.ok) return parsed.response;
    return NextResponse.json({ data: await linkCustomerToPlatform(ctx, id, parsed.data) });
  } catch (error) {
    return handleRouteError(error, "Unable to link platform user.");
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const ctx = await scopedContext("CUSTOMERS_EDIT");
    const { id } = await context.params;
    await unlinkCustomerFromPlatform(ctx, id);
    return NextResponse.json({ data: { ok: true } });
  } catch (error) {
    return handleRouteError(error, "Unable to unlink platform user.");
  }
}
