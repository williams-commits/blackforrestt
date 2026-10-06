import { NextResponse } from "next/server";
import { z } from "zod";
import {
  CreateAppointment,
  createAppointment,
  listAppointmentsBySubjectPage,
  upcomingAppointmentsForUser,
} from "@/server/records/appointments";
import { resolveSubject, subjectPermission } from "@/server/records/subjects";
import { scopedContext } from "@/server/records/leads";
import { handleRouteError, parseJsonBody } from "@/lib/api";
import { ACTIVITY_STRIP_PAGE_SIZE } from "@/lib/activityStrip";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SubjectListQuery = z.object({
  subjectType: z.enum(["LEAD", "CONTACT", "ACCOUNT", "CUSTOMER", "OPPORTUNITY"]),
  subjectId: z.string().trim().min(5),
  page: z.coerce.number().int().min(1).max(1000).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(ACTIVITY_STRIP_PAGE_SIZE),
});

/**
 * Subject mode (?subjectType=&subjectId=): paginated schedule for a record's
 * Schedule strip — read with the subject's VIEW permission + scope.
 * No subject params: the signed-in user's upcoming appointments (home widget).
 */
export async function GET(request: Request) {
  try {
    const params = new URL(request.url).searchParams;
    const subjectType = params.get("subjectType");
    const subjectId = params.get("subjectId");

    if (subjectType && subjectId) {
      const parsed = SubjectListQuery.safeParse({
        subjectType,
        subjectId,
        page: params.get("page") ?? 1,
        pageSize: params.get("pageSize") ?? ACTIVITY_STRIP_PAGE_SIZE,
      });
      if (!parsed.success) return NextResponse.json({ error: "Missing subject." }, { status: 400 });
      const ctx = await scopedContext(subjectPermission(parsed.data.subjectType, "VIEW"));
      await resolveSubject(ctx, parsed.data.subjectType, parsed.data.subjectId);
      const { rows, total } = await listAppointmentsBySubjectPage(
        parsed.data.subjectType,
        parsed.data.subjectId,
        parsed.data.page,
        parsed.data.pageSize,
      );
      return NextResponse.json({
        data: rows.map((appointment) => ({
          id: appointment.id,
          title: appointment.title,
          startAt: appointment.startAt.toISOString(),
          endAt: appointment.endAt?.toISOString() ?? null,
          status: appointment.status,
          locationOrLink: appointment.locationOrLink,
        })),
        meta: {
          total,
          page: parsed.data.page,
          pageSize: parsed.data.pageSize,
          hasMore: parsed.data.page * parsed.data.pageSize < total,
        },
      });
    }

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
