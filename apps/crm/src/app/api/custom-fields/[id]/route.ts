import { NextResponse } from "next/server";
import { requirePermission } from "@/server/guard";
import { UpdateCustomField, deleteCustomField, updateCustomField } from "@/server/records/customFields";
import { handleRouteError, parseJsonBody } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const ctx = await requirePermission("SETTINGS_MANAGE");
    const { id } = await context.params;
    const parsed = await parseJsonBody(request, UpdateCustomField);
    if (!parsed.ok) return parsed.response;
    return NextResponse.json({ data: await updateCustomField(ctx, id, parsed.data) });
  } catch (error) {
    return handleRouteError(error, "Unable to update custom field.");
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const ctx = await requirePermission("SETTINGS_MANAGE");
    const { id } = await context.params;
    await deleteCustomField(ctx, id);
    return NextResponse.json({ data: { id } });
  } catch (error) {
    return handleRouteError(error, "Unable to delete custom field.");
  }
}
