import { NextResponse } from "next/server";
import { requirePermission } from "@/server/guard";
import { CreateTag, createTag, deleteTag, listTags } from "@/server/records/tags";
import { scopedContext } from "@/server/records/leads";
import { handleRouteError, parseJsonBody } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    await requirePermission("LEADS_READ");
    const params = new URL(request.url).searchParams;
    const subjectType = params.get("subjectType");
    const subjectId = params.get("subjectId");
    if (subjectType && subjectId) {
      const { listTagsForSubject } = await import("@/server/records/tags");
      return NextResponse.json({ data: await listTagsForSubject(subjectType, subjectId) });
    }
    return NextResponse.json({ data: await listTags() });
  } catch (error) {
    return handleRouteError(error, "Unable to load tags.");
  }
}

export async function POST(request: Request) {
  try {
    const ctx = await scopedContext("SETTINGS_MANAGE");
    const parsed = await parseJsonBody(request, CreateTag);
    if (!parsed.ok) return parsed.response;
    return NextResponse.json({ data: await createTag(ctx, parsed.data) }, { status: 201 });
  } catch (error) {
    return handleRouteError(error, "Unable to create tag.");
  }
}

export async function DELETE(request: Request) {
  try {
    const ctx = await scopedContext("SETTINGS_MANAGE");
    const id = new URL(request.url).searchParams.get("id");
    if (!id) return NextResponse.json({ error: "Missing id." }, { status: 400 });
    await deleteTag(ctx, id);
    return NextResponse.json({ data: { id } });
  } catch (error) {
    return handleRouteError(error, "Unable to delete tag.");
  }
}
