import { NextResponse } from "next/server";
import { scopedContext } from "@/server/records/leads";
import { pgSearch } from "@/server/search/pg";
import { handleRouteError } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Global search — grouped, scope-filtered hits across all core objects. */
export async function GET(request: Request) {
  try {
    const ctx = await scopedContext("LEADS_READ");
    const q = new URL(request.url).searchParams.get("q") ?? "";
    const hits = await pgSearch.search(ctx, q, 5);
    return NextResponse.json({ data: hits, meta: { query: q, count: hits.length } });
  } catch (error) {
    return handleRouteError(error, "Search failed.");
  }
}
