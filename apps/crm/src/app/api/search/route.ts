import { NextResponse } from "next/server";
import { scopedContext } from "@/server/records/leads";
import { pgSearch } from "@/server/search/pg";
import { handleRouteError } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Global search — grouped, scope-filtered hits across all core objects.
 *  `perType` lets a scoped palette (opened from a module toolbar) request a
 *  deeper slice than the default of 5 per object type. */
export async function GET(request: Request) {
  try {
    const ctx = await scopedContext("LEADS_VIEW");
    const params = new URL(request.url).searchParams;
    const q = params.get("q") ?? "";
    const perType = Math.min(20, Math.max(1, Number(params.get("perType")) || 5));
    const hits = await pgSearch.search(ctx, q, perType);
    return NextResponse.json({ data: hits, meta: { query: q, count: hits.length } });
  } catch (error) {
    return handleRouteError(error, "Search failed.");
  }
}
