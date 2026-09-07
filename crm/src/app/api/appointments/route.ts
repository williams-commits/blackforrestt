import { NextResponse } from "next/server";
import {
  CreateAppointment,
  createAppointment,
  upcomingAppointmentsForUser,
} from "@/server/records/appointments";
import { subjectPermission } from "@/server/records/subjects";
import { scopedContext } from "@/server/records/leads";
import { handleRouteError, parseJsonBody } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const ctx = await scopedContext("APPOINTMENTS_VIEW");
    return NextResponse.json({ data: await upcomingAppointmentsForUser(ctx.userId) });
  } catch (error) {
    return handleRouteError(error, "Unable to load appointments.");
  }
}

export async function POST(request: Request) {
  try {
    const parsed = await parseJsonBody(request, CreateAppointment);
    if (!parsed.ok) return parsed.response;
    const ctx = await scopedContext(subjectPermission(parsed.data.subjectType, "SCHEDULE_APPOINTMENT"));
    return NextResponse.json(
      { data: await createAppointment(ctx, parsed.data) },
      { status: 201 },
    );
  } catch (error) {
    return handleRouteError(error, "Unable to schedule appointment.");
  }
}
