/**
 * BLACKFOREST domain content package (Black Forest Digital / blackforrestt.com).
 *
 * Assembles the primary brand's typed content from the i18n catalogs
 * (hero, playground, markets, confidence, finalCta, stickyCta, nav, footer,
 * toc namespaces) + the brand profile. The default design's section
 * components receive these contracts as props — content acquisition lives
 * HERE, not in the components.
 *
 * Live-data table islands (LivePrice, SectionTicker) keep their own catalog
 * reads (hero.featured / markets.table) — shared-table chrome resolved by the
 * intl runtime, per the shared-components rule.
 *
 * Server-only (getTranslations); locale resolution is automatic.
 */
import { getTranslations } from "next-intl/server";
import type { BrandProfile } from "@/lib/branding";
import { brandRegistrationSummary } from "@/lib/branding";
import type {
  ConfidenceContent,
  FooterContent,
  HeroTitleSegment,
  LandingPageContent,
  MarketsEditorialContent,
  NavigationContent,
  PageSectionItem,
  PlaygroundContent,
  StickyCtaContent,
} from "@/content/contracts";

/** Payment method logos (public/payments) — width fixed at 38px, height from
 *  the natural aspect ratio so icons aren't squashed. */
const PAYMENT_METHODS: Array<{ src: string; alt: string; aspect: number }> = [
  { src: "/payments/visa.png", alt: "Visa", aspect: 1200 / 762 },
  { src: "/payments/mastercard.png", alt: "Mastercard", aspect: 1280 / 995 },
  { src: "/payments/maestro.png", alt: "Maestro", aspect: 2000 / 1227 },
  { src: "/payments/amex.jpg", alt: "American Express", aspect: 1790 / 1106 },
  { src: "/payments/bitcoin.png", alt: "Bitcoin", aspect: 849 / 255 },
];

/** Hero stat claims (numerals rendered in mono). */
const HERO_STATS: Array<[value: string, key: "support" | "markets" | "execution"]> = [
  ["24/7", "support"],
  ["45+", "markets"],
  ["0.0s", "execution"],
];

/** The default design's navigation groups (structure = content). */
const NAV_GROUPS: Array<{ key: string; items: Array<{ key: string; href: string }> }> = [
  {
    key: "company",
    items: [
      { key: "about", href: "/about" },
      { key: "contact", href: "/contact" },
    ],
  },
  {
    key: "tools",
    items: [
      { key: "informers", href: "/tools/informers" },
      { key: "calendars", href: "/tools/calendars" },
      { key: "calculators", href: "/tools/calculators" },
      { key: "signals", href: "/tools/signals" },
    ],
  },
  {
    key: "analytics",
    items: [
      { key: "news", href: "/analytics/news" },
      { key: "technical", href: "/analytics/technical" },
      { key: "fundamental", href: "/analytics/fundamental" },
      { key: "trend", href: "/analytics/trend" },
    ],
  },
  {
    key: "education",
    items: [
      { key: "beginners", href: "/education/beginners" },
      { key: "advanced", href: "/education/advanced" },
    ],
  },
];

/** Asset-class sections of the default landing — also the TOC anchors. */
const LANDING_SECTION_KEYS: Array<{ id: string; key: string }> = [
  { id: "playground", key: "playground" },
  { id: "market-forex", key: "forex" },
  { id: "market-crypto", key: "crypto" },
  { id: "market-commodity", key: "commodity" },
  { id: "market-index", key: "index" },
  { id: "confidence", key: "confidence" },
  { id: "final-cta", key: "finalCta" },
];

/** Split an ICU rich-text title ("…<accent>word</accent>…") into segments. */
function parseAccentTitle(raw: string): HeroTitleSegment[] {
  const segments: HeroTitleSegment[] = [];
  const pattern = /<accent>(.*?)<\/accent>/g;
  let cursor = 0;
  for (const match of raw.matchAll(pattern)) {
    const index = match.index ?? 0;
    if (index > cursor) segments.push({ text: raw.slice(cursor, index), accent: false });
    segments.push({ text: match[1]!, accent: true });
    cursor = index + match[0].length;
  }
  if (cursor < raw.length) segments.push({ text: raw.slice(cursor), accent: false });
  return segments;
}

