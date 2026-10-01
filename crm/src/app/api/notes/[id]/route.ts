import { NextResponse } from "next/server";
import { UpdateNote, updateNote } from "@/server/records/notes";
import { scopedContext } from "@/server/records/leads";
import { handleRouteError, parseJsonBody } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  try {
    // Route gate is the entry ticket only; the service narrows to the
    // author or NOTES_EDIT holders inside the subject's scope.
    const ctx = await scopedContext("NOTES_CREATE");
    const { id } = await context.params;
    const parsed = await parseJsonBody(request, UpdateNote);
    if (!parsed.ok) return parsed.response;
    return NextResponse.json({ data: await updateNote(ctx, id, parsed.data) });
  } catch (error) {
    return handleRouteError(error, "Unable to update note.");
  }
}
