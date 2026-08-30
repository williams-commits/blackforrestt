# Multi-Domain / Multi-Brand Setup

How this deployment serves several brand families (e.g. `blackforrestt.com`
and `agilefgs.com`) from one codebase, and the exact runbook for adding the
next one. Security properties of the shared architecture live in
`MULTI_BRAND_SECURITY.md`.

---

## Architecture in one paragraph

Every brand is a **domain family**: an apex (marketing site) plus a trade
subdomain (login, terminal, account, admin). All families hit the same app;
the **middleware** routes each family's app traffic to its own trade
subdomain, and **per-request brand resolution** (Host header →
`BRAND_OVERRIDES` profile) drives theming, logo, favicon, PWA manifest,
hero copy, emails, deposit wallets, referral links, and SEO. The FIRST entry
of `BRAND_DOMAINS` is canonical (default trade-host fallback, primary email
identity). Registration stamps each user with `User.brandDomain`, so
server-side behavior (emails, wallets, referral hosts) follows the family the
customer signed up under — even for queued jobs with no request context.

## Where brand configuration lives

Everything is environment-driven (no code changes to add a brand):

| Variable | Purpose |
| --- | --- |
| `DOMAIN` / `TRADE_DOMAIN` | Brand 1 apex + trade host (Caddy site blocks). |
| `DOMAIN_2` / `TRADE_DOMAIN_2` | Brand 2, same. Empty = family disabled. |
| `DOMAIN_3` / `TRADE_DOMAIN_3` | Brand 3 — pre-wired empty slots. |
| `BRAND_DOMAIN` | ONE domain — the canonical primary. Never a list. |
| `BRAND_DOMAINS` | Comma-separated apex list, canonical first. |
| `BRAND_OVERRIDES` | JSON map: apex → brand profile (see below). |
| `APP_ORIGIN` | Origin gate allowlist — every live origin, comma-separated. |
| `TRADE_SUBDOMAIN` | Subdomain label when no `TRADE_DOMAIN_N` pair exists (default `trade`). |

⚠️ **`BRAND_DOMAIN` must hold a single domain.** A comma list in it happens
to work in most code paths but produces a **malformed CSP header** (the CSP
builder splices `BRAND_DOMAIN` in at build time; a comma splits CSP
directives). Use `BRAND_DOMAINS` for the list.

### BRAND_OVERRIDES fields

```json
{
  "agilefgs.com": {
    "name": "Agile FGS", "shortName": "Agile FGS", "legalName": "Agile FGS Ltd",
    "supportEmail": "support@agilefgs.com",
    "address": "Airedale House, 423 Kirkstall Road, Leeds, England, LS4 2EW",
    "trademark": "Agile FGS™",
    "wordmark": ["Agile", "FGS"],
    "tradeEnabled": true,
    "accentColor": "#00644e",
    "emailColor": "#00644e",
    "glyph": { "viewBox": "0 0 24 24", "paths": [{"d": "M4 20v-5.5h3.4V20H4Z"}] },
    "ogImage": "/brands/agilefgs/og.png",
    "heroBadge": "Agile FGS — Multi-asset execution",
    "heroSubtitle": "…",
    "emailFrom": "Agile FGS <no-reply@agilefgs.com>",
    "depositWallets": "USDT:TRON (TRC20):T…; BTC:Bitcoin:bc1q…"
  }
}
```

- Domains **without** an entry inherit the primary brand (mirror phase).
- `tradeEnabled` is only needed when a family's trade host exists WITHOUT a
  `TRADE_DOMAIN_N` pair. With the pair set, login routing follows
  automatically (env pairs win, then `tradeEnabled`, then the canonical host).
- Invalid JSON safely falls back to primary branding everywhere.
- `emailFrom` requires the sending domain to be verified at the email
  provider (SPF/DKIM) **first** — otherwise that family's transactional email
  delivery fails. Omit until verified; the primary sender is the fallback.
