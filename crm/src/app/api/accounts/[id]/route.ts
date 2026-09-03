import { NextResponse } from "next/server";
import { UpdateAccount, getAccount, softDeleteAccount, updateAccount } from "@/server/records/accounts";
import { scopedContext } from "@/server/records/leads";
import { handleRouteError, parseJsonBody } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
  try {
    const ctx = await scopedContext("ACCOUNTS_READ");
    const { id } = await context.params;
    return NextResponse.json({ data: await getAccount(ctx, id) });
  } catch (error) {
    return handleRouteError(error, "Unable to load account.");
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const ctx = await scopedContext("ACCOUNTS_EDIT");
    const { id } = await context.params;
    const parsed = await parseJsonBody(request, UpdateAccount);
    if (!parsed.ok) return parsed.response;
    return NextResponse.json({ data: await updateAccount(ctx, id, parsed.data) });
  } catch (error) {
    return handleRouteError(error, "Unable to update account.");
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const ctx = await scopedContext("ACCOUNTS_DELETE");
    const { id } = await context.params;
    await softDeleteAccount(ctx, id);
    return NextResponse.json({ data: { id } });
  } catch (error) {
    return handleRouteError(error, "Unable to delete account.");
  }
}
