import { NextResponse } from "next/server";
import { ValidateInput, validateImport } from "@/server/imports/csvImport";
import { scopedContext } from "@/server/records/leads";
import { handleRouteError, parseJsonBody } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Server-side validation + duplicate detection for the wizard's step 3. */
export async function POST(request: Request) {
  try {
    const ctx = await scopedContext("LEADS_IMPORT");
    const parsed = await parseJsonBody(request, ValidateInput);
    if (!parsed.ok) return parsed.response;
    const result = await validateImport(ctx, parsed.data);
    return NextResponse.json({
      data: {
        issues: result.issues,
        duplicates: result.duplicates,
        summary: result.summary,
      },
    });
  } catch (error) {
    return handleRouteError(error, "Unable to validate import.");
  }
}
