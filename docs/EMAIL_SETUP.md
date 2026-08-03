# Transactional email activation and templates

The repository supports two delivery adapters without adding an email SDK dependency:

1. **Resend** — direct HTTPS delivery through the Resend Email API.
2. **HTTP adapter** — a private company endpoint that accepts rendered `subject`, `html`, and `text` payloads.

## Activate email locally

Local development can test activation without sending real email:

```env
REGISTRATION_REQUIRE_EMAIL_VERIFICATION="true"
DEV_EMAIL_PREVIEW="true"
EMAIL_PROVIDER="disabled"
```

Register a new account. The registration and resend-verification screens display a single-use development verification link. This preview behavior is impossible in production.

## Activate production email with Resend

1. Create and verify a sending domain in Resend.
2. Create a restricted API key.
3. Add these values to `.env.production`:

```env
REGISTRATION_REQUIRE_EMAIL_VERIFICATION="true"
DEV_EMAIL_PREVIEW="false"
EMAIL_PROVIDER="resend"
RESEND_API_KEY="re_replace_me"
EMAIL_FROM="Black Forest <notifications@your-domain.example>"
EMAIL_REPLY_TO="support@your-domain.example"
EMAIL_SUPPORT_ADDRESS="support@your-domain.example"
EMAIL_BRAND_NAME="Black Forest"
EMAIL_BRAND_COLOR="#16a34a"
EMAIL_LOGO_URL="https://your-domain.example/logo-email.png"
EMAIL_DISPATCH_INTERVAL_MS="15000"
EMAIL_MAX_ATTEMPTS="5"
EMAIL_PROCESSING_TIMEOUT_MS="120000"
```

Then run:

```bash
npm run db:generate
npm run db:deploy
npm run production:check
npm run start:production
```

The production preflight fails when registration email activation is enabled but the selected email provider is incomplete.

## Use a private HTTP email adapter

```env
EMAIL_PROVIDER="http"
EMAIL_API_URL="https://mailer.internal.example/v1/send"
EMAIL_API_TOKEN="replace-with-a-secret"
EMAIL_FROM="Black Forest <notifications@your-domain.example>"
```

The endpoint receives a JSON body containing `to`, `from`, `replyTo`, `subject`, `html`, and `text`, with `Authorization: Bearer <EMAIL_API_TOKEN>` and an `Idempotency-Key` header.

## Template design

Templates live in:

```text
src/server/email/templates.ts
```

The shared header, footer, typography, button, brand color, logo, and support address are controlled in one `layout()` function and by the `EMAIL_BRAND_*` variables. Individual templates only define their subject and content.

Generate browser-viewable previews after changing a template:

```bash
npm run email:preview
open email-previews/index.html
```

Templates included:

- Email verification and password reset
- Welcome and email-verified confirmation
- Security alerts
- Deposit/withdrawal created, proof received, under review, approved, rejected, cancelled, and reversed
- KYC submitted, approved, and rejected
- Generic account notifications

## Delivery reliability

Non-security notifications are written to the `EmailDelivery` outbox in the same database transaction as the in-app notification. The server dispatcher retries transient failures with exponential backoff and records provider IDs, attempts, terminal failures, and timestamps. Jobs left in `PROCESSING` after a process crash are reclaimed after `EMAIL_PROCESSING_TIMEOUT_MS`; provider idempotency uses the delivery ID to prevent duplicate sends. Verification and password-reset messages are sent immediately because the API must report whether delivery succeeded.
