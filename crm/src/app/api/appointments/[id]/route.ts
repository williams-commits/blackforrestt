import { NextResponse } from "next/server";
import { UpdateAppointment, updateAppointment } from "@/server/records/appointments";
import { scopedContext } from "@/server/records/leads";
import { handleRouteError, parseJsonBody } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const ctx = await scopedContext("TASKS_EDIT");
    const { id } = await context.params;
    const parsed = await parseJsonBody(request, UpdateAppointment);
    if (!parsed.ok) return parsed.response;
    return NextResponse.json({ data: await updateAppointment(ctx, id, parsed.data) });
  } catch (error) {
    return handleRouteError(error, "Unable to update appointment.");
  }
}
