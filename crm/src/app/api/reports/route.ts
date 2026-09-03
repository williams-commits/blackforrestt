import { NextResponse } from "next/server";
import { z } from "zod";
import { runReport } from "@/server/reports/engine";
import { PREBUILT_REPORTS, findReport } from "@/server/reports/prebuilt";
import { scopedContext } from "@/server/records/leads";
import { handleRouteError, parseJsonBody } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Report library (metadata only — running is a separate, scoped call). */
export async function GET() {
  try {
    await scopedContext("REPORTS_VIEW");
    return NextResponse.json({
      data: PREBUILT_REPORTS.map((report) => ({
        id: report.id,
        name: report.name,
        description: report.description,
        object: report.object,
        dateField: report.dateField,
        hasSums: (report.sums?.length ?? 0) > 0,
      })),
    });
  } catch (error) {
    return handleRouteError(error, "Unable to load reports.");
  }
}

const Run = z.object({
  reportId: z.string().trim().min(2),
  dateFrom: z.string().trim().optional(),
  dateTo: z.string().trim().optional(),
});

export async function POST(request: Request) {
  try {
    const ctx = await scopedContext("REPORTS_VIEW");
    const parsed = await parseJsonBody(request, Run);
    if (!parsed.ok) return parsed.response;
    const def = findReport(parsed.data.reportId);
    if (!def) return NextResponse.json({ error: "Unknown report." }, { status: 404 });
    const rows = await runReport(ctx, def, {
      dateFrom: parsed.data.dateFrom,
      dateTo: parsed.data.dateTo,
    });
    return NextResponse.json({
      data: {
        report: { id: def.id, name: def.name, sums: def.sums ?? [] },
        rows,
      },
    });
  } catch (error) {
    return handleRouteError(error, "Unable to run report.");
  }
}
