import { NextResponse } from "next/server";
import { StartImportInput, listJobs, listJobsPage, startImport } from "@/server/imports/csvImport";
import { scopedContext } from "@/server/records/leads";
import { handleRouteError, parseJsonBody } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Import-job history (this user's). With page/pageSize → paginated +
 *  searchable for the history table ({ data, meta }); bare GET keeps the
 *  legacy last-20 shape for dropdown/back-compat consumers. */
export async function GET(request: Request) {
  try {
    const ctx = await scopedContext("LEADS_IMPORT");
    const params = new URL(request.url).searchParams;
    const pageParam = params.get("page");
    const pageSizeParam = params.get("pageSize");
    if (pageParam === null && pageSizeParam === null) {
      return NextResponse.json({ data: await listJobs(ctx.userId) });
    }
    const page = Math.max(1, Number.parseInt(pageParam ?? "1", 10) || 1);
    const pageSize = Math.min(50, Math.max(1, Number.parseInt(pageSizeParam ?? "10", 10) || 10));
    const q = params.get("q")?.trim();
    const { total, rows } = await listJobsPage(ctx.userId, {
      page,
      pageSize,
      ...(q ? { q } : {}),
    });
    return NextResponse.json({ data: rows, meta: { page, pageSize, total } });
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
