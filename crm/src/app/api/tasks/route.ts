import { NextResponse } from "next/server";
import { CreateTask, TaskFilters, createTask, listTasks } from "@/server/records/tasks";
import { scopedContext } from "@/server/records/leads";
import { parseListQuery } from "@/server/listQuery";
import { handleRouteError, parseJsonBody } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const ctx = await scopedContext("TASKS_READ");
    const params = new URL(request.url).searchParams;
    const query = parseListQuery(params);
    const filters = TaskFilters.parse({
      status: params.get("status") ?? undefined,
      due: params.get("due") ?? "all",
      mine: params.get("mine") ?? "1",
      subjectType: params.get("subjectType") ?? undefined,
      subjectId: params.get("subjectId") ?? undefined,
    });
    const { total, rows, openCount, overdueCount } = await listTasks(ctx, query, filters);
    return NextResponse.json({
      data: rows,
      meta: { page: query.page, pageSize: query.pageSize, total, openCount, overdueCount },
    });
  } catch (error) {
    return handleRouteError(error, "Unable to load tasks.");
  }
}

export async function POST(request: Request) {
  try {
    const ctx = await scopedContext("TASKS_CREATE");
    const parsed = await parseJsonBody(request, CreateTask);
    if (!parsed.ok) return parsed.response;
    return NextResponse.json({ data: await createTask(ctx, parsed.data) }, { status: 201 });
  } catch (error) {
    return handleRouteError(error, "Unable to create task.");
  }
}
