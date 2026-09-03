import { NextResponse } from "next/server";
import { CreateNote, createNote } from "@/server/records/notes";
import { subjectEditPermission } from "@/server/records/subjects";
import { scopedContext } from "@/server/records/leads";
import { handleRouteError, parseJsonBody } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const parsed = await parseJsonBody(request, CreateNote);
    if (!parsed.ok) return parsed.response;
    // Writing on a record requires that record's edit permission…
    const ctx = await scopedContext(subjectEditPermission(parsed.data.subjectType));
    // …and the service re-validates subject visibility within scope.
    return NextResponse.json({ data: await createNote(ctx, parsed.data) }, { status: 201 });
  } catch (error) {
    return handleRouteError(error, "Unable to add note.");
  }
}
