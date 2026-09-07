import { NextResponse } from "next/server";
import { CreateNote, createNote } from "@/server/records/notes";
import { subjectPermission } from "@/server/records/subjects";
import { requireCapability } from "@/server/guard";
import { scopedContext } from "@/server/records/leads";
import { handleRouteError, parseJsonBody } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const parsed = await parseJsonBody(request, CreateNote);
    if (!parsed.ok) return parsed.response;
    const ctx = await scopedContext("NOTES_CREATE");
    requireCapability(ctx, subjectPermission(parsed.data.subjectType, "ADD_NOTE"));
    return NextResponse.json({ data: await createNote(ctx, parsed.data) }, { status: 201 });
  } catch (error) {
    return handleRouteError(error, "Unable to add note.");
  }
}
