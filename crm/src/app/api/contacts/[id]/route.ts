import { NextResponse } from "next/server";
import { UpdateContact, getContact, softDeleteContact, updateContact } from "@/server/records/contacts";
import { scopedContext } from "@/server/records/leads";
import type { Permission } from "@/server/permissions";
import { handleRouteError, parseJsonBody } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
  try {
    const ctx = await scopedContext("CONTACTS_VIEW");
    const { id } = await context.params;
    return NextResponse.json({ data: await getContact(ctx, id) });
  } catch (error) {
    return handleRouteError(error, "Unable to load contact.");
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const parsed = await parseJsonBody(request, UpdateContact);
    if (!parsed.ok) return parsed.response;
    const input = parsed.data;
    const hasCoreEdit = Object.keys(input).some((key) => !["statusId", "ownerUserId", "teamId"].includes(key));
    const required: Permission = hasCoreEdit ? "CONTACTS_EDIT" : input.statusId !== undefined ? "CONTACTS_CHANGE_STATUS" : "CONTACTS_ASSIGN";
    const ctx = await scopedContext(required);
    return NextResponse.json({ data: await updateContact(ctx, id, input) });
  } catch (error) {
    return handleRouteError(error, "Unable to update contact.");
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const ctx = await scopedContext("CONTACTS_DELETE");
    const { id } = await context.params;
    await softDeleteContact(ctx, id);
    return NextResponse.json({ data: { id } });
  } catch (error) {
    return handleRouteError(error, "Unable to delete contact.");
  }
}
