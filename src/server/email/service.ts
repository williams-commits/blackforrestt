import type { Prisma } from "@prisma/client";
import { prisma } from "../db";
import { appendAuditEvent } from "../ledger";
import { developmentEmailPreviewEnabled } from "../security/tokens";
import { deliverRenderedEmail, emailDeliveryEnabled, emailProviderConfigured } from "./provider";
import { renderEmail, type EmailTemplateName, type EmailVariables } from "./templates";
import { brandApexOrigin, brandProfileForDomain, brandDomains } from "../../lib/branding";

type Tx = Prisma.TransactionClient;

function cleanVariables(input: EmailVariables): EmailVariables {
  return Object.fromEntries(Object.entries(input).filter(([, value]) => value !== undefined));
}

/**
 * Brand variables for a user's stored signup family. Carried INSIDE the email
 * variables so queued deliveries re-render under the right brand inside the
 * dispatcher process (which has no request context). Users without a stored
 * brandDomain — everyone created before multi-branding — resolve to primary
 * and render exactly as before.
 */
function brandVariables(brandDomain: string | null | undefined): EmailVariables {
  const profile = brandProfileForDomain(brandDomain?.trim() || brandDomains()[0]);
  return cleanVariables({
    brandName: profile.name,
    brandSupport: profile.supportEmail,
    ...(profile.emailColor ? { brandColor: profile.emailColor } : {}),
    ...(profile.emailLogoUrl ? { brandLogoUrl: profile.emailLogoUrl } : {}),
    ...(profile.emailFrom ? { brandFrom: profile.emailFrom } : {}),
    ...(profile.emailReplyTo ? { brandReplyTo: profile.emailReplyTo } : {}),
  });
}

/** Brand-correct base origin for a user's action links (their family apex;
 *  the middleware routes trade-host paths onward per family). */
function userBrandOrigin(brandDomain: string | null | undefined): string {
  return brandApexOrigin(brandDomain?.trim() || brandDomains()[0]);
}

function configuredInteger(name: string, fallback: number, minimum: number, maximum: number): number {
  const parsed = Number(process.env[name]);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(maximum, Math.max(minimum, Math.floor(parsed)));
}

function dispatchIntervalMs(): number {
  return configuredInteger("EMAIL_DISPATCH_INTERVAL_MS", 15_000, 5_000, 15 * 60_000);
}

function maxAttempts(): number {
  return configuredInteger("EMAIL_MAX_ATTEMPTS", 5, 1, 20);
}

function processingTimeoutMs(): number {
  return configuredInteger("EMAIL_PROCESSING_TIMEOUT_MS", 120_000, 30_000, 60 * 60_000);
}

function retryDelayMs(attempts: number): number {
  return Math.min(60 * 60_000, 30_000 * 2 ** Math.max(0, attempts - 1));
}

export async function queueUserEmail(
  tx: Tx,
  input: { userId: string; template: EmailTemplateName; variables?: EmailVariables },
): Promise<void> {
  const user = await tx.user.findUnique({
    where: { id: input.userId },
    select: { email: true, name: true, brandDomain: true },
  });
  if (!user?.email) return;

  const variables = cleanVariables({
    name: user.name ?? "there",
    actionUrl: `${userBrandOrigin(user.brandDomain)}/account`,
    ...brandVariables(user.brandDomain),
    ...(input.variables ?? {}),
  });
  const rendered = renderEmail(input.template, variables);
  const providerConfigured = emailProviderConfigured();
  const skipReason = !emailDeliveryEnabled()
    ? "Email delivery is disabled (EMAIL_DELIVERY_ENABLED=false)."
    : "Email provider is not configured.";
  await tx.emailDelivery.create({
    data: {
      userId: input.userId,
      recipient: user.email,
      template: input.template,
      subject: rendered.subject,
      variables: variables as Prisma.InputJsonValue,
      status: providerConfigured ? "PENDING" : "SKIPPED",
      lastError: providerConfigured ? null : skipReason,
    },
  });
}

