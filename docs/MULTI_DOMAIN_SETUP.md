# Multi-Domain / Multi-Brand Setup

How this deployment serves several brand families (e.g. `blackforrestt.com`
and `gbfxs.com`) from one codebase, and the exact runbook for adding the
next one. Security properties of the shared architecture live in
`MULTI_BRAND_SECURITY.md`.

---

## Architecture in one paragraph

Every brand is a **domain family**: an apex (marketing site) plus a trade
subdomain (login, terminal, account, admin). The shared Web and Trade apps
serve all families. **Middleware** routes
each family's app traffic to its configured trade subdomain, and
**per-request brand resolution** (Host header → manifest
defaults + `BRAND_OVERRIDES`) drives theming, logo, favicon, PWA manifest,
hero copy, emails, deposit wallets, referral links, and SEO. The FIRST entry
of `BRAND_DOMAINS` is canonical (trade-host fallback, primary email identity).
Registration stamps each user with `User.brandDomain`, so
server-side behavior (emails, wallets, referral hosts) follows the family the
customer signed up under — even for queued jobs with no request context.

## Where brand configuration lives

Two layers (see `docs/ARCHITECTURE.md`):

1. **Code layer** — one explicit `domain.config.ts` per family
   (`src/domains/<key>/`), discovered into the generated, read-only
   `src/domains/.generated/domains.ts` registry. It carries hosts, design
   selections (`landingDesign` / `publicDesign`), brand identity defaults,
   and features. The platform CLI regenerates registries; `npm run test:domains`
   validates them.
2. **Env layer** — the operational override surface below. Production can
   add mirror hosts or override any code default WITHOUT a rebuild (the
   custom server reads env at boot). An explicit `tradeHost` or
   `tradeEnabled` override wins; otherwise the domain manifest's
   `tradeEnabled` default applies.

Env variables:

| Variable | Purpose |
| --- | --- |
| `DEPLOY_DOMAINS` | Optional comma list of registry domain keys this deployment serves (default: all). Routing derives from the domain manifests — there are NO numbered slots. |
| `BRAND_DOMAIN` | ONE domain — the canonical primary. Never a list. |
| `BRAND_DOMAINS` | Comma-separated apex list, canonical first. |
| `BRAND_OVERRIDES` | JSON map: apex → brand profile (see below). |
| `APP_ORIGIN` | Origin gate allowlist — every live origin, comma-separated. |
| `TRADE_SUBDOMAIN` | Subdomain label used for manifest-enabled trade hosts (default `trade`). |

Use `BRAND_DOMAINS` for the canonical-first family list. `BRAND_DOMAIN` is
the legacy single-domain fallback when `BRAND_DOMAINS` is unset.

### BRAND_OVERRIDES fields

```json
{
  "gbfxs.com": {
    "name": "Global Forex Services", "shortName": "GFX", "legalName": "Global Forex Services Ltd",
    "supportEmail": "support@gbfxs.com",
    "address": "Airedale House, 423 Kirkstall Road, Leeds, England, LS4 2EW",
    "trademark": "GFX™",
    "wordmark": ["Global Forex", "Services"],
    "tradeEnabled": true,
    "accentColor": "#f0b90b",
    "emailColor": "#f0b90b",
    "logoLockup": "brackets",
    "logoWord": "gbfxs",
    "ogImage": "/brands/gbfxs/og.png",
    "emailFrom": "Global Forex Services <no-reply@gbfxs.com>",
    "depositWallets": "USDT:TRON (TRC20):T…; BTC:Bitcoin:bc1q…"
  }
}
```

- Unregistered mirror domains without an entry inherit the primary brand;
  registered domains use their manifest defaults.
- `tradeHost` explicitly names a family's trade host; otherwise
  `tradeEnabled` selects `TRADE_SUBDOMAIN.<apex>`. If neither enables a family,
  routing falls back to the canonical trade host.
