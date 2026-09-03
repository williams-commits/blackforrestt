import { NextResponse } from "next/server";
import { runReport } from "@/server/reports/engine";
import { findReport } from "@/server/reports/prebuilt";
import { scopedContext } from "@/server/records/leads";
import { handleRouteError } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** CSV export — same engine, same scope, so exports never leak rows. */
export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await scopedContext("REPORTS_VIEW");
    const { id } = await context.params;
    const def = findReport(id);
    if (!def) return NextResponse.json({ error: "Unknown report." }, { status: 404 });
    const params = new URL(request.url).searchParams;
    const rows = await runReport(ctx, def, {
      dateFrom: params.get("from") ?? undefined,
      dateTo: params.get("to") ?? undefined,
    });
    const escape = (value: string) => (/[",\n]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value);
    const header = ["group", "count", ...(def.sums ?? [])].join(",");
    const lines = rows.map((row) =>
      [
        escape(row.key ?? "(none)"),
        String(row.count),
        ...(def.sums ?? []).map((field) => String(row.sums[field] ?? 0)),
      ].join(","),
    );
    const csv = [header, ...lines].join("\n");
    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="report-${def.id}.csv"`,
      },
    });
  } catch (error) {
    return handleRouteError(error, "Unable to export report.");
  }
}