/**
 * The section manifest with resolved labels — the single source for the TOC
 * rail, the mobile TOC strip, and the progress checklist.
 */
export async function blackforestLandingSections(): Promise<PageSectionItem[]> {
  const t = await getTranslations("toc.sections");
  return LANDING_SECTION_KEYS.map(({ id, key }) => ({ id, label: t(key) }));
}

/** The default design's navigation bar content. */
export async function blackforestNavigationContent(): Promise<NavigationContent> {
  const t = await getTranslations("nav");
  return {
    // Historical aria-label (was nav.company) — preserved verbatim.
    ariaLabel: t("company"),
    onLanding: true,
    quickLinks: [],
    groups: NAV_GROUPS.map((group) => ({
      key: group.key,
      label: t(group.key),
      links: group.items.map((item) => ({ label: t(`menu.${item.key}`), href: item.href })),
    })),
    loginLabel: t("login"),
    registerLabel: t("openAccount"),
    loginHref: "/login",
    registerHref: "/register",
    menuToggle: { open: t("openMenu"), close: t("closeMenu") },
  };
}

/** The default footer's content (brand facts + assurance + payments). */
export async function blackforestFooterContent(brand: BrandProfile): Promise<FooterContent> {
  const t = await getTranslations("footer");
  const tA = await getTranslations("footer.assurance");
  const tLinks = await getTranslations("footer.links");
  const tCols = await getTranslations("footer.columns");
  const company = brand.legalName;

  return {
    tagline: t("tagline", { company }),
    contact: { address: brand.address, supportEmail: brand.supportEmail },
    registrationSummary: brandRegistrationSummary(brand),
    columns: [
      {
        key: "company",
        label: tCols("company"),
        links: [
          { label: tLinks("about"), href: "/about" },
          { label: tLinks("contact"), href: "/contact" },
          { label: tLinks("openAccount"), href: "/register" },
          { label: tLinks("login"), href: "/login" },
        ],
      },
      {
        key: "tools",
        label: tCols("tools"),
        links: [
          { label: tLinks("informers"), href: "/tools/informers" },
          { label: tLinks("calendars"), href: "/tools/calendars" },
          { label: tLinks("calculators"), href: "/tools/calculators" },
          { label: tLinks("signals"), href: "/tools/signals" },
        ],
      },
      {
        key: "legal",
        label: tCols("legal"),
        links: [
          { label: tLinks("privacy"), href: "/legal/privacy" },
          { label: tLinks("aml"), href: "/legal/aml" },
          { label: tLinks("kyc"), href: "/legal/kyc" },
          { label: tLinks("terms"), href: "/legal/terms" },
        ],
      },
    ],
    risk: {
      heading: t("riskWarning"),
      paragraphs: [t("risk1"), t("risk2"), t("risk3")],
    },
    copyright: t("copyright", { company }),
    trademarkLine: t("trademark", { tm: brand.trademark, company }),
    weAccept: t("weAccept"),
    paymentMethods: PAYMENT_METHODS,
    assurance: {
      title: tA("title"),
      registration: tA("registration"),
      registrationNote: tA("registrationNote"),
      segregated: tA("segregated"),
      compensation: tA("compensation"),
      protection: tA("protection"),
      security: tA("security"),
      payments: tA("payments"),
    },
  };
}

