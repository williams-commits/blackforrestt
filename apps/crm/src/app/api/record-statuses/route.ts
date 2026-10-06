import { NextResponse } from "next/server";
import { requireAnyPermission, requirePermission } from "@/server/guard";
import { subjectPermission, type ActivitySubjectType } from "@/server/records/subjects";
import { CreateStatus, createStatus, listStatuses } from "@/server/records/statuses";
import { handleRouteError, parseJsonBody } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const subjectType = new URL(request.url).searchParams.get("subjectType") as ActivitySubjectType | null;
    const supported = ["LEAD", "CONTACT", "ACCOUNT", "CUSTOMER", "OPPORTUNITY"];
    if (subjectType && supported.includes(subjectType)) {
      await requireAnyPermission(subjectPermission(subjectType, "VIEW"), subjectPermission(subjectType, "CHANGE_STATUS"));
    } else {
      await requirePermission("RECORD_STATUS_VIEW");
    }
    return NextResponse.json({ data: await listStatuses() });
  } catch (error) {
    return handleRouteError(error, "Unable to load statuses.");
  }
}

export async function POST(request: Request) {
  try {
    const ctx = await requirePermission("RECORD_STATUS_CREATE");
    const parsed = await parseJsonBody(request, CreateStatus);
    if (!parsed.ok) return parsed.response;
    return NextResponse.json({ data: await createStatus(ctx, parsed.data) }, { status: 201 });
  } catch (error) {
    return handleRouteError(error, "Unable to create status.");
  }
}
