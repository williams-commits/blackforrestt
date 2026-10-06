import { NextResponse } from "next/server";
import { z } from "zod";
import { requirePermission } from "@/server/guard";
import { CreateTag, createTag, deleteTag, listTags } from "@/server/records/tags";
import { scopedContext } from "@/server/records/leads";
import { handleRouteError, parseJsonBody } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SubjectQuery = z.object({
  subjectType: z.enum(["LEAD", "CONTACT", "ACCOUNT", "CUSTOMER", "OPPORTUNITY"]),
  subjectId: z.string().min(5),
});

export async function GET(request: Request) {
  try {
    const params = new URL(request.url).searchParams;
    const subjectType = params.get("subjectType");
    const subjectId = params.get("subjectId");
    if (subjectType && subjectId) {
      // Scoped context + subject resolution: tag names on out-of-scope
      // records must not be disclosed (same rule as attachments).
      const ctx = await scopedContext("TAGS_VIEW");
      const parsed = SubjectQuery.safeParse({ subjectType, subjectId });
      if (!parsed.success) return NextResponse.json({ error: "Invalid subject." }, { status: 400 });
      const { listTagsForSubject } = await import("@/server/records/tags");
      return NextResponse.json({ data: await listTagsForSubject(ctx, parsed.data.subjectType, parsed.data.subjectId) });
    }
    await requirePermission("TAGS_VIEW");
    return NextResponse.json({ data: await listTags() });
  } catch (error) {
    return handleRouteError(error, "Unable to load tags.");
  }
}

export async function POST(request: Request) {
  try {
    const ctx = await scopedContext("TAGS_CREATE");
    const parsed = await parseJsonBody(request, CreateTag);
    if (!parsed.ok) return parsed.response;
    return NextResponse.json({ data: await createTag(ctx, parsed.data) }, { status: 201 });
  } catch (error) {
    return handleRouteError(error, "Unable to create tag.");
  }
}

export async function DELETE(request: Request) {
  try {
    const ctx = await scopedContext("TAGS_DELETE");
    const id = new URL(request.url).searchParams.get("id");
    if (!id) return NextResponse.json({ error: "Missing id." }, { status: 400 });
    await deleteTag(ctx, id);
    return NextResponse.json({ data: { id } });
  } catch (error) {
    return handleRouteError(error, "Unable to delete tag.");
  }
}
