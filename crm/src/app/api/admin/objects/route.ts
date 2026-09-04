import { NextResponse } from "next/server";
import { requirePermission } from "@/server/guard";
import { CreateCustomObject, createCustomObject, listCustomObjects } from "@/server/records/customObjects";
import { handleRouteError, parseJsonBody } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await requirePermission("SETTINGS_MANAGE");
    return NextResponse.json({ data: await listCustomObjects() });
  } catch (error) {
    return handleRouteError(error, "Unable to load custom objects.");
  }
}

export async function POST(request: Request) {
  try {
    const ctx = await requirePermission("SETTINGS_MANAGE");
    const parsed = await parseJsonBody(request, CreateCustomObject);
    if (!parsed.ok) return parsed.response;
    return NextResponse.json({ data: await createCustomObject(ctx, parsed.data) }, { status: 201 });
  } catch (error) {
    return handleRouteError(error, "Unable to create custom object.");
  }
}
