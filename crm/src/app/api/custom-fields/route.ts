import { NextResponse } from "next/server";
import { requirePermission } from "@/server/guard";
import { CreateCustomField, createCustomField, listCustomFields } from "@/server/records/customFields";
import { handleRouteError, parseJsonBody } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Definitions readable by any core-record user (forms render them). */
export async function GET(request: Request) {
  try {
    await requirePermission("LEADS_READ");
    const activeOnly = new URL(request.url).searchParams.get("activeOnly") === "1";
    return NextResponse.json({ data: await listCustomFields(activeOnly) });
  } catch (error) {
    return handleRouteError(error, "Unable to load custom fields.");
  }
}

export async function POST(request: Request) {
  try {
    const ctx = await requirePermission("SETTINGS_MANAGE");
    const parsed = await parseJsonBody(request, CreateCustomField);
    if (!parsed.ok) return parsed.response;
    return NextResponse.json({ data: await createCustomField(ctx, parsed.data) }, { status: 201 });
  } catch (error) {
    return handleRouteError(error, "Unable to create custom field.");
  }
}
