import { NextResponse } from "next/server";
import { z } from "zod";
import { attachFile, deleteAttachment, listAttachments } from "@/server/records/attachments";
import { subjectEditPermission } from "@/server/records/subjects";
import { scopedContext } from "@/server/records/leads";
import { handleRouteError } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SubjectQuery = z.object({
  subjectType: z.enum(["LEAD", "CONTACT", "ACCOUNT", "CUSTOMER", "OPPORTUNITY"]),
  subjectId: z.string().min(5),
});

/** List attachments for a record. */
export async function GET(request: Request) {
  try {
    await scopedContext("LEADS_READ");
    const params = new URL(request.url).searchParams;
    const parsed = SubjectQuery.safeParse({
      subjectType: params.get("subjectType") ?? undefined,
      subjectId: params.get("subjectId") ?? undefined,
    });
    if (!parsed.success) return NextResponse.json({ error: "Missing subject." }, { status: 400 });
    const attachments = await listAttachments(parsed.data.subjectType, parsed.data.subjectId);
    return NextResponse.json({
      data: attachments.map((attachment) => ({
        id: attachment.id,
        filename: attachment.filename,
        mimeType: attachment.mimeType,
        size: Number(attachment.size),
        uploader: attachment.uploader.name,
        createdAt: attachment.createdAt.toISOString(),
      })),
    });
  } catch (error) {
    return handleRouteError(error, "Unable to load attachments.");
  }
}

/** Upload (multipart form-data: file, subjectType, subjectId). */
export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const file = form.get("file");
    const subjectType = String(form.get("subjectType") ?? "");
    const subjectId = String(form.get("subjectId") ?? "");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Missing file." }, { status: 400 });
    }
    const parsed = SubjectQuery.safeParse({ subjectType, subjectId });
    if (!parsed.success) return NextResponse.json({ error: "Missing subject." }, { status: 400 });
    const ctx = await scopedContext(subjectEditPermission(parsed.data.subjectType));
    const data = Buffer.from(await file.arrayBuffer());
    const attachment = await attachFile(
      ctx,
      {
        subjectType: parsed.data.subjectType,
        subjectId: parsed.data.subjectId,
        filename: file.name,
        mimeType: file.type || "application/octet-stream",
        size: file.size,
      },
      data,
    );
    return NextResponse.json({ data: { id: attachment.id, filename: attachment.filename } }, { status: 201 });
  } catch (error) {
    return handleRouteError(error, "Unable to upload attachment.");
  }
}

export async function DELETE(request: Request) {
  try {
    const ctx = await scopedContext("FILES_READ");
    const id = new URL(request.url).searchParams.get("id");
    if (!id) return NextResponse.json({ error: "Missing id." }, { status: 400 });
    await deleteAttachment(ctx, id);
    return NextResponse.json({ data: { id } });
  } catch (error) {
    return handleRouteError(error, "Unable to delete attachment.");
  }
}
