import { NextResponse } from "next/server";
import { z } from "zod";
import { fetchSheetRows } from "@/server/imports/sheets";
import { scopedContext } from "@/server/records/leads";
import { handleRouteError, parseJsonBody } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Url = z.object({ url: z.string().trim().url().max(500) });

/** Preview a published sheet: columns + first rows for the wizard. */
export async function POST(request: Request) {
  try {
    await scopedContext("LEADS_IMPORT");
    const parsed = await parseJsonBody(request, Url);
    if (!parsed.ok) return parsed.response;
    const sheet = await fetchSheetRows(parsed.data.url);
    return NextResponse.json({
      data: { columns: sheet.columns, preview: sheet.rows.slice(0, 5), totalRows: sheet.rows.length },
    });
  } catch (error) {
    return handleRouteError(error, "Unable to read sheet.");
  }
}
