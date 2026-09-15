/**
 * AGILE domain content package (Global Forex Services / gbfxs.com).
 *
 * THE content source of truth for the agile domain: assembles the typed
 * contracts from src/content/contracts.ts out of the i18n catalogs
 * (agile.*, hero, finalCta, nav, footer namespaces) + the brand profile +
 * the domain registry. Any design that wants to render the agile landing
 * consumes THESE objects — content acquisition never happens inside design
 * components, so a future design can reuse every word without touching a
 * catalog.
 *
 * Server-only (getTranslations). Locale resolution is automatic — the
 * request's locale (cookie/prefix, see src/i18n/request.ts) selects the
 * catalog; the English deep-fallback merge in the i18n layer guarantees no
 * raw keys leak through these fields.
 */
import { getTranslations } from "next-intl/server";
import type { BrandProfile } from "@/lib/branding";
import { brandRegistrationSummary, tradeHostForDomain } from "@/lib/branding";
import type {
  ArticleClosingCta,
  FooterContent,
  HeroContent,
  IntelligenceContent,
  LandingPageContent,
  MarketsBoardContent,
  MoversContent,
  NavigationContent,
  PillarsContent,
  ShowcaseContent,
  StatsContent,
  StepsContent,
  TestimonialContent,
  TestimonialsContent,
  TrustContent,
} from "@/content/contracts";

/** The assembled agile landing — this design's required sections narrowed to
 *  non-optional so section components get complete contracts. */
export type AgileLandingPageContent = LandingPageContent & {
  hero: HeroContent & Required<Pick<HeroContent, "titleA" | "titleB" | "trustLine" | "panel">>;
  stats: StatsContent;
  pillars: PillarsContent;
  movers: MoversContent;
  intelligence: IntelligenceContent;
  showcase: ShowcaseContent;
  trust: TrustContent;
  steps: StepsContent;
  testimonials: TestimonialsContent;
  markets: { board: MarketsBoardContent };
};

/** Hero stat claims — factual platform numbers, owned by content not design. */
const HERO_STATS: Array<[value: string, key: "statInstruments" | "statExecution" | "statSupport" | "statLanguages"]> = [
  ["45+", "statInstruments"],
  ["<1s", "statExecution"],
  ["24/7", "statSupport"],
  ["9", "statLanguages"],
];

/** Photo avatars in the source feedback order (Anton→2, Sophie→3, Carlos→1…). */
const TESTIMONIAL_AVATARS = [2, 3, 1, 4, 5].map(
  (n) => `/brands/gbfxs/testimonials/feedback__avatar-${n}.svg`,
);

/** The agile landing's navigation groups (structure = content, styling = design). */
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
      { key: "beginnersVods", href: "/education/beginners-vods" },
      { key: "advancedVods", href: "/education/advanced-vods" },
      { key: "cryptoVods", href: "/education/crypto-vods" },
    ],
  },
];

/** The landing's full typed content (hero → final CTA), for the requesting
 *  locale, resolved against THIS brand family's profile. */
