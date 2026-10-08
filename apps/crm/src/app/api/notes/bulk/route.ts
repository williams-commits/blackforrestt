import { NextResponse } from "next/server";
import { BulkCreateNotes, createNotesBulk } from "@/server/records/notes";
import { subjectPermission } from "@/server/records/subjects";
import { scopedContext } from "@/server/records/leads";
import { handleRouteError, parseJsonBody } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Bulk note creation: one body on many records of one subject type
 * ({ subjectType, subjectIds[], body }). The route floor is the subject's
 * ADD_NOTE permission — createNotesBulk re-checks it and enforces each
 * record's scope individually, so an out-of-scope record fails for that
 * record only. 201 when every note landed; 200 with a failures list when
 * some did not.
 */
export async function POST(request: Request) {
  try {
    const parsed = await parseJsonBody(request, BulkCreateNotes);
    if (!parsed.ok) return parsed.response;
    const ctx = await scopedContext(subjectPermission(parsed.data.subjectType, "ADD_NOTE"));
    const result = await createNotesBulk(ctx, parsed.data);
    return NextResponse.json({ data: result }, { status: result.failures.length === 0 ? 201 : 200 });
  } catch (error) {
    return handleRouteError(error, "Unable to add notes.");
  }
}
