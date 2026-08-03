import assert from "node:assert/strict";
import test from "node:test";
import {
  canReviewChangeDomain,
  hasAdminPermission,
  permissionsForRoles,
} from "../src/server/adminPolicy.js";
import { redactAuditValue } from "../src/server/auditRedaction.js";
import {
  isExecutableQuote,
  MAX_EXECUTABLE_QUOTE_AGE_MS,
} from "../src/lib/marketFreshness.js";

test("seven-role policy enforces least privilege", () => {
  const compliance = permissionsForRoles(["COMPLIANCE"]);
  assert.ok(compliance.includes("KYC_DECIDE"));
  assert.ok(!compliance.includes("PAYMENT_APPROVE"));
  assert.ok(!compliance.includes("INSTRUMENT_MANAGE"));

  const finance = permissionsForRoles(["FINANCE"]);
  assert.ok(finance.includes("PAYMENT_PREPARE"));
  assert.ok(finance.includes("PAYMENT_APPROVE"));
  assert.ok(finance.includes("USER_BALANCE_ADJUST"));
  assert.ok(!finance.includes("KYC_DECIDE"));

  const dealer = permissionsForRoles(["DEALER"]);
  assert.ok(dealer.includes("EXECUTION_MANAGE"));
  assert.ok(dealer.includes("INSTRUMENT_MANAGE"));
  assert.ok(!dealer.includes("USER_ACCESS_MANAGE"));

  const auditor = permissionsForRoles(["AUDITOR"]);
  assert.ok(auditor.includes("AUDIT_VERIFY"));
  assert.ok(!auditor.includes("SUPPORT_MANAGE"));
  assert.ok(!auditor.includes("PAYMENT_APPROVE"));
  assert.ok(!auditor.includes("USER_BALANCE_ADJUST"));

  assert.equal(hasAdminPermission({ permissions: permissionsForRoles(["SUPER_ADMIN"]) }, "CONFIG_MANAGE"), true);
});

test("maker-checker review authority is domain constrained", () => {
  assert.equal(canReviewChangeDomain({ roles: ["SUPER_ADMIN"] }, "ACCESS"), true);
  assert.equal(canReviewChangeDomain({ roles: ["RISK"] }, "RISK"), true);
  assert.equal(canReviewChangeDomain({ roles: ["RISK"] }, "INSTRUMENT"), true);
  assert.equal(canReviewChangeDomain({ roles: ["RISK"] }, "ACCESS"), false);
  assert.equal(canReviewChangeDomain({ roles: ["DEALER"] }, "INSTRUMENT"), false);
});

test("audit exports recursively redact sensitive fields", () => {
  const redacted = redactAuditValue({
    email: "client@example.invalid",
    password: "not-exportable",
    nested: {
      beneficiaryEncrypted: "ciphertext",
      sha256: "1234567890abcdef1234567890abcdef",
      note: "operational context",
    },
  }) as Record<string, unknown>;
  assert.equal(redacted.password, "[REDACTED]");
  const nested = redacted.nested as Record<string, unknown>;
  assert.equal(nested.beneficiaryEncrypted, "[REDACTED]");
  assert.equal(nested.note, "operational context");
  assert.notEqual(nested.sha256, "1234567890abcdef1234567890abcdef");
});

test("quote freshness blocks missing, mismatched, and stale execution data", () => {
  const now = Date.now();
  const quote = {
    symbol: "EURUSD",
    bid: 1.1,
    ask: 1.1002,
    mid: 1.1001,
    time: now,
    open24h: 1.09,
    high24h: 1.11,
    low24h: 1.08,
    changePct: 0.1,
  };
  assert.equal(isExecutableQuote(quote, "EURUSD", now), true);
  assert.equal(isExecutableQuote(quote, "GBPUSD", now), false);
  assert.equal(isExecutableQuote({ ...quote, time: now - MAX_EXECUTABLE_QUOTE_AGE_MS - 1 }, "EURUSD", now), false);
  assert.equal(isExecutableQuote(null, "EURUSD", now), false);
});
