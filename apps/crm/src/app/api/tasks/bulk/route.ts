import { NextResponse } from "next/server";
import { bulkTasks, BulkTaskAction } from "@/server/records/tasks";
import { scopedContext } from "@/server/records/leads";
import { handleRouteError, parseJsonBody } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    // VIEW is the floor: bulkTasks enforces TASKS_EDIT per action inside
    // updateTask, with row-level visibility on every id.
    const ctx = await scopedContext("TASKS_VIEW");
    const parsed = await parseJsonBody(request, BulkTaskAction);
    if (!parsed.ok) return parsed.response;
    return NextResponse.json({ data: await bulkTasks(ctx, parsed.data) });
  } catch (error) {
    return handleRouteError(error, "Unable to perform bulk action.");
  }
}
