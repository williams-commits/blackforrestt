import nodemailer, { type Transporter } from "nodemailer";

/**
 * Email notification channel. SMTP-configured; disabled (no-op) until
 * SMTP_URL is set. Templates are plain-text-first (render reliably in every
 * client) with a minimal HTML wrapper.
 */

function transporter(): Transporter | null {
  const url = process.env.SMTP_URL;
  if (!url) return null;
  return nodemailer.createTransport(url);
}

export interface EmailPayload {
  to: string;
  subject: string;
  text: string;
}

export async function sendEmail(payload: EmailPayload): Promise<boolean> {
  const transport = transporter();
  if (!transport) {
    return false; // email channel not configured — silently skip
  }
  const from = process.env.SMTP_FROM ?? "CRM <noreply@localhost>";
  try {
    await transport.sendMail({
      from,
      to: payload.to,
      subject: payload.subject,
      text: payload.text,
      html: `<pre style="font-family:inherit;white-space:pre-wrap">${payload.text
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")}</pre>`,
    });
    return true;
  } catch (error) {
    console.error("[crm/email] send failed", error);
    return false;
  }
}

export function emailConfigured(): boolean {
  return Boolean(process.env.SMTP_URL);
}
