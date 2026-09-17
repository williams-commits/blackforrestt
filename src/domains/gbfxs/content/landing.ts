/**
 * AGILE domain content package (Global Forex Services / gbfxs.com).
 *
 * THE content source of truth for the gbfxs domain: assembles the typed
 * contracts from src/content/contracts.ts out of the i18n catalogs
 * (agile.*, hero, finalCta, nav, footer namespaces) + the brand profile +
 * the domain registry. Any design that wants to render the gbfxs landing
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
import { tradeHostForDomain } from "@/lib/branding";
import type {
  HeroContent,
  IntelligenceContent,
  LandingPageContent,
  MarketsBoardContent,
  MoversContent,
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
export type GbfxsLandingPageContent = LandingPageContent & {
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

/** The landing's full typed content (hero → final CTA), for the requesting
 *  locale, resolved against THIS brand family's profile. */
export async function gbfxsLandingContent(brand: BrandProfile): Promise<GbfxsLandingPageContent> {
  const t = await getTranslations("gbfxs");
  const tHero = await getTranslations("hero");
  const tCta = await getTranslations("finalCta");
  const tPanel = await getTranslations("gbfxs.panel");
  const tMarkets = await getTranslations("gbfxs.markets");
  const tMovers = await getTranslations("gbfxs.movers");
  const tValue = await getTranslations("gbfxs.value");
  const tPillars = await getTranslations("gbfxs.pillars");
  const tIntelligence = await getTranslations("gbfxs.intelligence");
  const tShowcase = await getTranslations("gbfxs.showcase");
  const tTrust = await getTranslations("gbfxs.trust");
  const tSteps = await getTranslations("gbfxs.steps");
  const tTestimonials = await getTranslations("gbfxs.testimonials");

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
    domain: "gbfxs",
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
