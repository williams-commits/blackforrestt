import { NextResponse } from "next/server";
import { z } from "zod";
import { CreateNote, createNote, listNotesBySubjectPage } from "@/server/records/notes";
import { resolveSubject, subjectPermission } from "@/server/records/subjects";
import { scopedContext } from "@/server/records/leads";
import { handleRouteError, parseJsonBody } from "@/lib/api";
import { ACTIVITY_STRIP_PAGE_SIZE } from "@/lib/activityStrip";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ListNotesQuery = z.object({
  subjectType: z.enum(["LEAD", "CONTACT", "ACCOUNT", "CUSTOMER", "OPPORTUNITY"]),
  subjectId: z.string().trim().min(5),
  page: z.coerce.number().int().min(1).max(1000).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(ACTIVITY_STRIP_PAGE_SIZE),
});

/** Paginated notes for a record's activity strip. Notes are read with their
 *  record: the subject's VIEW permission + scope (404 when out of scope). */
export async function GET(request: Request) {
  try {
    const params = new URL(request.url).searchParams;
    const parsed = ListNotesQuery.safeParse({
      subjectType: params.get("subjectType") ?? undefined,
      subjectId: params.get("subjectId") ?? undefined,
      page: params.get("page") ?? 1,
      pageSize: params.get("pageSize") ?? ACTIVITY_STRIP_PAGE_SIZE,
    });
    if (!parsed.success) return NextResponse.json({ error: "Missing subject." }, { status: 400 });
    const ctx = await scopedContext(subjectPermission(parsed.data.subjectType, "VIEW"));
    await resolveSubject(ctx, parsed.data.subjectType, parsed.data.subjectId);
    const { rows, total } = await listNotesBySubjectPage(
      parsed.data.subjectType,
      parsed.data.subjectId,
      parsed.data.page,
      parsed.data.pageSize,
    );
    return NextResponse.json({
      data: rows.map((note) => ({
        id: note.id,
        body: note.body,
        createdAt: note.createdAt.toISOString(),
        editedAt: note.editedAt?.toISOString() ?? null,
        author: note.author,
      })),
      meta: {
        total,
        page: parsed.data.page,
        pageSize: parsed.data.pageSize,
        hasMore: parsed.data.page * parsed.data.pageSize < total,
      },
    });
  } catch (error) {
    return handleRouteError(error, "Unable to load notes.");
  }
}

export async function POST(request: Request) {
  try {
    const parsed = await parseJsonBody(request, CreateNote);
    if (!parsed.ok) return parsed.response;
    const ctx = await scopedContext(subjectPermission(parsed.data.subjectType, "ADD_NOTE"));
    return NextResponse.json({ data: await createNote(ctx, parsed.data) }, { status: 201 });
  } catch (error) {
    return handleRouteError(error, "Unable to add note.");
  }
}