export async function agileLandingContent(brand: BrandProfile): Promise<AgileLandingPageContent> {
  const t = await getTranslations("agile");
  const tHero = await getTranslations("hero");
  const tCta = await getTranslations("finalCta");
  const tPanel = await getTranslations("agile.panel");
  const tMarkets = await getTranslations("agile.markets");
  const tMovers = await getTranslations("agile.movers");
  const tValue = await getTranslations("agile.value");
  const tPillars = await getTranslations("agile.pillars");
  const tIntelligence = await getTranslations("agile.intelligence");
  const tShowcase = await getTranslations("agile.showcase");
  const tTrust = await getTranslations("agile.trust");
  const tSteps = await getTranslations("agile.steps");
  const tTestimonials = await getTranslations("agile.testimonials");

  const categories = {
    forex: tMarkets("categories.forex"),
    crypto: tMarkets("categories.crypto"),
    commodity: tMarkets("categories.commodity"),
    index: tMarkets("categories.index"),
    stock: tMarkets("categories.stock"),
  };
  const panels = tMarkets.raw("panels") as Record<string, { title: string; bullets: string[]; cta: string }>;

  const companyDesc = [
    brand.legalName,
    brand.companyJurisdiction ? `— registered in ${brand.companyJurisdiction}` : null,
    brand.companyRegistrationNumber ? `(reg. ${brand.companyRegistrationNumber})` : null,
  ]
    .filter(Boolean)
    .join(" ");

  const testimonials = (tTestimonials.raw("items") as TestimonialContent[]).map((item, index) => ({
    ...item,
    avatar: TESTIMONIAL_AVATARS[index] ?? TESTIMONIAL_AVATARS[0],
  }));

  return {
    domain: "agile",
    hero: {
      badge: brand.heroBadge || tHero("badge"),
      titleA: t("heroTitleA"),
      titleB: t("heroTitleB"),
      subtitle: brand.heroSubtitle || tHero("subtitle"),
      ctaPrimaryLabel: tCta("primary"),
      ctaSecondaryLabel: tHero("ctaSecondary"),
      trustLine: t("heroTrustLine")
        .split("·")
        .map((part) => part.trim()),
      panel: {
        bid: t("showcase.bid"),
        ask: t("showcase.ask"),
        spread: t("showcase.spread"),
        trade: tMarkets("trade"),
        live: tPanel("live"),
        tickerLive: tMarkets("live"),
      },
    },
    stats: {
      ariaLabel: tValue("subtitle"),
      items: HERO_STATS.map(([value, key]) => ({ value, label: t(key) })),
    },
    pillars: {
      eyebrow: tPillars("eyebrow"),
      title: tPillars("title"),
      subtitle: tPillars("subtitle"),
      all: { title: tPillars("all.title"), desc: tPillars("all.desc") },
      speed: { title: tPillars("speed.title"), desc: tPillars("speed.desc"), value: "<1s" },
      security: { title: tPillars("security.title"), desc: tPillars("security.desc") },
      pricing: { title: tPillars("pricing.title"), desc: tPillars("pricing.desc") },
      global: { title: t("globalTitle"), desc: tPillars("all.desc") },
      categories,
    },
    markets: {
      board: {
        eyebrow: tMarkets("eyebrow"),
        title: tMarkets("title"),
        subtitle: tMarkets("subtitle"),
        ctaLabel: tMarkets("cta"),
        categories,
        empty: tMarkets("empty"),
        today: tMarkets("today"),
        updated: tMarkets("updated"),
        trade: tMarkets("trade"),
        live: tMarkets("live"),
        panels: Object.fromEntries(
          Object.entries(panels).map(([key, panel]) => [key, { ...panel, ctaLabel: panel.cta }]),
        ),
      },
    },
    movers: {
      eyebrow: tMovers("eyebrow"),
      title: tMovers("title"),
      subtitle: tMovers("subtitle"),
      metric: tMovers("metric"),
      last: tMovers("last"),
      ctaLabel: tMovers("cta"),
    },
    intelligence: {
      eyebrow: tIntelligence("eyebrow"),
      title: tIntelligence("title"),
      subtitle: tIntelligence("subtitle"),
      bullets: [tIntelligence("b1"), tIntelligence("b2"), tIntelligence("b3"), tIntelligence("b4")],
      ctaLabel: tIntelligence("cta"),
    },
    showcase: {
      label: tShowcase("label"),
      title: tShowcase("title"),
      subtitle: tShowcase("subtitle"),
      bullets: [tShowcase("b1"), tShowcase("b2"), tShowcase("b3")],
      ctaLabel: tShowcase("cta"),
      panel: { bid: t("showcase.bid"), ask: t("showcase.ask"), spread: t("showcase.spread") },
      hostLabel: tradeHostForDomain(brand.domain),
    },
    trust: {
      eyebrow: tTrust("eyebrow"),
      title: tTrust("title"),
      subtitle: tTrust("subtitle"),
      cards: [
        {
          title: tTrust("company.title"),
          desc: companyDesc || tTrust("company.fallback"),
          meta: brand.companyRegulator || null,
          tags: tTrust.raw("company.tags") as string[],
        },
        {
          title: tTrust("segregated.title"),
          desc: tTrust("segregated.desc"),
          meta: null,
          tags: tTrust.raw("segregated.tags") as string[],
        },
        {
          title: tTrust("protection.title"),
          desc: brand.investorCompensationScheme || tTrust("protection.fallback"),
          meta: null,
          tags: tTrust.raw("protection.tags") as string[],
        },
      ],
    },
    steps: {
      eyebrow: tSteps("eyebrow"),
      title: tSteps("title"),
      subtitle: tSteps("subtitle"),
      steps: [
        { title: tSteps("s1.title"), desc: tSteps("s1.desc") },
        { title: tSteps("s2.title"), desc: tSteps("s2.desc") },
        { title: tSteps("s3.title"), desc: tSteps("s3.desc") },
      ],
    },
    testimonials: {
      eyebrow: tTestimonials("eyebrow"),
      title: tTestimonials("title"),
      statLabels: { returns: tTestimonials("returns"), trades: tTestimonials("trades") },
      items: testimonials,
    },
    finalCta: {
      eyebrow: tCta("eyebrow"),
      title: t("ctaTitle"),
      subtitle: t("ctaSubtitle"),
      ctaPrimaryLabel: tCta("primary"),
      ctaSecondaryLabel: tCta("secondary"),
    },
  };
}

/** The agile navigation bar's typed content. `landing` picks the quick links'
 *  anchor form (landing: "#markets"; interior pages: "/#markets"). */
export async function agileNavigationContent(landing: boolean): Promise<NavigationContent> {
  const t = await getTranslations("nav");
  const tA = await getTranslations("agile.nav");
  const prefix = landing ? "" : "/";
  return {
    ariaLabel: tA("primary"),
    onLanding: landing,
    quickLinks: [
      { label: tA("markets"), anchor: `${prefix}#markets` },
      { label: tA("platform"), anchor: `${prefix}#platform` },
    ],
    groups: NAV_GROUPS.map((group) => ({
      key: group.key,
      label: t(group.key),
      links: group.items.map((item) => ({ label: t(`menu.${item.key}`), href: item.href })),
    })),
    loginLabel: tA("login"),
    registerLabel: tA("cta"),
    loginHref: "/login",
    registerHref: "/register",
    menuToggle: { open: tA("openMenu"), close: tA("closeMenu") },
  };
}

/** The interior-page closing CTA band (finalCta namespace). */
export async function agileArticleCta(): Promise<ArticleClosingCta> {
  const t = await getTranslations("finalCta");
  return {
    title: t("title"),
    subtitle: t("subtitle"),
    primaryLabel: t("primary"),
    secondaryLabel: t("secondary"),
  };
}

/** The agile footer's typed content (brand facts resolved here, not in design). */
export async function agileFooterContent(brand: BrandProfile): Promise<FooterContent> {
  const t = await getTranslations("footer");
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
  };
}