/** The default landing's full typed content, for the requesting locale. */
export async function blackforestLandingContent(brand: BrandProfile): Promise<LandingPageContent> {
  const tHero = await getTranslations("hero");
  const tStats = await getTranslations("hero.stats");
  const tNew = await getTranslations("hero.newThisWeek");
  const tPlay = await getTranslations("playground");
  const tMarkets = await getTranslations("markets.section");
  const tConfidence = await getTranslations("confidence");
  const tFeatures = await getTranslations("confidence.features");
  const tEdu = await getTranslations("confidence.education");
  const tCta = await getTranslations("finalCta");
  const tSticky = await getTranslations("stickyCta");

  // Per-category editorial intros (markets.<category> namespace per class) +
  // section headings (toc.sections — the same labels the TOC renders).
  const tToc = await getTranslations("toc.sections");
  const editorialCategories: MarketsEditorialContent["categories"] = {};
  const editorialLabels: Record<string, string> = {};
  for (const category of ["forex", "crypto", "commodity", "index"] as const) {
    const tCategory = await getTranslations(`markets.${category}`);
    editorialCategories[category] = {
      eyebrow: tCategory("eyebrow"),
      tagline: tCategory("tagline"),
    };
    editorialLabels[category] = tToc(category === "commodity" ? "commodity" : category);
  }

  const confidence: ConfidenceContent = {
    eyebrow: tConfidence("eyebrow"),
    title: tConfidence("title"),
    subtitle: tConfidence("subtitle"),
    features: (["execution", "charting", "risk", "security", "devices", "data"] as const).map((key) => ({
      label: tFeatures(`${key}.label`),
      title: tFeatures(`${key}.title`),
      desc: tFeatures(`${key}.desc`),
    })),
    education: {
      eyebrow: tEdu("eyebrow"),
      title: tEdu("title"),
      subtitle: tEdu("subtitle"),
      bullets: (["b1", "b2", "b3", "b4"] as const).map((key) => tEdu(`bullets.${key}`)),
      ctaLabel: tEdu("start"),
      cards: (["guides", "vod", "analysis", "calendar"] as const).map((key) => ({
        tag: tEdu(`cards.${key}.tag`),
        title: tEdu(`cards.${key}.title`),
        desc: tEdu(`cards.${key}.desc`),
      })),
    },
  };

  const playground: PlaygroundContent = {
    eyebrow: tPlay("eyebrow"),
    title: tPlay("title"),
    subtitle: tPlay("subtitle"),
    windowTitle: tPlay("windowTitle"),
    connected: tPlay("connected"),
    searchLabel: tPlay("searchLabel"),
    placeholder: tPlay("placeholder"),
    clear: tPlay("clear"),
    noMatch: tPlay("noMatch"),
    noMatchHint: tPlay("noMatchHint"),
    clickToTrade: tPlay("clickToTrade"),
    presets: [
      { label: "gold", query: "gold" },
      { label: "btc", query: "btc" },
      { label: "eur", query: "eur" },
      { label: "oil", query: "oil" },
      { label: "us30", query: "us30" },
    ],
  };

  const stickyCta: StickyCtaContent = {
    title: tSticky("title"),
    subtitle: tSticky("subtitle"),
    buttonLabel: tSticky("button"),
    dismissLabel: tSticky("dismiss"),
  };

  return {
    domain: "blackforrest",
    hero: {
      // Per-brand voice: BRAND_OVERRIDES heroBadge/heroSubtitle win.
      badge: brand.heroBadge || tHero("badge"),
      subtitle: brand.heroSubtitle || tHero("subtitle"),
      ctaPrimaryLabel: tHero("ctaPrimary"),
      ctaSecondaryLabel: tHero("ctaSecondary"),
      titleSegments: parseAccentTitle(tHero.raw("title") as string),
      stats: HERO_STATS.map(([value, key]) => ({ value, label: tStats(key) })),
      newThisWeek: {
        label: tNew("label"),
        series: tNew("series"),
        blurb: tNew("blurb"),
        viewAll: tNew("viewAll"),
        chapters: (["c1", "c2", "c3"] as const).map((key) => ({
          tag: tNew(`chapters.${key}.tag`),
          meta: tNew(`chapters.${key}.meta`),
          title: tNew(`chapters.${key}.title`),
        })),
      },
      loadingMarkets: tHero("loadingMarkets"),
    },
    markets: {
      editorial: {
        common: { body: tMarkets("body"), live: tMarkets("live") },
        labels: editorialLabels,
        categories: editorialCategories,
      },
    },
    confidence,
    playground,
    stickyCta,
    finalCta: {
      eyebrow: tCta("eyebrow"),
      title: tCta("title"),
      subtitle: tCta("subtitle"),
      ctaPrimaryLabel: tCta("primary"),
      ctaSecondaryLabel: tCta("secondary"),
    },
  };
}
