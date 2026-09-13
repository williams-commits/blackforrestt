import { createHash } from "node:crypto";
import { timingSafeEqual } from "node:crypto";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/server/db";
import { CrmError, requireCapability } from "@/server/guard";
import { sendEmail, emailConfigured } from "@/server/email";
import { appendActivity } from "@/server/activity";
import { appendAudit } from "@/server/audit";
import { resolveSubject } from "@/server/records/subjects";
import type { ScopedContext } from "@/server/records/leads";

/**
 * Email module — emails as first-class CRM records.
 *
 * Outbound sends persist an EmailMessage row (SENT, or FAILED with the
 * reason); inbound mail arrives through the ingestion webhook and is
 * auto-linked to a matching record by sender address. Both directions link
 * to records by subjectType/subjectId exactly like notes, tasks and files,
 * so every record page carries its full email history.
 *
 * Scope rules for reads: an email linked to a record is visible exactly to
 * users who can see that record (the subject resolver enforces it); unlinked
 * inbound mail is visible to every EMAILS_VIEW holder — a shared inbox.
 */

export const SendEmail = z.object({
  to: z.string().trim().email().max(200),
  cc: z.string().trim().email().max(200).optional().nullable(),
  subject: z.string().trim().min(1).max(300),
  body: z.string().trim().min(1).max(20_000),
  subjectType: z.enum(["LEAD", "CONTACT", "ACCOUNT", "CUSTOMER", "OPPORTUNITY"]),
  subjectId: z.string().min(5),
  createFollowUp: z.boolean().optional(),
  followUpInDays: z.number().int().min(1).max(90).optional(),
});

const PAGE_SIZE = 25;

export const MailboxQuery = z.object({
  folder: z.enum(["inbox", "sent", "all"]).default("inbox"),
  unread: z.coerce.boolean().default(false),
  q: z.string().trim().max(120).optional(),
  subjectType: z.enum(["LEAD", "CONTACT", "ACCOUNT", "CUSTOMER", "OPPORTUNITY"]).optional(),
  subjectId: z.string().trim().min(5).optional(),
  page: z.coerce.number().int().min(1).max(500).default(1),
});

/** Normalized conversation key for free (unlinked) threads. */
function freeThreadKey(subject: string): string {
  return `free:${subject.toLowerCase().replace(/^(re|fwd|fw):\s*/i, "").trim()}`;
}

