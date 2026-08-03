export type EmailTemplateName =
  | "verify-email"
  | "password-reset"
  | "welcome"
  | "email-verified"
  | "security-alert"
  | "payment-created"
  | "payment-proof-received"
  | "payment-review"
  | "payment-approved"
  | "payment-rejected"
  | "payment-cancelled"
  | "payment-reversed"
  | "kyc-submitted"
  | "kyc-approved"
  | "kyc-rejected"
  | "generic-notification";

export interface RenderedEmail { subject: string; html: string; text: string }
export type EmailVariables = Record<string, string | number | boolean | null | undefined>;

function escapeHtml(value: unknown): string {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[character] ?? character);
}
function value(vars: EmailVariables, key: string, fallback = ""): string { return String(vars[key] ?? fallback); }
function button(label: string, url: string): string {
  return `<a href="${escapeHtml(url)}" style="display:inline-block;background:#fd7e14;color:#fff;text-decoration:none;padding:12px 18px;border-radius:7px;font-weight:700">${escapeHtml(label)}</a>`;
}
function layout(title: string, preview: string, content: string): string {
  const brand = escapeHtml(process.env.EMAIL_BRAND_NAME ?? "Black Forest");
  const logoUrl = process.env.EMAIL_LOGO_URL?.trim();
  const support = escapeHtml(process.env.EMAIL_SUPPORT_ADDRESS ?? "support@example.com");
  const accent = escapeHtml(process.env.EMAIL_BRAND_COLOR ?? "#fd7e14");
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${escapeHtml(title)}</title></head><body style="margin:0;background:#f3f4f6;font-family:Arial,sans-serif;color:#111827"><div style="display:none;max-height:0;overflow:hidden">${escapeHtml(preview)}</div><table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td align="center" style="padding:28px 12px"><table role="presentation" width="100%" style="max-width:620px;background:#fff;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden"><tr><td style="padding:22px 28px;border-bottom:4px solid ${accent}">${logoUrl ? `<img src="${escapeHtml(logoUrl)}" alt="${brand}" style="max-height:38px;max-width:180px">` : `<strong style="font-size:20px">${brand}</strong>`}</td></tr><tr><td style="padding:30px 28px"><h1 style="font-size:24px;margin:0 0 16px">${escapeHtml(title)}</h1>${content}</td></tr><tr><td style="padding:20px 28px;background:#f9fafb;color:#6b7280;font-size:12px;line-height:1.6">This is an automated account notification from ${brand}. Need help? Contact ${support}.</td></tr></table></td></tr></table></body></html>`;
}

export function renderEmail(template: EmailTemplateName, vars: EmailVariables): RenderedEmail {
  const name = value(vars, "name", "there");
  const actionUrl = value(vars, "actionUrl");
  const amount = value(vars, "amount");
  const asset = value(vars, "asset", "USD");
  const method = value(vars, "method");
  const reference = value(vars, "reference");
  let subject = "Account notification";
  let title = subject;
  let body = `<p style="line-height:1.7">Hello ${escapeHtml(name)},</p>`;
  let text = `Hello ${name},\n\n`;

  switch (template) {
    case "verify-email":
      subject = title = "Activate your email address";
      body += `<p style="line-height:1.7">Confirm this email address to activate your account.</p><p>${button("Verify email", actionUrl)}</p><p style="color:#6b7280;font-size:13px">This link expires ${escapeHtml(value(vars, "expiresAt"))}.</p>`;
      text += `Confirm your email: ${actionUrl}\nThis link expires ${value(vars, "expiresAt")}.`;
      break;
    case "password-reset":
      subject = title = "Reset your password";
      body += `<p style="line-height:1.7">A password reset was requested for your account.</p><p>${button("Reset password", actionUrl)}</p><p style="color:#6b7280;font-size:13px">Ignore this message if you did not make the request.</p>`;
      text += `Reset your password: ${actionUrl}\nIgnore this message if you did not request it.`;
      break;
    case "welcome":
      subject = title = "Welcome to Black Forest";
      body += `<p style="line-height:1.7">Your account has been created. Review your account dashboard and complete the security and verification checklist.</p>${actionUrl ? `<p>${button("Open account", actionUrl)}</p>` : ""}`;
      text += `Your account has been created.${actionUrl ? ` Open it: ${actionUrl}` : ""}`;
      break;
    case "email-verified":
      subject = title = "Email activated";
      body += `<p style="line-height:1.7">Your email address is now verified.</p>${actionUrl ? `<p>${button("Open account", actionUrl)}</p>` : ""}`;
      text += `Your email address is now verified.${actionUrl ? ` Open account: ${actionUrl}` : ""}`;
      break;
    case "payment-created":
      subject = title = `${value(vars, "paymentType", "Payment")} request received`;
      body += `<p style="line-height:1.7">We received your request for <strong>${escapeHtml(asset)} ${escapeHtml(amount)}</strong> via ${escapeHtml(method)}.</p>${reference ? `<p>Reference: <strong>${escapeHtml(reference)}</strong></p>` : ""}${actionUrl ? `<p>${button("View payment", actionUrl)}</p>` : ""}`;
      text += `We received your ${value(vars, "paymentType", "payment")} request for ${asset} ${amount} via ${method}.${reference ? ` Reference: ${reference}.` : ""}`;
      break;
    case "payment-proof-received":
      subject = title = "Payment proof received";
      body += `<p style="line-height:1.7">Your payment proof was uploaded and passed the configured validation workflow.</p>${actionUrl ? `<p>${button("View payment", actionUrl)}</p>` : ""}`;
      text += "Your payment proof was received and validated.";
      break;
    case "payment-review":
      subject = title = "Payment under review";
      body += `<p style="line-height:1.7">Your payment request has passed initial review and is awaiting approval.</p>`;
      text += "Your payment request is under finance review.";
      break;
    case "payment-approved":
      subject = title = "Payment approved";
      body += `<p style="line-height:1.7">Your ${escapeHtml(value(vars, "paymentType", "payment").toLowerCase())} for <strong>${escapeHtml(asset)} ${escapeHtml(amount)}</strong> was approved.</p>`;
      text += `Your payment for ${asset} ${amount} was approved.`;
      break;
    case "payment-rejected":
      subject = title = "Payment rejected";
      body += `<p style="line-height:1.7">Your payment request was rejected.</p><p>Reason: ${escapeHtml(value(vars, "reason", "Contact support for details."))}</p>`;
      text += `Your payment request was rejected. Reason: ${value(vars, "reason", "Contact support for details.")}`;
      break;
    case "payment-cancelled":
      subject = title = "Payment request cancelled";
      body += `<p style="line-height:1.7">Your payment request was cancelled before settlement.</p>`;
      text += "Your payment request was cancelled before settlement.";
      break;
    case "payment-reversed":
      subject = title = "Payment reversed";
      body += `<p style="line-height:1.7">A settled payment was reversed and the corresponding ledger correction was recorded.</p>`;
      text += "A settled payment was reversed and a ledger correction was recorded.";
      break;
    case "kyc-submitted": case "kyc-approved": case "kyc-rejected":
      subject = title = template === "kyc-submitted" ? "Verification submitted" : template === "kyc-approved" ? "Verification approved" : "Verification needs attention";
      body += `<p style="line-height:1.7">${escapeHtml(value(vars, "message", title))}</p>${actionUrl ? `<p>${button("View verification", actionUrl)}</p>` : ""}`;
      text += value(vars, "message", title);
      break;
    case "security-alert":
      subject = title = value(vars, "title", "Security alert");
      body += `<p style="line-height:1.7">${escapeHtml(value(vars, "message"))}</p>`;
      text += value(vars, "message");
      break;
    default:
      subject = title = value(vars, "title", "Account notification");
      body += `<p style="line-height:1.7">${escapeHtml(value(vars, "message"))}</p>${actionUrl ? `<p>${button("Open account", actionUrl)}</p>` : ""}`;
      text += value(vars, "message");
  }
  return { subject, html: layout(title, subject, body), text };
}
