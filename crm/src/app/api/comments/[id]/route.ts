import { NextResponse } from "next/server";
import { UpdateComment, updateComment, deleteComment } from "@/server/records/comments";
import { scopedContext } from "@/server/records/leads";
import { handleRouteError, parseJsonBody } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const ctx = await scopedContext("COMMENTS_CREATE");
    const { id } = await context.params;
    const parsed = await parseJsonBody(request, UpdateComment);
    if (!parsed.ok) return parsed.response;
    return NextResponse.json({ data: await updateComment(ctx, id, parsed.data) });
  } catch (error) {
    return handleRouteError(error, "Unable to update comment.");
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  try {
    const ctx = await scopedContext("COMMENTS_CREATE");
    const { id } = await context.params;
    await deleteComment(ctx, id);
    return NextResponse.json({ data: { ok: true } });
  } catch (error) {
    return handleRouteError(error, "Unable to delete comment.");
  }
}