export async function sendRecordEmail(
  ctx: ScopedContext,
  input: z.infer<typeof SendEmail>,
): Promise<{ sent: boolean; emailDisabled: boolean; emailId: string }> {
  // Sending uses the company's SMTP identity: the dedicated EMAILS_SEND
  // permission governs it (the email module's own capability), and the
  // target record must be inside the sender's data scope.
  requireCapability(ctx, "EMAILS_SEND");
  const subject = await resolveSubject(ctx, input.subjectType, input.subjectId);
  const from = process.env.SMTP_FROM?.match(/<([^>]+)>/)?.[1] ?? process.env.SMTP_FROM ?? "";

  const persist = async (status: "SENT" | "FAILED", error?: string) =>
    prisma.emailMessage.create({
      data: {
        direction: "OUTBOUND",
        status,
        fromAddress: from,
        toAddress: input.to,
        ccAddress: input.cc ?? null,
        subject: input.subject,
        body: input.body,
        subjectType: subject.type as "LEAD" | "CONTACT" | "ACCOUNT" | "CUSTOMER" | "OPPORTUNITY",
        subjectId: subject.id,
        threadKey: `${subject.type}:${subject.id}`,
        readAt: new Date(), // your own send is never "unread"
        sentById: ctx.userId,
        error: error ?? null,
      },
      select: { id: true },
    });

  if (!emailConfigured()) {
    await persist("FAILED", "SMTP not configured");
    await prisma.$transaction(async (tx) => {
      await appendActivity(tx, {
        subjectType: subject.type,
        subjectId: subject.id,
        kind: "email_failed" as never,
        actorUserId: ctx.userId,
        payload: { to: input.to, subject: input.subject.slice(0, 120), reason: "SMTP not configured" },
      });
    });
    throw new CrmError("Email sending is not configured — set SMTP_URL in the environment.", 503);
  }

  const sent = await sendEmail({ to: input.to, cc: input.cc ?? undefined, subject: input.subject, text: input.body });
  const stored = await persist(sent ? "SENT" : "FAILED", sent ? undefined : "SMTP delivery rejected the message");
  if (!sent) {
    throw new CrmError("Email delivery failed — check SMTP configuration.", 502);
  }

  await prisma.$transaction(async (tx) => {
    await appendActivity(tx, {
      subjectType: subject.type,
      subjectId: subject.id,
      kind: "email_sent" as never,
      actorUserId: ctx.userId,
      payload: { to: input.to, subject: input.subject.slice(0, 120), emailId: stored.id },
    });
    await appendAudit(tx, {
      actorId: ctx.userId,
      ip: ctx.ip,
      action: "EMAIL_SENT",
      objectType: subject.type === "LEAD" ? "Lead" : subject.type === "CONTACT" ? "Contact" : subject.type === "ACCOUNT" ? "Account" : subject.type === "CUSTOMER" ? "Customer" : "Opportunity",
      objectId: subject.id,
      after: { to: input.to, subject: input.subject.slice(0, 120), emailId: stored.id },
    });

    if (input.createFollowUp) {
      const days = input.followUpInDays ?? 3;
      await tx.task.create({
        data: {
          title: `Follow up: "${input.subject.slice(0, 80)}" → ${input.to}`,
          description: `Automatic follow-up after sending an email to ${input.to}.`,
          ownerUserId: ctx.userId,
          dueAt: new Date(Date.now() + days * 24 * 60 * 60 * 1000),
          priority: "NORMAL",
          subjectType: subject.type,
          subjectId: subject.id,
        },
      });
    }

    if (subject.type === "LEAD") {
      await tx.lead.update({
        where: { id: subject.id },
        data: { lastContactAt: new Date() },
      }).catch(() => undefined);
    }
  });

  return { sent: true, emailDisabled: false, emailId: stored.id };
}

/** Can the reader see an email row? Linked rows follow record scope. */
async function canSee(ctx: ScopedContext, row: { subjectType: string | null; subjectId: string | null }): Promise<boolean> {
  if (!row.subjectType || !row.subjectId) return true; // shared inbox
  try {
    await resolveSubject(ctx, row.subjectType as never, row.subjectId);
    return true;
  } catch {
    return false;
  }
}

