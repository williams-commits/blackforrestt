import { z } from "zod";
import { prisma } from "@/server/db";
import { CrmError } from "@/server/guard";
import { sendEmail, emailConfigured } from "@/server/email";
import { appendActivity } from "@/server/activity";
import { appendAudit } from "@/server/audit";
import { resolveSubject } from "@/server/records/subjects";
import type { ScopedContext } from "@/server/records/leads";

/**
 * Compose-and-send email from a record page. The email goes through the
 * configured SMTP transport; the interaction is logged to the record's
 * timeline and audit trail. Optionally creates a follow-up task.
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

export async function sendRecordEmail(
  ctx: ScopedContext,
  input: z.infer<typeof SendEmail>,
): Promise<{ sent: boolean; emailDisabled: boolean }> {
  if (!emailConfigured()) {
    throw new CrmError(
      "Email sending is not configured — set SMTP_URL in the environment.",
      503,
    );
  }

  // Scope-check the record the email is attached to.
  const subject = await resolveSubject(ctx, input.subjectType, input.subjectId);

  const sent = await sendEmail({
    to: input.to,
    subject: input.subject,
    text: input.body,
  });
  if (!sent) {
    throw new CrmError("Email delivery failed — check SMTP configuration.", 502);
  }

  // Log to timeline + audit
  await prisma.$transaction(async (tx) => {
    await appendActivity(tx, {
      subjectType: subject.type,
      subjectId: subject.id,
      kind: "email_sent" as never,
      actorUserId: ctx.userId,
      payload: { to: input.to, subject: input.subject.slice(0, 120) },
    });
    await appendAudit(tx, {
      actorId: ctx.userId,
      ip: ctx.ip,
      action: "EMAIL_SENT",
      objectType: subject.type === "LEAD" ? "Lead" : subject.type === "CONTACT" ? "Contact" : subject.type === "ACCOUNT" ? "Account" : subject.type === "CUSTOMER" ? "Customer" : "Opportunity",
      objectId: subject.id,
      after: { to: input.to, subject: input.subject.slice(0, 120) },
    });

    // Optional follow-up task
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

    // Update lastContactAt for leads
    if (subject.type === "LEAD") {
      await tx.lead.update({
        where: { id: subject.id },
        data: { lastContactAt: new Date() },
      }).catch(() => undefined);
    }
  });

  return { sent: true, emailDisabled: false };
}

/** List sent emails for a record (from the activity timeline). */
export async function listSentEmails(
  subjectType: string,
  subjectId: string,
  take = 20,
) {
  return prisma.activityEvent.findMany({
    where: { subjectType: subjectType as never, subjectId, kind: "email_sent" },
    orderBy: { createdAt: "desc" },
    take,
    include: { actor: { select: { name: true } } },
  });
}
