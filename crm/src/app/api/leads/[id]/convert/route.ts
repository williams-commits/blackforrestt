import { NextResponse } from "next/server";
import { ConvertLead, conversionPreview, convertLead } from "@/server/records/conversion";
import { scopedContext } from "@/server/records/leads";
import { handleRouteError, parseJsonBody } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

/** Conversion pre-flight: lead state + duplicate matches. */
export async function GET(_request: Request, context: RouteContext) {
  try {
    const ctx = await scopedContext("LEADS_READ");
    const { id } = await context.params;
    return NextResponse.json({ data: await conversionPreview(ctx, id) });
  } catch (error) {
    return handleRouteError(error, "Unable to prepare conversion.");
  }
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const ctx = await scopedContext("LEADS_EDIT");
    const { id } = await context.params;
    const parsed = await parseJsonBody(request, ConvertLead);
    if (!parsed.ok) return parsed.response;
    return NextResponse.json({ data: await convertLead(ctx, id, parsed.data) });
  } catch (error) {
    return handleRouteError(error, "Unable to convert lead.");
  }
}
