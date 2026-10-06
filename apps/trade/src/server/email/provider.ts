import { randomUUID } from "node:crypto";
import type { RenderedEmail } from "./templates";

export type EmailProviderMode = "resend" | "http" | "disabled";

/**
 * Master kill-switch for ALL outbound email. Set EMAIL_DELIVERY_ENABLED=false
 * in .env / .env.production to stop every delivery path — queued outbox emails,
 * immediate sends, and security emails (verification / password reset) are
 * recorded as SKIPPED / not_configured instead of sent, and the dispatcher
 * never starts. Default: true.
 */
export function emailDeliveryEnabled(): boolean {
  return (process.env.EMAIL_DELIVERY_ENABLED ?? "true").trim().toLowerCase() !== "false";
}

export function emailProviderMode(): EmailProviderMode {
  // The delivery switch overrides any provider configuration.
  if (!emailDeliveryEnabled()) return "disabled";
  const configured = (process.env.EMAIL_PROVIDER ?? (process.env.RESEND_API_KEY ? "resend" : process.env.EMAIL_API_URL ? "http" : "disabled")).toLowerCase();
  return configured === "resend" || configured === "http" ? configured : "disabled";
}
export function emailProviderConfigured(): boolean {
  const mode = emailProviderMode();
  if (mode === "resend") return Boolean(process.env.RESEND_API_KEY?.trim() && process.env.EMAIL_FROM?.trim());
  if (mode === "http") return Boolean(process.env.EMAIL_API_URL?.trim() && process.env.EMAIL_API_TOKEN?.trim());
  return false;
}

export async function deliverRenderedEmail(input: { to: string; rendered: RenderedEmail; idempotencyKey?: string }): Promise<{ providerMessageId: string }> {
  // Hard invariant: the master switch is re-checked at the single network
  // exit point — no caller can reach Resend/HTTP when delivery is disabled,
  // regardless of upstream guards or provider configuration.
  if (!emailDeliveryEnabled()) {
    throw new Error("Email delivery is disabled (EMAIL_DELIVERY_ENABLED=false).");
  }
  const mode = emailProviderMode();
  const idempotencyKey = input.idempotencyKey ?? randomUUID();
  // Per-brand sender overrides (multi-brand families) with the global env
  // fallbacks — a family without an emailFrom override sends as the primary.
  const from = input.rendered.from?.trim() || process.env.EMAIL_FROM?.trim();
  const replyTo = input.rendered.replyTo?.trim() || process.env.EMAIL_REPLY_TO?.trim();
  if (mode === "resend") {
    const token = process.env.RESEND_API_KEY?.trim();
    if (!token || !from) throw new Error("RESEND_API_KEY and EMAIL_FROM are required.");
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        "Idempotency-Key": idempotencyKey,
        "User-Agent": "blckforest-email/1.0",
      },
      body: JSON.stringify({
        from,
        to: [input.to],
        subject: input.rendered.subject,
        html: input.rendered.html,
        text: input.rendered.text,
        ...(replyTo ? { reply_to: replyTo } : {}),
      }),
      signal: AbortSignal.timeout(12_000),
    });
    const data = await response.json().catch(() => null) as { id?: string; message?: string } | null;
    if (!response.ok || !data?.id) throw new Error(data?.message ?? `Resend rejected delivery with status ${response.status}.`);
    return { providerMessageId: data.id };
  }
  if (mode === "http") {
    const endpoint = process.env.EMAIL_API_URL?.trim();
    const token = process.env.EMAIL_API_TOKEN?.trim();
    if (!endpoint || !token) throw new Error("EMAIL_API_URL and EMAIL_API_TOKEN are required.");
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", "Idempotency-Key": idempotencyKey },
      body: JSON.stringify({ to: input.to, from, replyTo, subject: input.rendered.subject, html: input.rendered.html, text: input.rendered.text }),
      signal: AbortSignal.timeout(12_000),
    });
    const data = await response.json().catch(() => null) as { id?: string } | null;
    if (!response.ok) throw new Error(`Email adapter rejected delivery with status ${response.status}.`);
    return { providerMessageId: data?.id ?? idempotencyKey };
  }
  throw new Error("Email delivery provider is not configured.");
}
