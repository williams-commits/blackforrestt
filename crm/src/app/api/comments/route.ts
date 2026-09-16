import { NextResponse } from "next/server";
import { CreateComment, listComments, createComment } from "@/server/records/comments";
import { scopedContext } from "@/server/records/leads";
import { handleRouteError, parseJsonBody } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    // Read access follows the parent work item: every subject type here is
    // gated by its own view permission on the scoped context.
    const ctx = await scopedContext("TASKS_VIEW");
    const params = new URL(request.url).searchParams;
    const subjectType = params.get("subjectType");
    const subjectId = params.get("subjectId");
    if (!subjectType || !subjectId) {
      return NextResponse.json({ error: "subjectType and subjectId are required." }, { status: 400 });
    }
    const parsed = CreateComment.pick({ subjectType: true, subjectId: true }).safeParse({ subjectType, subjectId });
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid comment subject." }, { status: 400 });
    }
    const data = await listComments(ctx, parsed.data.subjectType, parsed.data.subjectId);
    return NextResponse.json({ data });
  } catch (error) {
    return handleRouteError(error, "Unable to load comments.");
  }
}

export async function POST(request: Request) {
  try {
    const parsed = await parseJsonBody(request, CreateComment);
    if (!parsed.ok) return parsed.response;
    const ctx = await scopedContext("COMMENTS_CREATE"); // parent scope enforced in the service
    return NextResponse.json({ data: await createComment(ctx, parsed.data) }, { status: 201 });
  } catch (error) {
    return handleRouteError(error, "Unable to post comment.");
  }
}