- `depositWallets` uses the same format as `DEPOSIT_WALLET_ADDRESSES` and is
  structurally validated at parse time. Layering: **global → brand → group →
  per-user** (admin overrides win). Without it the family's customers see the
  global (primary's) wallets.
- `glyph` / `accentColor` drive the logo mark, generated favicon
  (`/brand/icon.svg`), QR center mark, and PWA theme color. `accentColor`
  also re-themes the whole UI per host (CSS variable injection, light + dim).

## What each surface does per brand

| Surface | Behavior |
| --- | --- |
| Theme (buttons/links/badges) | `accentColor` injected per host in the root layout. |
| Logo / favicon / QR mark | `wordmark` + `glyph` via the brand context and `/brand/icon.svg`. |
| Landing hero | `heroBadge` / `heroSubtitle` override the translated defaults. |
| Landing design | `landingTemplate`: `"default"` (Black Forest editorial layout) or `"agile"` (green fintech hero + ticker tape + bento grid). Unknown values fall back to `default`. |
| PWA manifest | `/manifest.webmanifest` resolves per host. |
| Emails | Rendered under the **user's stored family** (header brand, support address, button color, sender via `emailFrom`). |
| Referral links | Built on the **referrer's** family trade host. |
| Deposit wallets | Per-family (see `depositWallets`). |
| SEO | Self-canonical per host; per-host `robots.txt` + `sitemap.xml`. |
| Admin console | Brand chips on users, chat threads, and support cases (one shared console). |

## Runbook: add brand #3 (e.g. `newbrand.com`)

No code changes, no Caddyfile edits — the renderer generates site blocks
(plus `www.` → apex redirects) from the env.

1. **DNS**: point `newbrand.com` (and `trade.newbrand.com`) at the server.
2. **`.env.production`**:
   ```bash
   DOMAIN_3=newbrand.com
   TRADE_DOMAIN_3=trade.newbrand.com
   BRAND_DOMAINS=blackforrestt.com,agilefgs.com,newbrand.com
   # append to APP_ORIGIN:
   #   https://newbrand.com,https://trade.newbrand.com
   # add a "newbrand.com":{…} entry to BRAND_OVERRIDES (template above)
   ```
3. **Assets (optional)**: drop `public/brands/newbrand/og.png` (1200×630) and
   set `"ogImage"`. Favicon is generated — no asset needed.
4. **Emails as the new brand (optional)**: verify the domain at the provider,
   then add `"emailFrom"`.
5. **Deposit wallets (required for real money)**: add `"depositWallets"`
   with the brand's own addresses.
6. **Deploy** — `deploy/deploy.sh` re-renders Caddy (TLS auto-provisioned),
   the app picks up the new families at runtime (brand env is not build-baked;
   only the CSP origins in `next.config.ts` are build-time).
7. **Verify**: `https://newbrand.com` shows the new brand; `/login` hops to
   `trade.newbrand.com`; `robots.txt`/`sitemap.xml` reference the new host;
   a test signup's emails/wallets/referral link use the new family.

## Local development

- Brand config comes from `.env` **at process start** — restart `npm run dev`
  after editing it (hot reload covers code only).
- Map hosts for browser testing: add `127.0.0.1 agilefgs.com
  trade.agilefgs.com` to `/etc/hosts`, then browse `http://agilefgs.com:3000`.
- The middleware strips ports for host matching, so `:3000` URLs route
  correctly (e.g. `agilefgs.com:3000/login` → `trade.agilefgs.com:3000`).
- `curl -H "x-forwarded-host: agilefgs.com" http://localhost:3000/…` simulates
  a host without touching DNS.
- Regression suite: `npm run test:multibrand` (wallet layering, referral
  family links, trade-host resolution order, support-inbox brand attribution).

## Auth / sessions across families

`AUTH_TRUST_HOST=true` (required) makes Auth.js derive its base URL per
request, so login works identically on every trade host with same-origin
callbacks. Session cookies are host-only — each family is an independent
session; being logged into both brands in one browser is expected and they
never interfere. Password changes revoke sessions on all families
(see `MULTI_BRAND_SECURITY.md` #12).

⚠️ **`AUTH_URL` must stay set** (primary trade host) and — because Auth.js
resolves *relative* redirect targets against it — **all client sign-outs use
`redirect: false` + `window.location.assign(...)`** (self-navigation) rather
than a server-resolved `callbackUrl`. Without that, logging out on
`trade.agilefgs.com` bounces to `trade.blackforrestt.com`. Removing
`AUTH_URL` entirely is NOT a workaround: with this custom server the
header-less base resolves to the bind address (`0.0.0.0`) and auth redirects
break (verified empirically).

## Gotchas

- **Env changes need a restart/redeploy** — `BRAND_*` vars are read at
  process start; only the CSP origins are build-time (rebuild when changing
  `BRAND_DOMAIN`).
- **Mirror families without overrides** inherit primary branding — that IS
  the "same files, second domain" mode; differentiate by filling the override.
- **Unknown hosts** (bare IP, parked domains) silently fall back to primary
  branding and canonical-family routing.
- **One email = one account** across all brands — see the security doc
  before promising customers otherwise.
- `www.` works for apexes (redirects); `www.trade.*` is not served.