export async function listMailbox(
  ctx: ScopedContext,
  query: z.infer<typeof MailboxQuery>,
): Promise<{ rows: EmailListRow[]; page: number; pageSize: number; hasMore: boolean; unreadCount: number }> {
  requireCapability(ctx, "EMAILS_VIEW");

  // Record history: scope-check the subject once, then list directly.
  if (query.subjectType && query.subjectId) {
    const subject = await resolveSubject(ctx, query.subjectType, query.subjectId);
    const rows = await prisma.emailMessage.findMany({
      where: {
        subjectType: subject.type as never,
        subjectId: subject.id,
        ...(query.q
          ? { OR: [
              { subject: { contains: query.q, mode: "insensitive" } },
              { body: { contains: query.q, mode: "insensitive" } },
              { fromAddress: { contains: query.q, mode: "insensitive" } },
              { toAddress: { contains: query.q, mode: "insensitive" } },
            ] }
          : {}),
      },
      orderBy: { createdAt: "desc" },
      take: 100,
      include: { sentBy: { select: { name: true } } },
    });
    return {
      rows: rows.map(serializeEmail),
      page: 1,
      pageSize: rows.length,
      hasMore: false,
      unreadCount: rows.filter((row) => row.direction === "INBOUND" && !row.readAt).length,
    };
  }

  const where: Prisma.EmailMessageWhereInput = {
    ...(query.folder === "inbox" ? { direction: "INBOUND" } : {}),
    ...(query.folder === "sent" ? { direction: "OUTBOUND" } : {}),
    ...(query.unread ? { readAt: null, direction: "INBOUND" } : {}),
    ...(query.q
      ? { OR: [
          { subject: { contains: query.q, mode: "insensitive" } },
          { body: { contains: query.q, mode: "insensitive" } },
          { fromAddress: { contains: query.q, mode: "insensitive" } },
          { toAddress: { contains: query.q, mode: "insensitive" } },
        ] }
      : {}),
  };

  // Linked rows must pass the record-scope filter. Fetch a wider page, then
  // trim — scope checks are per-record resolver calls, bounded by page size.
  const candidates = await prisma.emailMessage.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: PAGE_SIZE * 4,
    skip: (query.page - 1) * PAGE_SIZE,
    include: { sentBy: { select: { name: true } } },
  });
  const visible: typeof candidates = [];
  for (const row of candidates) {
    if (await canSee(ctx, row)) visible.push(row);
    if (visible.length === PAGE_SIZE) break;
  }

  const unreadCount = await prisma.emailMessage.count({ where: { direction: "INBOUND", readAt: null } });
  return {
    rows: visible.map(serializeEmail),
    page: query.page,
    pageSize: PAGE_SIZE,
    hasMore: candidates.length === PAGE_SIZE * 4,
    unreadCount,
  };
}

export type EmailListRow = {
  id: string;
  direction: "INBOUND" | "OUTBOUND";
  status: "RECEIVED" | "SENT" | "FAILED";
  from: string;
  to: string;
  cc: string | null;
  subject: string;
  preview: string;
  body: string;
  subjectType: string | null;
  subjectId: string | null;
  read: boolean;
  sentBy: string | null;
  error: string | null;
  createdAt: string;
};

function serializeEmail(row: {
  id: string; direction: "INBOUND" | "OUTBOUND"; status: "RECEIVED" | "SENT" | "FAILED";
  fromAddress: string; toAddress: string; ccAddress: string | null; subject: string; body: string;
  subjectType: string | null; subjectId: string | null; readAt: Date | null; error: string | null;
  createdAt: Date; sentBy?: { name: string } | null;
}): EmailListRow {
  return {
    id: row.id,
    direction: row.direction,
    status: row.status,
    from: row.fromAddress,
    to: row.toAddress,
    cc: row.ccAddress,
    subject: row.subject,
    preview: row.body.replace(/\s+/g, " ").slice(0, 140),
    body: row.body,
    subjectType: row.subjectType,
    subjectId: row.subjectId,
    read: row.readAt != null,
    sentBy: row.sentBy?.name ?? null,
    error: row.error,
    createdAt: row.createdAt.toISOString(),
  };
}

/** Fetch one email for reading. Marks inbound mail as read. */
export async function readEmail(ctx: ScopedContext, id: string): Promise<EmailListRow> {
  requireCapability(ctx, "EMAILS_VIEW");
  const row = await prisma.emailMessage.findUnique({ where: { id }, include: { sentBy: { select: { name: true } } } });
  if (!row) throw new CrmError("Email not found.", 404);
  if (!(await canSee(ctx, row))) throw new CrmError("Email not found.", 404);
  if (row.direction === "INBOUND" && !row.readAt) {
    await prisma.emailMessage.update({ where: { id }, data: { readAt: new Date() } }).catch(() => undefined);
    return serializeEmail({ ...row, readAt: new Date() });
  }
  return serializeEmail(row);
}

/** Toggle read state (inbox triage). */
export async function setEmailRead(ctx: ScopedContext, id: string, read: boolean): Promise<EmailListRow> {
  requireCapability(ctx, "EMAILS_VIEW");
  const row = await prisma.emailMessage.findUnique({ where: { id } });
  if (!row) throw new CrmError("Email not found.", 404);
  if (!(await canSee(ctx, row))) throw new CrmError("Email not found.", 404);
  const updated = await prisma.emailMessage.update({
    where: { id },
    data: { readAt: read ? new Date() : null },
    include: { sentBy: { select: { name: true } } },
  });
  return serializeEmail(updated);
}

