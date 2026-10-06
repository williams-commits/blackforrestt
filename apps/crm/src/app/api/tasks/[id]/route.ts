import { NextResponse } from "next/server";
import { UpdateTask, getTask, updateTask } from "@/server/records/tasks";
import { scopedContext } from "@/server/records/leads";
import { handleRouteError, parseJsonBody } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

/** Single-task read — used by the tasks list page's ?edit= deep link to open
 *  the edit drawer for a task the current filters would hide (e.g. a
 *  completed task under the default "active" view). */
export async function GET(_request: Request, context: RouteContext) {
  try {
    const ctx = await scopedContext("TASKS_VIEW");
    const { id } = await context.params;
    return NextResponse.json({ data: await getTask(ctx, id) });
  } catch (error) {
    return handleRouteError(error, "Unable to load task.");
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const ctx = await scopedContext("TASKS_EDIT");
    const { id } = await context.params;
    const parsed = await parseJsonBody(request, UpdateTask);
    if (!parsed.ok) return parsed.response;
    return NextResponse.json({ data: await updateTask(ctx, id, parsed.data) });
  } catch (error) {
    return handleRouteError(error, "Unable to update task.");
  }
}
