# Multi-Brand Security Tradeoffs

Black Forest and Agile FGS (and any future brand family) run on **one shared
deployment**: one app process, one PostgreSQL database, one Redis, one MinIO,
one set of signing keys. This document details the security properties that
follow from that architecture — what is isolated, what is shared, and what the
accepted tradeoffs are. Read it before deciding to add brands or split them.

Status: **accepted as-is** (2026-08). Revisit if brands must become
regulatorily or legally isolated.

---

## What IS isolated per brand (verified)

- **Login sessions / cookies.** Auth.js cookies are host-only (no `Domain`
  attribute), so a session on `trade.agilefgs.com` never touches
  `trade.blackforrestt.com`. Two brands can be logged in simultaneously in
  one browser without interference.
- **Branding surface.** Theme, logo, favicon, manifest, hero copy, emails,
  deposit wallets, referral links, and SEO are resolved per host / per user
  brand family (see `MULTI_DOMAIN_SETUP.md`).
- **Locale and theme cookies.** Scoped per requesting host family.

## What is shared (by design)

One user pool (email is globally unique — one account works on every brand),
one admin pool and admin console, one ledger per user, one document store,
one market engine, one deployment (blast radius), one signing secret, one
rate-limit namespace.

---

## Tradeoff #10 — One `AUTH_SECRET` signs every brand's session tokens

**Mechanics.** Auth.js signs each session token with `AUTH_SECRET`. Both
brands verify tokens with the same key, so a token minted on `trade.agilefgs.com`
is cryptographically valid on `trade.blackforrestt.com` if it is presented
there.

**Why it's tolerable.** Browsers cannot do this accidentally — cookies are
host-scoped, so the token is simply never sent cross-host in normal operation.
Abuse requires an attacker to first **steal** a token (XSS, malware, network
capture of a non-HTTPS request) and then deliberately replay it against the
other brand. HTTPS + the strict CSP in `next.config.ts` are the actual
defenses; the shared key only removes one layer of separation *after* a
compromise has already occurred.

**Risk scenario.** Malware on a customer's machine exfiltrates their Agile
session token; the attacker uses it on `trade.blackforrestt.com` to act as
the same user. Note the attacker gains nothing brand-specific — the account,
balances, and data are the same shared account either way.

**Mitigations.**
- Rotating `AUTH_SECRET` invalidates every token on every brand at once (a
  full logout) — do this on any suspicion of theft.
- Session revocation is likewise global (see #12), so a password reset kills
  the stolen token regardless of which host it was minted on.
- Full fix, if ever required: separate deployments (or separate Auth.js
  cookie names/secrets) per brand. Auth.js v5 does not support per-host
  secrets in a single instance; this means splitting the deployment — see
  "Full isolation path" below.

## Tradeoff #11 — Brute-force protection is shared per email + IP

**Mechanics.** Login throttling (`src/server/security/loginThrottle.ts`)
counts attempts in Redis keyed by hashed email and hashed network address —
with no brand dimension. Repeated failures on one brand raise the same
counters the other brand checks.

**Why it's tolerable.** The victim of the throttling and the target of the
attack are the same identity — one account, one password. An attacker
hammering the Agile login is attacking *the account*, and being slowed on
both storefronts is the protection working, not failing.

**Risk scenario (DoS angle).** An attacker who knows a victim's email can
deliberately fail logins on brand A to lock the victim out of brand B too.
Impact is limited: the lockout is temporary and the victim can still reset
their password (which clears the counters).

**Mitigations.** If cross-brand lockout ever becomes a support burden, add
the requesting host to the throttle key (one line in `consumeLoginAttempt`'s
callers). That weakens protection slightly (attackers get one budget per
brand), so it is only worth doing with evidence of real abuse.

## Tradeoff #12 — Password change / reset signs the user out on every brand

**Mechanics.** Password changes and resets revoke **all** of a user's
security sessions regardless of which host they were created on (one session
pool per user, shared across brands).

**Why it's correct.** One account = one credential. If a password is
compromised, every session created with it — on any storefront — must die.
Splitting revocation per brand would leave stolen sessions alive on the
other brand after a reset, which is the worse failure.

**UX note.** A user active on both brands will be logged out of the other
brand "spontaneously" after changing their password. Expected; explain in
support responses, not code.

---

## Related shared-surface notes

- **One account across brands (identity model).** An email registers once;
  registering the same email on a second brand returns "already exists", and
  logging in on any brand yields the same account wearing that brand's
  chrome. This is a deliberate product decision (deferred 2026-08). Splitting
  identity per brand requires per-brand user tables — a deployment split.
- **One admin pool.** Any admin can administer every brand's customers. The
  admin UI tags users, chat threads, and support cases with brand chips, but
  there is no brand-based admin permission yet.
- **One document store.** KYC/payment documents for all brands live in the
  same MinIO buckets under the same prefix. Functionally correct; relevant
  only if data-residency or per-brand retention rules ever apply.
- **Single deployment blast radius.** One bad release affects every brand at
  once. Brand-level canaries are not possible without deployment splits.

## Full isolation path (if ever required)

If a brand ever needs to be cryptographically or regulatorily independent:

1. Stand up a second deployment (own app + Postgres + Redis + MinIO + secrets)
   pointing at its own domain set.
2. Keep the shared nothing: separate `AUTH_SECRET`, separate databases.
3. The current codebase needs no changes to run twice — all brand behavior is
   env-driven (`BRAND_DOMAIN`/`BRAND_DOMAINS`/`BRAND_OVERRIDES`, see
   `MULTI_DOMAIN_SETUP.md`); a single-brand deployment is the degenerate case
   of the same config.

## Monitoring hints

- `auditEvent` rows (`action = "LOGIN_THROTTLED"` or similar security events)
  include email/network hashes — cross-brand attack patterns are visible in
  one place, which is a side benefit of the shared namespace.
- Session issuance/revocation events are audit-chained per user regardless of
  host — grep `SESSIONS_REVOKED` to see the global revocation behavior of #12.
