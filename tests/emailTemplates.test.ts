import assert from "node:assert/strict";
import test from "node:test";
import { renderEmail, type EmailTemplateName } from "../src/server/email/templates.js";

const templates: EmailTemplateName[] = [
  "verify-email", "password-reset", "welcome", "email-verified", "security-alert",
  "payment-created", "payment-proof-received", "payment-review", "payment-approved",
  "payment-rejected", "payment-cancelled", "payment-reversed", "kyc-submitted",
  "kyc-approved", "kyc-rejected", "generic-notification",
];

test("all transactional email templates render HTML and text", () => {
  for (const template of templates) {
    const rendered = renderEmail(template, {
      name: "Taylor",
      actionUrl: "https://example.test/account?safe=1&next=2",
      expiresAt: new Date("2030-01-01T00:00:00.000Z").toISOString(),
      paymentType: "Deposit",
      amount: "125.50",
      asset: "USD",
      method: "Bank transfer",
      reference: "PAY-100",
      title: "Account notice",
      message: "A useful account message.",
      reason: "Supporting document did not match.",
    });
    assert.ok(rendered.subject.length > 2, template);
    assert.match(rendered.html, /<!doctype html>/i, template);
    assert.ok(rendered.text.length > 5, template);
  }
});

test("email variables are HTML escaped", () => {
  const rendered = renderEmail("generic-notification", {
    name: "<script>alert(1)</script>",
    title: "Security <notice>",
    message: "<img src=x onerror=alert(1)>",
  });
  assert.doesNotMatch(rendered.html, /<script>alert\(1\)<\/script>/);
  assert.doesNotMatch(rendered.html, /<img src=x/);
  assert.match(rendered.html, /&lt;img src=x/);
});