export async function sendImmediateEmail(input: {
  userId?: string;
  to: string;
  template: EmailTemplateName;
  variables?: EmailVariables;
  idempotencyKey?: string;
}): Promise<{ delivery: "sent" | "preview" | "not_configured"; previewUrl?: string }> {
  // Resolve the recipient's brand when we know the user (security emails do);
  // explicit caller variables win over the derived brand defaults.
  const brandDomain = input.userId
    ? (await prisma.user.findUnique({ where: { id: input.userId }, select: { brandDomain: true } }))?.brandDomain
    : null;
  const variables = cleanVariables({
    ...brandVariables(brandDomain),
    ...(input.variables ?? {}),
  });
  const rendered = renderEmail(input.template, variables);
  if (!emailProviderConfigured()) {
    if (developmentEmailPreviewEnabled() && typeof input.variables?.actionUrl === "string") {
      return { delivery: "preview", previewUrl: input.variables.actionUrl };
    }
    return { delivery: "not_configured" };
  }

  const result = await deliverRenderedEmail({
    to: input.to,
    rendered,
    idempotencyKey: input.idempotencyKey,
  });
  await prisma.emailDelivery.create({
    data: {
      userId: input.userId,
      recipient: input.to,
      template: input.template,
      subject: rendered.subject,
      variables: variables as Prisma.InputJsonValue,
      status: "SENT",
      attempts: 1,
      providerMessageId: result.providerMessageId,
      sentAt: new Date(),
    },
  });
  return { delivery: "sent" };
}

class EmailDispatcher {
  private timer: NodeJS.Timeout | null = null;
  private activeRun: Promise<void> | null = null;

  start(): void {
    if (this.timer || !emailProviderConfigured()) return;
    const interval = dispatchIntervalMs();
    this.timer = setInterval(() => {
      void this.runOnce().catch((error) => console.error("Email dispatcher pass failed", error));
    }, interval);
    this.timer.unref?.();
    void this.runOnce().catch((error) => console.error("Initial email dispatcher pass failed", error));
  }

  async stop(): Promise<void> {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    if (this.activeRun) await this.activeRun.catch(() => undefined);
  }

  runOnce(): Promise<void> {
    if (!emailProviderConfigured()) return Promise.resolve();
    if (this.activeRun) return this.activeRun;

    const run = this.dispatchOnce().finally(() => {
      if (this.activeRun === run) this.activeRun = null;
    });
    this.activeRun = run;
    return run;
  }

  private async dispatchOnce(): Promise<void> {
    const now = new Date();
    const staleBefore = new Date(now.getTime() - processingTimeoutMs());

    // A process may terminate after claiming a job but before updating it. Move
    // expired claims back into the retry lane so no notification is stuck in
    // PROCESSING forever. Provider idempotency uses the delivery id, so a
    // recovered retry cannot create duplicate sends at compliant adapters.
    await prisma.emailDelivery.updateMany({
      where: { status: "PROCESSING", updatedAt: { lt: staleBefore } },
      data: {
        status: "RETRY",
        nextAttemptAt: now,
        lastError: "Recovered an interrupted email delivery claim.",
      },
    });

    const jobs = await prisma.emailDelivery.findMany({
      where: {
        status: { in: ["PENDING", "RETRY"] },
        nextAttemptAt: { lte: now },
      },
      orderBy: { createdAt: "asc" },
      take: 10,
    });

    for (const job of jobs) {
      const claimed = await prisma.emailDelivery.updateMany({
        where: { id: job.id, status: job.status },
        data: { status: "PROCESSING", attempts: { increment: 1 } },
      });
      if (claimed.count !== 1) continue;

      const attempts = job.attempts + 1;
      try {
        const variables = job.variables as EmailVariables;
        const rendered = renderEmail(job.template as EmailTemplateName, variables);
        const sent = await deliverRenderedEmail({
          to: job.recipient,
          rendered,
          idempotencyKey: job.id,
        });
        await prisma.emailDelivery.update({
          where: { id: job.id },
          data: {
            status: "SENT",
            providerMessageId: sent.providerMessageId,
            sentAt: new Date(),
            lastError: null,
          },
        });
      } catch (error) {
        const terminal = attempts >= maxAttempts();
        await prisma.emailDelivery.update({
          where: { id: job.id },
          data: {
            status: terminal ? "FAILED" : "RETRY",
            lastError: error instanceof Error ? error.message.slice(0, 1_000) : "Unknown email error",
            nextAttemptAt: new Date(Date.now() + retryDelayMs(attempts)),
          },
        });
        // A terminally failed email is silent data loss otherwise — reset and
        // verification mails die in the DB with no operator signal. Surface it
        // in the audit trail and the admin service-health panel.
        if (terminal) {
          await prisma.$transaction((tx) =>
            appendAuditEvent(tx, {
              action: "EMAIL_DELIVERY_FAILED",
              entityType: "EmailDelivery",
              entityId: job.id,
              actorId: job.userId,
              metadata: {
                recipient: job.recipient,
                template: job.template,
                attempts,
                lastError: error instanceof Error ? error.message.slice(0, 200) : "Unknown error",
              },
            }),
          ).catch((auditError) =>
            console.error("Failed to audit terminal email failure", auditError),
          );
        }
      }
    }
  }
}

export const emailDispatcher = new EmailDispatcher();
