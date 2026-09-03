import { NextResponse } from "next/server";
import { LinkTag, linkTag, unlinkTag } from "@/server/records/tags";
import { subjectEditPermission } from "@/server/records/subjects";
import { scopedContext } from "@/server/records/leads";
import { handleRouteError, parseJsonBody } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const parsed = await parseJsonBody(request, LinkTag);
    if (!parsed.ok) return parsed.response;
    const ctx = await scopedContext(subjectEditPermission(parsed.data.subjectType));
    return NextResponse.json({ data: await linkTag(ctx, parsed.data) }, { status: 201 });
  } catch (error) {
    return handleRouteError(error, "Unable to attach tag.");
  }
}

export async function DELETE(request: Request) {
  try {
    const parsed = await parseJsonBody(request, LinkTag);
    if (!parsed.ok) return parsed.response;
    const ctx = await scopedContext(subjectEditPermission(parsed.data.subjectType));
    await unlinkTag(ctx, parsed.data);
    return NextResponse.json({ data: { ok: true } });
  } catch (error) {
    return handleRouteError(error, "Unable to detach tag.");
  }
}
