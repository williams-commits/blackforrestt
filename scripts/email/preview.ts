import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { renderEmail, type EmailTemplateName } from "../../src/server/email/templates.js";

const output = resolve(process.cwd(), "email-previews");
await mkdir(output, { recursive: true });
const templates: EmailTemplateName[] = [
  "verify-email", "password-reset", "welcome", "email-verified", "security-alert",
  "payment-created", "payment-proof-received", "payment-review", "payment-approved",
  "payment-rejected", "payment-cancelled", "payment-reversed", "kyc-submitted",
  "kyc-approved", "kyc-rejected", "generic-notification",
];
const sample = {
  name: "Alex Morgan",
  actionUrl: "https://trade.example.com/account",
  expiresAt: new Date(Date.now() + 86_400_000).toISOString(),
  amount: "1,250.00",
  asset: "USD",
  method: "Bank transfer",
  paymentType: "Deposit",
  reference: "PAY-EXAMPLE-001",
  reason: "The submitted payment reference did not match the bank statement.",
  title: "Account notification",
  message: "This preview demonstrates the shared email theme and layout.",
};
const links: string[] = [];
for (const template of templates) {
  const rendered = renderEmail(template, sample);
  const filename = `${template}.html`;
  await writeFile(resolve(output, filename), rendered.html, "utf8");
  links.push(`<li><a href="${filename}">${template}</a> — ${rendered.subject}</li>`);
}
await writeFile(resolve(output, "index.html"), `<!doctype html><html><body><h1>Email previews</h1><ul>${links.join("")}</ul></body></html>`, "utf8");
console.log(`Generated ${templates.length} email previews in ${output}`);
