/**
 * Blackforrest landing content assembly (hero → final CTA), for the
 * requesting locale, resolved against the brand profile.
 */
import { getTranslations } from "next-intl/server";
import type { BrandProfile } from "@/lib/branding";
import type {
  ConfidenceContent,
  HeroTitleSegment,
  LandingPageContent,
  MarketsEditorialContent,
  PlaygroundContent,
  StickyCtaContent,
} from "@/content/contracts";

/** Hero stat claims (numerals rendered in mono). */
const HERO_STATS: Array<[value: string, key: "support" | "markets" | "execution"]> = [
  ["24/7", "support"],
  ["45+", "markets"],
  ["0.0s", "execution"],
];

/** Asset-class sections of the default landing — also the TOC anchors. */
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

