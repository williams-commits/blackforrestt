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
  cc?: string;
  bcc?: string;
  subject: string;
  text: string;
}

/**
 * Per-user SMTP override: when a user has admin-managed SMTP credentials,
 * their outbound email goes through THEIR mail server with THEIR identity
 * instead of the global SMTP_URL transport.
 */
export interface SmtpTransportConfig {
  host: string;
  port: number;
  secure: boolean;
  username: string;
  password: string;
  /** "Name <addr>" or bare address — used as the From header. */
  from: string;
}

export function createTransportFrom(config: SmtpTransportConfig): Transporter {
  return nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: { user: config.username, pass: config.password },
  });
}

export async function verifyTransport(config: SmtpTransportConfig): Promise<{ ok: boolean; error?: string }> {
  try {
    const transport = createTransportFrom(config);
    await transport.verify();
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Connection failed." };
  }
}

export async function sendEmail(payload: EmailPayload, smtp?: SmtpTransportConfig): Promise<boolean> {
  const transport = smtp ? createTransportFrom(smtp) : transporter();
  if (!transport) {
    return false; // email channel not configured — silently skip
  }
  const from = smtp?.from ?? process.env.SMTP_FROM ?? "CRM <noreply@localhost>";
  try {
    await transport.sendMail({
      from,
      to: payload.to,
      ...(payload.cc ? { cc: payload.cc } : {}),
      ...(payload.bcc ? { bcc: payload.bcc } : {}),
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
