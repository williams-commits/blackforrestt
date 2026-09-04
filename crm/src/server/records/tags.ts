import { z } from "zod";
import { prisma } from "@/server/db";
import { CrmError } from "@/server/guard";
import { appendAudit } from "@/server/audit";
import { resolveSubject } from "@/server/records/subjects";
import type { ScopedContext } from "@/server/records/leads";

/** Tags: global labels attachable to any core record. */

export const CreateTag = z.object({
  name: z.string().trim().min(1).max(40),
  color: z
    .string()
    .trim()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .optional()
    .nullable(),
});

export const UpdateTag = CreateTag.partial();

export function listTags() {
  return prisma.tag.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { links: true } } },
  });
}

export function listTagsForSubject(subjectType: string, subjectId: string) {
  return prisma.tagLink.findMany({
    where: { subjectType: subjectType as never, subjectId },
    include: { tag: true },
  });
}

export async function createTag(ctx: ScopedContext, input: z.infer<typeof CreateTag>) {
  const existing = await prisma.tag.findUnique({ where: { name: input.name } });
  if (existing) throw new CrmError("A tag with this name already exists.", 400);
  const tag = await prisma.$transaction(async (tx) => {
    const created = await tx.tag.create({ data: input });
    await appendAudit(tx, {
      actorId: ctx.userId,
      ip: ctx.ip,
      action: "TAG_CREATED",
      objectType: "Tag",
      objectId: created.id,
      after: { name: created.name },
    });
    return created;
  });
  return tag;
}

export async function deleteTag(ctx: ScopedContext, id: string) {
  const existing = await prisma.tag.findUnique({ where: { id } });
  if (!existing) throw new CrmError("Tag not found.", 404);
  await prisma.$transaction(async (tx) => {
    await tx.tag.delete({ where: { id } }); // links cascade
    await appendAudit(tx, {
      actorId: ctx.userId,
      ip: ctx.ip,
      action: "TAG_DELETED",
      objectType: "Tag",
      objectId: id,
      before: { name: existing.name },
    });
  });
}

export const LinkTag = z.object({
  tagId: z.string().min(5),
  subjectType: z.enum(["LEAD", "CONTACT", "ACCOUNT", "CUSTOMER", "OPPORTUNITY"]),
  subjectId: z.string().min(5),
});

/** Attach a tag to a record (subject scope-checked first). */
export async function linkTag(ctx: ScopedContext, input: z.infer<typeof LinkTag>) {
  const tag = await prisma.tag.findUnique({ where: { id: input.tagId } });
  if (!tag) throw new CrmError("Tag not found.", 404);
  const subject = await resolveSubject(ctx, input.subjectType, input.subjectId);
  return prisma.tagLink.upsert({
    where: {
      tagId_subjectType_subjectId: {
        tagId: tag.id,
        subjectType: subject.type,
        subjectId: subject.id,
      },
    },
    create: { tagId: tag.id, subjectType: subject.type, subjectId: subject.id },
    update: {},
  });
}

/** Detach a tag from a record (subject scope-checked first). */
export async function unlinkTag(ctx: ScopedContext, input: z.infer<typeof LinkTag>) {
  const subject = await resolveSubject(ctx, input.subjectType, input.subjectId);
  await prisma.tagLink.deleteMany({
    where: { tagId: input.tagId, subjectType: subject.type, subjectId: subject.id },
  });
}
