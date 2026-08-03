#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(process.argv[2] ?? ".");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const checks = [];
const check = (name, condition, detail) => checks.push({ name, passed: Boolean(condition), ...(condition ? {} : { detail }) });

const wallet = read("src/components/account/WalletModal.tsx");
const paymentMethods = read("src/server/paymentMethodDetails.ts");
const payments = read("src/server/payments.ts");
const middleware = read("src/middleware.ts");
const schema = read("prisma/schema.prisma");
const env = read(".env.example");
const envDocs = read("ENVIRONMENT_VARIABLES.md");
const emailDocs = read("EMAIL_SETUP.md");
const templates = read("src/server/email/templates.ts");
const provider = read("src/server/email/provider.ts");
const service = read("src/server/email/service.ts");
const deposit = read("src/app/api/wallet/deposit/route.ts");
const withdraw = read("src/app/api/wallet/withdraw/route.ts");

check("deposit card, bank and crypto UI", ["CARD", "BANK_TRANSFER", "CRYPTO", "Payment proof (required)"].every((value) => wallet.includes(value)), "Wallet modal is missing a deposit method or proof input.");
check("withdrawal method-specific fields", ["Original verified card deposit reference", "Account number or IBAN", "Destination wallet address"].every((value) => wallet.includes(value)), "Withdrawal methods still share one bank-only contract.");
check("full card data is not collected", !/name="cardNumber"|name="cvv"|name="cvc"|placeholder="Full card/i.test(wallet), "A PCI-sensitive card field appears in the wallet form.");
check("method detail encryption", paymentMethods.includes("encryptSensitiveString") && deposit.includes("methodDetailsEncrypted") && withdraw.includes("beneficiaryEncrypted"), "Payment method details are not encrypted at rest.");
check("deposit proof orchestration", wallet.includes("uploadProof(data.paymentRequest") && wallet.includes("Scanning and sealing"), "Deposit request and proof upload are not one guided flow.");
check("withdrawal supporting upload", !payments.includes("Only deposit requests accept customer payment proofs"), "Withdrawal supporting documents remain blocked.");
check("payment method migration", schema.includes("methodDetailsEncrypted") && fs.existsSync(path.join(root, "prisma/migrations/20260728120000_payment_methods_email_outbox/migration.sql")), "Payment method schema/migration is missing.");
check("email template catalog", ["verify-email", "password-reset", "payment-approved", "kyc-rejected", "generic-notification"].every((value) => templates.includes(`\"${value}\"`)), "Required email templates are missing.");
check("resend and http providers", provider.includes('mode === "resend"') && provider.includes('mode === "http"') && provider.includes("https://api.resend.com/emails"), "Email providers are incomplete.");
check("transactional email outbox", schema.includes("model EmailDelivery") && service.includes("class EmailDispatcher") && service.includes('"RETRY"'), "Email outbox/retry flow is missing.");
check("email setup documentation", emailDocs.includes("Activate production email with Resend") && emailDocs.includes("npm run email:preview"), "Email activation/design documentation is incomplete.");
check("email variables documented", ["EMAIL_PROVIDER", "RESEND_API_KEY", "EMAIL_FROM", "EMAIL_BRAND_COLOR", "EMAIL_MAX_ATTEMPTS"].every((value) => env.includes(value) && envDocs.includes(value)), "Email environment variables are not fully documented.");
check("authenticated guest-route redirect", middleware.includes('pathname === "/login"') && middleware.includes('pathname === "/register"') && middleware.includes('accountUrl.pathname = "/account"'), "Authenticated login/register redirect is missing.");
check("registration email activation enabled", env.includes('REGISTRATION_REQUIRE_EMAIL_VERIFICATION="true"'), "Email verification is not enabled in the example environment.");
check("card refund matches approved deposit", withdraw.includes('status: "APPROVED"') && withdraw.includes('userReference: originalDepositReference') && withdraw.includes('CARD_REFUND_REFERENCE_REQUIRED'), "Card withdrawals can be submitted without a matching approved card deposit.");
check("browser MIME compatibility", payments.includes('"image/jpg": "image/jpeg"') && payments.includes('"application/octet-stream"') && payments.includes("detectMime(bytes)"), "Payment proof MIME normalization is incomplete.");
check("security email idempotency", read("src/server/security/tokens.ts").includes("idempotencyKey") && read("src/app/api/security/email-verification/request/route.ts").includes("security-token-${issued.record.id}"), "Security email retries are not idempotent.");
check("authenticated redirect browser coverage", read("e2e/tests/customer.spec.ts").includes("authenticated users cannot return to login or registration"), "Authenticated login/register redirects lack browser coverage.");

const failures = checks.filter((item) => !item.passed);
console.log(JSON.stringify({ kind: "payment_email_patch_source_verification", passed: failures.length === 0, checks }, null, 2));
if (failures.length) process.exit(1);
