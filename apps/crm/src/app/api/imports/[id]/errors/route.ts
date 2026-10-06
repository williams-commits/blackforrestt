import { NextResponse } from "next/server";
import { errorRowsCsv } from "@/server/imports/csvImport";
import { scopedContext } from "@/server/records/leads";
import { handleRouteError } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Per-row error report as a downloadable CSV. */
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await scopedContext("LEADS_IMPORT");
    const { id } = await context.params;
    const csv = await errorRowsCsv(ctx.userId, id);
    if (csv === null) return NextResponse.json({ error: "Import job not found." }, { status: 404 });
    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="import-${id}-errors.csv"`,
      },
    });
  } catch (error) {
    return handleRouteError(error, "Unable to load error report.");
  }
}
