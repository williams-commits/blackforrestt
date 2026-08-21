const failures = [];
const warnings = [];
const value = (name) => (process.env[name] ?? "").trim();
const isTrue = (name) => value(name).toLowerCase() === "true";

if (process.env.NODE_ENV !== "production") failures.push("NODE_ENV must be production.");
for (const name of ["DEV_EMAIL_PREVIEW", "ALLOW_UNVERIFIED_WITHDRAWALS"]) {
  if (isTrue(name)) failures.push(`${name} must be false in production.`);
}
for (const name of ["DATABASE_URL", "REDIS_URL", "AUTH_SECRET", "FIELD_ENCRYPTION_KEY", "SECURITY_HASH_PEPPER", "APP_ORIGIN", "AUTH_URL"]) {
  if (!value(name)) failures.push(`${name} is required.`);
}
for (const name of ["AUTH_SECRET", "FIELD_ENCRYPTION_KEY", "SECURITY_HASH_PEPPER"]) {
  if (/change-me|replace-with|example/i.test(value(name))) failures.push(`${name} still contains a placeholder.`);
}
if (value("AUTH_URL") && !value("AUTH_URL").startsWith("https://")) warnings.push("AUTH_URL is not HTTPS.");
if (value("REGISTRATION_REQUIRE_EMAIL_VERIFICATION").toLowerCase() !== "true") {
  // Deliberate product decision: frictionless signup without email
  // verification. Accounts are auto-verified at creation. Kept as a warning so
  // operators consciously choose this posture (unverified emails weaken
  // password-reset delivery guarantees and abuse resistance).
  warnings.push("REGISTRATION_REQUIRE_EMAIL_VERIFICATION is not 'true': accounts register without email verification.");
}
const emailDeliveryEnabled = value("EMAIL_DELIVERY_ENABLED").toLowerCase() !== "false";
const emailProvider = value("EMAIL_PROVIDER").toLowerCase();
if (!emailDeliveryEnabled) {
  // Deliberate kill-switch: no outbound email at all. Provider configuration
  // becomes irrelevant; the app records SKIPPED rows instead of sending.
  warnings.push("EMAIL_DELIVERY_ENABLED=false: ALL outbound email is disabled (verification, password reset, notifications).");
} else {
  if (!new Set(["resend", "http"]).has(emailProvider)) failures.push("EMAIL_PROVIDER must be resend or http in production.");
  if (emailProvider === "resend" && (!value("RESEND_API_KEY") || !value("EMAIL_FROM"))) failures.push("RESEND_API_KEY and EMAIL_FROM are required for EMAIL_PROVIDER=resend.");
  if (emailProvider === "http" && (!value("EMAIL_API_URL") || !value("EMAIL_API_TOKEN") || !value("EMAIL_FROM"))) failures.push("EMAIL_API_URL, EMAIL_API_TOKEN and EMAIL_FROM are required for EMAIL_PROVIDER=http.");
}
const scanner = (value("KYC_SCANNER") || "stub").toLowerCase();
let loopbackOrigin = false;
try {
  loopbackOrigin = new Set(["localhost", "127.0.0.1", "::1"]).has(new URL(value("APP_ORIGIN")).hostname);
} catch {
  // APP_ORIGIN is already required above; malformed values fail elsewhere at runtime.
}
const localStubScanner = scanner === "stub" && isTrue("ALLOW_LOCAL_STUB_SCANNER") && loopbackOrigin;
if (scanner !== "http" && !localStubScanner) failures.push("KYC_SCANNER must be http in production; the stub scanner is allowed only for an explicitly configured loopback Docker demo.");
if (localStubScanner) warnings.push("The local Docker demo is using the deterministic stub malware scanner.");
if (scanner === "http" && !value("MALWARE_SCANNER_URL")) failures.push("MALWARE_SCANNER_URL is required for KYC_SCANNER=http.");

for (const warning of warnings) console.warn(`Production preflight warning: ${warning}`);
if (failures.length) {
  for (const failure of failures) console.error(`Production preflight failure: ${failure}`);
  process.exit(1);
}
console.log("Production preflight passed. Development bypasses are disabled.");
