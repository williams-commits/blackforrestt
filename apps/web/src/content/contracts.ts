/**
 * THE Content Library — typed, presentation-free content contracts.
 *
 * A landing page is CONTENT + DESIGN + PAGE COMPOSITION. These contracts are
 * the CONTENT layer: everything a page SAYS (copy, claims, labels, link
 * structure), independent of how any design renders it. The same content
 * contract must be usable by completely different visual implementations —
 * a design consumes these objects as props and never fetches translations
 * itself.
 *
 * Rules (enforced by tests/architecture.test.ts):
 * - NO JSX, NO React types, NO next-intl here. Pure data models.
 * - Domain content packages (src/domains/<domain>/content/) ASSEMBLE these
 *   objects from the i18n catalogs + brand profile + domain config. They are
 *   the only modules that know which catalog namespace feeds which field.
 * - Designs (src/designs/<key>/) RENDER these objects. They must not
 *   import next-intl for landing copy.
 *
 * Sections are intentionally optional on LandingPageContent: a domain may use
 * any subset — designs render their own section manifest, they are never
 * required to render every section a contract describes.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Primitives
// ─────────────────────────────────────────────────────────────────────────────

/** A labeled link (navigation columns, quick links). Where a link points is
 *  part of navigation CONTENT; CTA buttons inside sections carry only a label
 *  because designs own their action targets (platform routes). */
export interface NavLink {
  label: string;
  href: string;
}

/** Landing-section quick link ("Markets" → #markets anchor). */
export interface NavQuickLink {
  label: string;
  anchor: string;
}

