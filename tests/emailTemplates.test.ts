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

test("brand variables restyle the email without touching env config", () => {
  const rendered = renderEmail("welcome", {
    name: "Agile User",
    actionUrl: "https://agilefgs.com/account",
    brandName: "Agile FGS",
    brandSupport: "support@agilefgs.com",
    brandColor: "#0ea5e9",
    brandFrom: "no-reply@agilefgs.com",
    brandReplyTo: "help@agilefgs.com",
  });
  // Header, footer support address, subject, and button accent all follow the
  // brand variables; the from/replyTo ride along for the provider layer.
  assert.match(rendered.subject, /Welcome to Agile FGS/);
  assert.match(rendered.html, /Agile FGS/);
  assert.match(rendered.html, /support@agilefgs\.com/);
  assert.match(rendered.html, /background:#0ea5e9/);
  assert.match(rendered.html, /border-bottom:4px solid #0ea5e9/);
  assert.equal(rendered.from, "no-reply@agilefgs.com");
  assert.equal(rendered.replyTo, "help@agilefgs.com");
});

test("emails without brand variables keep the primary env identity", () => {
  const rendered = renderEmail("generic-notification", { name: "Plain", message: "Hello" });
  assert.equal(rendered.from, undefined);
  assert.equal(rendered.replyTo, undefined);
  assert.match(rendered.html, new RegExp(process.env.EMAIL_BRAND_NAME || "Black Forest"));
});
