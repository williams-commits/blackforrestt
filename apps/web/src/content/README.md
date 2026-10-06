# The Content Library

`src/content/contracts.ts` defines the platform's typed, presentation-free
content models. This is where a page's WORDS live — independent of any design.

## The contract

- **Landing sections** — `LandingPageContent`: hero, stats, pillars, markets,
  movers, intelligence, showcase, trust, steps, testimonials, finalCta.
  Every section is OPTIONAL: a domain assembles the sections its design
  renders; a design renders its own manifest — never required to use all.
- **Site chrome** — `NavigationContent`, `FooterContent` (link structure is
  content; CTA action targets stay in designs).
- **Page composition** — `PageSectionItem` (TOC / section manifests).

## Rules (enforced by tests/domains.test.ts)

1. **No presentation.** No JSX, no React types, no next-intl imports — pure
   data models.
2. **One assembler per domain.** `src/domains/<key>/content.ts` is the ONLY
   module that knows which i18n namespace / brand profile field feeds which
   contract field. Locale resolution is automatic (request locale + English
   deep-fallback from `src/i18n/request.ts`).
3. **Designs consume, never fetch.** A design component receives typed
   content as props. The agile tree is the enforced exemplar (the boundary
   test fails if it imports next-intl).
4. **Same content, different designs.** A future design lifts the exact same
   content objects — writing a new landing never means re-entering copy.

## Adding content

1. Extend the contract (`contracts.ts`) — data shape only.
2. Assemble it in the owning domain's `content.ts` (from catalogs/brand).
3. Render it in the design that uses it.

## Current state

- BOTH designs consume contracts fully: the agile landing/chrome and the
  default landing (Hero, Markets, TradingPlayground, ConfidenceSection,
  StickyCta, Navbar, Footer) receive typed content props assembled by their
  domain packages.
- Interior-page closing CTA flows through the shell-provided
  `ArticleCtaProvider` context (`src/components/landing/ArticleCta.tsx`).
- Live-data table islands (LivePrice `hero.featured`, SectionTicker
  `markets.table`, ContactForm) keep their catalog reads by design — shared
  table chrome on the intl runtime.
- TradingPlayground keeps two count-dependent PLURAL strings (matches/indexed)
  on the intl runtime — plural categories are locale grammar, not content.
- The root layout strips the `agile` namespace from the client payload for
  hosts not using that design (cross-family payload hygiene).
