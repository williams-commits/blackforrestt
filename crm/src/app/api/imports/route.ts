import { NextResponse } from "next/server";
import { StartImportInput, listJobs, startImport } from "@/server/imports/csvImport";
import { scopedContext } from "@/server/records/leads";
import { handleRouteError, parseJsonBody } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Recent import jobs (this user's). */
export async function GET() {
  try {
    const ctx = await scopedContext("LEADS_IMPORT");
    return NextResponse.json({ data: await listJobs(ctx.userId) });
  } catch (error) {
    return handleRouteError(error, "Unable to load imports.");
  }
}

/** Start an import run — returns 202 immediately with a job id. */
export async function POST(request: Request) {
  try {
    const ctx = await scopedContext("LEADS_IMPORT");
    const parsed = await parseJsonBody(request, StartImportInput);
    if (!parsed.ok) return parsed.response;
    const result = await startImport(ctx, parsed.data);
    return NextResponse.json({ data: result }, { status: 202 });
  } catch (error) {
    return handleRouteError(error, "Unable to start import.");
  }
}
