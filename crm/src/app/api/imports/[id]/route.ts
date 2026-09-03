import { NextResponse } from "next/server";
import { getJob } from "@/server/imports/csvImport";
import { scopedContext } from "@/server/records/leads";
import { handleRouteError } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Job status + counters — polled by the wizard while RUNNING. */
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await scopedContext("LEADS_IMPORT");
    const { id } = await context.params;
    const job = await getJob(ctx.userId, id);
    if (!job) return NextResponse.json({ error: "Import job not found." }, { status: 404 });
    return NextResponse.json({ data: job });
  } catch (error) {
    return handleRouteError(error, "Unable to load import job.");
  }
}
