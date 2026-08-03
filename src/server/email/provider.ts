import { randomUUID } from "node:crypto";
import type { RenderedEmail } from "./templates";

export type EmailProviderMode = "resend" | "http" | "disabled";
export function emailProviderMode(): EmailProviderMode {
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
  const mode = emailProviderMode();
  const idempotencyKey = input.idempotencyKey ?? randomUUID();
  if (mode === "resend") {
    const token = process.env.RESEND_API_KEY?.trim();
    const from = process.env.EMAIL_FROM?.trim();
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
        ...(process.env.EMAIL_REPLY_TO?.trim() ? { reply_to: process.env.EMAIL_REPLY_TO.trim() } : {}),
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
      body: JSON.stringify({ to: input.to, from: process.env.EMAIL_FROM, replyTo: process.env.EMAIL_REPLY_TO, ...input.rendered }),
      signal: AbortSignal.timeout(12_000),
    });
    const data = await response.json().catch(() => null) as { id?: string } | null;
    if (!response.ok) throw new Error(`Email adapter rejected delivery with status ${response.status}.`);
    return { providerMessageId: data?.id ?? idempotencyKey };
  }
  throw new Error("Email delivery provider is not configured.");
}