- Invalid JSON is ignored; registered domains still use their manifest
  defaults, while unregistered mirrors use the primary defaults.
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
| Theme (buttons/links/badges) | The Web root applies the resolved accent per host; the Trade root resolves the same family profile and applies its scoped app treatment. |
| Logo / favicon / QR mark | Brand-aware logo and favicon routes use the resolved profile; Trade's logo request is served by the family Web host. |
| Landing hero | `heroBadge` / `heroSubtitle` override the translated defaults. |
| Landing design | `landingDesign` in the domain manifest picks the design package under `src/designs/`: `"default"`, `"gbfxs"` (dark-institutional fintech with live terminal, markets tabs, photo backdrops) or `"convertio"` (Coinbase-inspired: dark hero + product mockups, light editorial interior). `BRAND_OVERRIDES[host].landingTemplate` overrides per host at runtime (legacy value `"agile"` aliases to `gbfxs`). Brands share everything except their selected designs. |
| PWA manifest | `/manifest.webmanifest` resolves per host. |
| Emails | Rendered under the **user's stored family** (header brand, support address, button color, sender via `emailFrom`). |
| Referral links | Built on the **referrer's** family trade host. |
| Deposit wallets | Per-family (see `depositWallets`). |
| SEO | Self-canonical per host; per-host `robots.txt` + `sitemap.xml`. |
| Admin console | Brand chips on users, chat threads, and support cases (one shared console). |

## Runbook: add brand #3 (e.g. `newbrand.com`)

Use the platform CLI; do not copy packages or hand-edit generated registries
or Caddy configuration. See `docs/domains/ADDING_A_DOMAIN.md` for options.

1. **Create and configure the package**:
   ```bash
   cd apps/web
   npm run platform -- domain create --key=newbrand --host=newbrand.com \
     --trade-host=trade.newbrand.com --design=default --public-design=default
   ```
   Edit the generated package's content, navigation, SEO, and assets as needed.
2. **Configure runtime origins** in `.env.production`:
   ```bash
   BRAND_DOMAINS=blackforrestt.com,gbfxs.com,newbrand.com
   # Include https://newbrand.com and https://trade.newbrand.com in APP_ORIGIN.
   # Add BRAND_OVERRIDES only for values that intentionally differ from the
   # manifest defaults (for example email sender or deposit wallets).
   ```
3. **Validate and diagnose**:
   ```bash
   npm run platform -- domain validate newbrand
   npm run platform -- domain doctor newbrand
   ```
4. **DNS**: point `newbrand.com` (and `trade.newbrand.com`) at the server.
5. **Assets (optional)**: drop `public/brands/newbrand/og.png` (1200×630) and
   set `"ogImage"`. Favicon is generated — no asset needed.
6. **Emails as the new brand (optional)**: verify the domain at the provider,
   then add `"emailFrom"`.
7. **Deposit wallets (required for real money)**: add `"depositWallets"`
   with the brand's own addresses.
8. **Preview and deploy** — use `npm run platform -- domain deploy newbrand --dry-run`
   before the deployment host applies the generated per-domain Caddy site.
   `deploy/deploy.sh` re-renders Caddy (TLS auto-provisioned),
   the app picks up the new families at runtime (brand env is not build-baked;
   CSP origins are derived from the registry when the app starts).
9. **Verify**: `https://newbrand.com` shows the new brand; `/login` hops to
   `trade.newbrand.com`; `robots.txt`/`sitemap.xml` reference the new host.
   The doctor reports production health as informational; verify
   `https://newbrand.com/api/health` from the deployment environment.

## Local development

- Brand config comes from `.env` **at process start** — restart `npm run dev`
  after editing it (hot reload covers code only).
- The GBFXS manifest includes `gbfxs.localhost` for local brand testing:
  browse `http://gbfxs.localhost:3000`. Trade/auth routes preserve that host
  while forwarding to the local Trade app on port 3101, so its request-level
  brand profile matches the website.
- For real hostnames, map the apex and trade hosts to `127.0.0.1` in
  `/etc/hosts`; the middleware strips ports for host matching.
- `curl -H "x-forwarded-host: gbfxs.com" http://localhost:3000/…` simulates
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
`trade.gbfxs.com` bounces to `trade.blackforrestt.com`. Removing
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
