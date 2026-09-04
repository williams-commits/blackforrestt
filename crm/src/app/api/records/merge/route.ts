import { NextResponse } from "next/server";
import { MergeRecords, mergeRecords } from "@/server/records/merge";
import { scopedContext } from "@/server/records/leads";
import { handleRouteError, parseJsonBody } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Generic merge for contacts / accounts / customers. */
export async function POST(request: Request) {
  try {
    const ctx = await scopedContext("CONTACTS_EDIT");
    const parsed = await parseJsonBody(request, MergeRecords);
    if (!parsed.ok) return parsed.response;
    return NextResponse.json({ data: await mergeRecords(ctx, parsed.data) });
  } catch (error) {
    return handleRouteError(error, "Unable to merge records.");
  }
}
