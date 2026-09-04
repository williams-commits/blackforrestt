import { randomUUID } from "node:crypto";
import { z } from "zod";
import { prisma } from "@/server/db";
import { CrmError } from "@/server/guard";
import { appendAudit } from "@/server/audit";
import { storage } from "@/server/storage";
import { resolveSubject } from "@/server/records/subjects";
import type { ScopedContext } from "@/server/records/leads";

/**
 * Record attachments. Uploads go through the storage abstraction, metadata
 * lands in Attachment, and every access re-resolves the subject through the
 * scope checker — attachments inherit record visibility exactly.
 */

const MAX_SIZE = 10 * 1024 * 1024; // 10 MB
const ALLOWED_TYPES = [
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/webp",
  "text/plain",
  "text/csv",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel",
  "application/msword",
];

export const AttachFile = z.object({
  subjectType: z.enum(["LEAD", "CONTACT", "ACCOUNT", "CUSTOMER", "OPPORTUNITY"]),
  subjectId: z.string().min(5),
  filename: z.string().trim().min(1).max(200),
  mimeType: z.string().trim().min(3).max(120),
  size: z.number().int().min(1).max(MAX_SIZE),
});

function assertFileAllowed(filename: string, mimeType: string, size: number) {
  if (size > MAX_SIZE) throw new CrmError("File exceeds the 10 MB limit.", 400);
  if (!ALLOWED_TYPES.includes(mimeType)) {
    throw new CrmError(`File type ${mimeType} is not allowed.`, 415);
  }
  // Defense-in-depth: never trust the client filename for storage.
  if (/[\\/]/.test(filename)) throw new CrmError("Invalid filename.", 400);
}

export async function attachFile(
  ctx: ScopedContext,
  input: z.infer<typeof AttachFile>,
  data: Buffer,
) {
  assertFileAllowed(input.filename, input.mimeType, input.size);
  if (data.byteLength !== input.size) {
    throw new CrmError("Declared size does not match the uploaded file.", 400);
  }
  const subject = await resolveSubject(ctx, input.subjectType, input.subjectId);
  const extension = input.filename.includes(".") ? input.filename.split(".").pop()!.slice(0, 10) : "bin";
  const key = `${subject.type.toLowerCase()}/${subject.id}/${randomUUID()}.${extension}`;
  await storage().put(key, data, input.mimeType);
  return prisma.$transaction(async (tx) => {
    const attachment = await tx.attachment.create({
      data: {
        filename: input.filename,
        mimeType: input.mimeType,
        size: BigInt(input.size),
        storageKey: key,
        uploaderUserId: ctx.userId,
        subjectType: subject.type,
        subjectId: subject.id,
      },
    });
    await appendAudit(tx, {
      actorId: ctx.userId,
      ip: ctx.ip,
      action: "ATTACHMENT_UPLOADED",
      objectType: "Attachment",
      objectId: attachment.id,
      after: { filename: input.filename, subject: subject.label },
    });
    return attachment;
  });
}

export async function listAttachments(subjectType: string, subjectId: string) {
  return prisma.attachment.findMany({
    where: { subjectType: subjectType as never, subjectId },
    orderBy: { createdAt: "desc" },
    take: 50,
    include: { uploader: { select: { name: true } } },
  });
}

/** Fetch an attachment for download after scope-checking its subject. */
export async function getAttachment(ctx: ScopedContext, attachmentId: string) {
  const attachment = await prisma.attachment.findUnique({ where: { id: attachmentId } });
  if (!attachment) throw new CrmError("Attachment not found.", 404);
  // Scope check: the caller must be able to see the owning record.
  await resolveSubject(ctx, attachment.subjectType as never, attachment.subjectId);
  const stored = await storage().get(attachment.storageKey);
  if (!stored) throw new CrmError("Stored file is missing.", 410);
  return { attachment, data: stored.data };
}

export async function deleteAttachment(ctx: ScopedContext, attachmentId: string) {
  const attachment = await prisma.attachment.findUnique({ where: { id: attachmentId } });
  if (!attachment) throw new CrmError("Attachment not found.", 404);
  // Uploader or a deleter on the subject may remove it.
  await resolveSubject(ctx, attachment.subjectType as never, attachment.subjectId);
  if (attachment.uploaderUserId !== ctx.userId && !ctx.permissions.includes("FILES_DELETE")) {
    throw new CrmError("Forbidden — only the uploader or a file manager may delete this.", 403);
  }
  await storage().delete(attachment.storageKey);
  await prisma.$transaction(async (tx) => {
    await tx.attachment.delete({ where: { id: attachmentId } });
    await appendAudit(tx, {
      actorId: ctx.userId,
      ip: ctx.ip,
      action: "ATTACHMENT_DELETED",
      objectType: "Attachment",
      objectId: attachmentId,
      before: { filename: attachment.filename },
    });
  });
}