// ── Inbound ingestion ────────────────────────────────────────────────────────

export const InboundEmail = z.object({
  from: z.string().trim().email().max(200),
  to: z.string().trim().email().max(200),
  cc: z.string().trim().email().max(200).optional().nullable(),
  subject: z.string().trim().min(1).max(300),
  text: z.string().max(100_000),
  messageId: z.string().trim().max(500).optional().nullable(),
});

/** Constant-time shared-secret check for the ingestion webhook. */
export function inboundTokenAllowed(request: Request): boolean {
  const expected = process.env.INBOUND_EMAIL_TOKEN?.trim();
  if (!expected) return false;
  const header = request.headers.get("authorization") ?? "";
  const presented = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (!presented) return false;
  const a = createHash("sha256").update(expected).digest();
  const b = createHash("sha256").update(presented).digest();
  return timingSafeEqual(a, b);
}

/**
 * Record an inbound email (webhook from the mail provider, or a manual
 * forward). Deduplicates by Message-ID, auto-links the sender to a CRM
 * record (contact → customer → lead, by exact email match), and logs a
 * timeline event on the linked record.
 */
export async function receiveInboundEmail(
  input: z.infer<typeof InboundEmail>,
): Promise<{ id: string; linkedTo: { subjectType: string; subjectId: string } | null; deduplicated: boolean }> {
  if (input.messageId) {
    const existing = await prisma.emailMessage.findUnique({ where: { messageId: input.messageId } });
    if (existing) {
      return {
        id: existing.id,
        linkedTo: existing.subjectType && existing.subjectId
          ? { subjectType: existing.subjectType, subjectId: existing.subjectId }
          : null,
        deduplicated: true,
      };
    }
  }

  // Auto-link the sender to a CRM record — contact first, then customer, then
  // lead (a person's most specific identity wins).
  const contact = await prisma.contact.findFirst({ where: { email: input.from, deletedAt: null }, select: { id: true } });
  const customer = contact
    ? null
    : await prisma.customer.findFirst({ where: { email: input.from, deletedAt: null }, select: { id: true } });
  const lead = contact || customer
    ? null
    : await prisma.lead.findFirst({ where: { email: input.from, deletedAt: null }, select: { id: true } });
  const link =
    contact ? { subjectType: "CONTACT" as const, subjectId: contact.id }
    : customer ? { subjectType: "CUSTOMER" as const, subjectId: customer.id }
    : lead ? { subjectType: "LEAD" as const, subjectId: lead.id }
    : null;

  const created = await prisma.emailMessage.create({
    data: {
      direction: "INBOUND",
      status: "RECEIVED",
      fromAddress: input.from,
      toAddress: input.to,
      ccAddress: input.cc ?? null,
      subject: input.subject,
      body: input.text,
      subjectType: link?.subjectType ?? null,
      subjectId: link?.subjectId ?? null,
      threadKey: link ? `${link.subjectType}:${link.subjectId}` : freeThreadKey(input.subject),
      messageId: input.messageId ?? null,
    },
    select: { id: true },
  });

  if (link) {
    await prisma.$transaction(async (tx) => {
      await appendActivity(tx, {
        subjectType: link.subjectType as never,
        subjectId: link.subjectId,
        kind: "email_received" as never,
        actorUserId: null,
        payload: { from: input.from, subject: input.subject.slice(0, 120), emailId: created.id },
      });
      if (link.subjectType === "LEAD") {
        await tx.lead.update({ where: { id: link.subjectId }, data: { lastContactAt: new Date() } }).catch(() => undefined);
      }
    });
  }

  return { id: created.id, linkedTo: link, deduplicated: false };
}