/** Grouped navigation dropdown (label + links). */
export interface NavGroup {
  key: string;
  label: string;
  links: NavLink[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Landing sections
// ─────────────────────────────────────────────────────────────────────────────

export interface HeroContent {
  badge: string;
  titleA?: string;
  titleB?: string;
  subtitle: string;
  ctaPrimaryLabel: string;
  ctaSecondaryLabel: string;
  /** Micro-trust line items, pre-split ("Segregated funds · 24/7" → parts). */
  trustLine?: string[];
  /** Live-quote panel field labels. */
  panel?: { bid: string; ask: string; spread: string; trade: string; live: string; tickerLive: string };
  // ── Editorial (default-design) hero members ──────────────────────────────
  /** Rich title split into plain/accent segments ("Trade every <accent>…"). */
  titleSegments?: HeroTitleSegment[];
  /** Hero stat row ("24/7 Support"). */
  stats?: StatItem[];
  /** "New this week" education chapter card. */
  newThisWeek?: NewThisWeekContent;
  /** Empty-state copy while the featured instrument loads. */
  loadingMarkets?: string;
}

export interface HeroTitleSegment {
  text: string;
  accent: boolean;
}

export interface NewThisWeekChapter {
  tag: string;
  meta: string;
  title: string;
}

export interface NewThisWeekContent {
  label: string;
  series: string;
  blurb: string;
  viewAll: string;
  chapters: NewThisWeekChapter[];
}

export interface StatItem {
  /** The numeral ("45+", "<1s"). */
  value: string;
  label: string;
}

export interface StatsContent {
  ariaLabel: string;
  items: StatItem[];
}

export interface PillarCardContent {
  title: string;
  desc: string;
}

/** The "why this desk" bento: fixed capability cells + the asset-class strip. */
export interface PillarsContent {
  eyebrow: string;
  title: string;
  subtitle: string;
  all: PillarCardContent;
  speed: PillarCardContent & { value: string };
  security: PillarCardContent;
  pricing: PillarCardContent;
  global: { title: string; desc: string };
  categories: Record<string, string>;
}

export interface MarketPanelContent {
  title: string;
  bullets: string[];
  ctaLabel: string;
}

/** gbfxs-style institutional quote board (category pills + panel + list). */
export interface MarketsBoardContent {
  eyebrow: string;
  title: string;
  subtitle: string;
  ctaLabel: string;
  categories: Record<string, string>;
  empty: string;
  today: string;
  updated: string;
  trade: string;
  live: string;
  /** Keyed by lowercase category ("forex", "crypto", …). */
  panels: Record<string, MarketPanelContent>;
}

/** Default-design editorial market sections: prose intro per asset class. */
export interface MarketsEditorialContent {
  common: { body: string; live: string };
  /** Section heading per lowercase category ("forex" → "Forex"). */
  labels: Record<string, string>;
  categories: Record<string, { eyebrow: string; tagline: string }>;
}

export interface MarketsContent {
  /** gbfxs-style quote board labels. */
  board?: MarketsBoardContent;
  /** Editorial per-category section copy. */
  editorial?: MarketsEditorialContent;
}

export interface MoversContent {
  eyebrow: string;
  title: string;
  subtitle: string;
  metric: string;
  last: string;
  ctaLabel: string;
}

export interface IntelligenceContent {
  eyebrow: string;
  title: string;
  subtitle: string;
  bullets: string[];
  ctaLabel: string;
}

export interface ShowcaseContent {
  label: string;
  title: string;
  subtitle: string;
  bullets: string[];
  ctaLabel: string;
  /** Labels reused by the live-quote panel motif. */
  panel: { bid: string; ask: string; spread: string };
  /** Host shown in the mock browser chrome (this family's trade host). */
  hostLabel: string;
}

export interface TrustCardContent {
  title: string;
  desc: string;
  /** Regulator / license line; null hides the meta row. */
  meta: string | null;
  /** Institution pills (regulators, custody, schemes). */
  tags: string[];
}

export interface TrustContent {
  eyebrow: string;
  title: string;
  subtitle: string;
  cards: TrustCardContent[];
}

export interface StepContent {
  title: string;
  desc: string;
}

export interface StepsContent {
  eyebrow: string;
  title: string;
  subtitle: string;
  steps: StepContent[];
}

export interface TestimonialContent {
  quote: string;
  name: string;
  role: string;
  /** Domain asset path (public/brands/<domain>/…). */
  avatar: string;
  /** Illustrative per-story stats; omit a stat by leaving it undefined. */
  returns?: string;
  trades?: string;
}

export interface TestimonialsContent {
  eyebrow: string;
  title: string;
  statLabels: { returns: string; trades: string };
  items: TestimonialContent[];
}

export interface FinalCtaContent {
  eyebrow: string;
  title: string;
  subtitle: string;
  ctaPrimaryLabel: string;
  ctaSecondaryLabel: string;
}

/** "Trade with confidence" section: platform capabilities + education. */
export interface ConfidenceFeature {
  label: string;
  title: string;
  desc: string;
}

export interface ConfidenceEduCard {
  tag: string;
  title: string;
  desc: string;
}

export interface ConfidenceEducation {
  eyebrow: string;
  title: string;
  subtitle: string;
  bullets: string[];
  ctaLabel: string;
  cards: ConfidenceEduCard[];
}

export interface ConfidenceContent {
  eyebrow: string;
  title: string;
  subtitle: string;
  features: ConfidenceFeature[];
  education: ConfidenceEducation;
}

/** Trading playground (instrument search) labels. Count-dependent plural
 *  strings (matches/indexed) stay on the intl runtime inside the component. */
export interface PlaygroundPreset {
  label: string;
  query: string;
}

export interface PlaygroundContent {
  eyebrow: string;
  title: string;
  subtitle: string;
  windowTitle: string;
  connected: string;
  searchLabel: string;
  placeholder: string;
  clear: string;
  noMatch: string;
  noMatchHint: string;
  clickToTrade: string;
  presets: PlaygroundPreset[];
}

/** Fixed registration bar. */
export interface StickyCtaContent {
  title: string;
  subtitle: string;
  buttonLabel: string;
  dismissLabel: string;
}

/**
 * The full landing-page content contract. Every section is optional — a
 * domain's content package assembles the sections its design renders, and a
 * design renders its own manifest of sections (never required to use all).
 */
export interface LandingPageContent {
  /** Owning domain key ("gbfxs"). */
  domain: string;
  hero: HeroContent;
  stats?: StatsContent;
  pillars?: PillarsContent;
  markets: MarketsContent;
  movers?: MoversContent;
  intelligence?: IntelligenceContent;
  showcase?: ShowcaseContent;
  trust?: TrustContent;
  steps?: StepsContent;
  testimonials?: TestimonialsContent;
  finalCta: FinalCtaContent;
  /** Default-design sections. */
  confidence?: ConfidenceContent;
  playground?: PlaygroundContent;
  stickyCta?: StickyCtaContent;
  /** Section manifest (TOC/anchors) when the design renders one. */
  sections?: PageSectionItem[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Site chrome: navigation + footer (shared by landing AND interior pages)
// ─────────────────────────────────────────────────────────────────────────────

export interface NavigationContent {
  /** <nav aria-label>. */
  ariaLabel: string;
  /** True when rendered ON the landing (quick-link anchors are "#section");
   *  interior-page navigation anchors back to "/#section" and hides the
   *  mobile quick-link block. */
  onLanding: boolean;
  /** Landing-section quick links. */
  quickLinks: NavQuickLink[];
  groups: NavGroup[];
  loginLabel: string;
  registerLabel: string;
  loginHref: string;
  registerHref: string;
  menuToggle: { open: string; close: string };
}

export interface FooterContent {
  tagline: string;
  contact: { address: string; supportEmail: string };
  registrationSummary: string;
  columns: NavGroup[];
  risk: { heading: string; paragraphs: string[] };
  copyright: string;
  trademarkLine: string;
  // ── Default-design footer members ────────────────────────────────────────
  /** "We accept" payment-method strip. */
  weAccept?: string;
  /** Payment logos (asset path, alt, natural width/height ratio). */
  paymentMethods?: Array<{ src: string; alt: string; aspect: number }>;
  /** Trading-assurance badge row. */
  assurance?: {
    title: string;
    registration: string;
    registrationNote: string;
    segregated: string;
    compensation: string;
    protection: string;
    security: string;
    payments: string;
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Interior (public) page composition
// ─────────────────────────────────────────────────────────────────────────────

/** One entry of an interior page's table of contents / section manifest. */
export interface PageSectionItem {
  id: string;
  label: string;
}

/** The closing CTA band interior pages render at the bottom of the article
 *  body (every public design ends content pages in the product's voice). */
export interface ArticleClosingCta {
  title: string;
  subtitle: string;
  primaryLabel: string;
  secondaryLabel: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Domain content loader contract (implemented by every domain package)
// ─────────────────────────────────────────────────────────────────────────────

import type { BrandProfile } from "@/lib/branding";

/** Everything a domain provides to the platform renderer. Each domain
 *  package's index.ts implements this interface; the generated content
 *  registry maps domain keys to these loaders. */
export interface DomainContentLoaders {
  /** Landing bundle: landing content (locale-resolved) + landing chrome. */
  landing(brand: BrandProfile): Promise<{
    landing: LandingPageContent;
    navigation: NavigationContent;
    footer: FooterContent;
  }>;
  /** Public (interior-page) chrome: navigation + footer + closing CTA. */
  publicChrome(brand: BrandProfile): Promise<{
    navigation: NavigationContent;
    footer: FooterContent;
    articleCta: ArticleClosingCta;
  }>;
}
