import { NextResponse } from "next/server";
import { z } from "zod";
import { startSheetsImport } from "@/server/imports/sheets";
import { StartImportInput } from "@/server/imports/csvImport";
import { scopedContext } from "@/server/records/leads";
import { handleRouteError, parseJsonBody } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = StartImportInput.omit({ rows: true, fileName: true }).extend({
  url: z.string().trim().url().max(500),
});

/** Start an import from a published Google Sheet (202 + jobId). */
export async function POST(request: Request) {
  try {
    const ctx = await scopedContext("LEADS_IMPORT");
    const parsed = await parseJsonBody(request, Body);
    if (!parsed.ok) return parsed.response;
    const { url, ...base } = parsed.data;
    const result = await startSheetsImport(ctx, url, base);
    return NextResponse.json({ data: result }, { status: 202 });
  } catch (error) {
    return handleRouteError(error, "Unable to start sheet import.");
  }
}
