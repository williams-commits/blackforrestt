/**
 * GBFXS chrome content: navigation + footer (shared by the landing and
 * every interior page of the gbfxs domain family).
 */
import { getTranslations } from "next-intl/server";
import type { BrandProfile } from "@/lib/branding";
import { brandRegistrationSummary } from "@/lib/branding";
import type { FooterContent, NavigationContent } from "@/content/contracts";

/** The gbfxs landing's navigation groups (structure = content, styling = design). */
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

/** The gbfxs navigation bar's typed content. `landing` picks the quick links'
 *  anchor form (landing: "#markets"; interior pages: "/#markets"). */
export async function gbfxsNavigationContent(landing: boolean): Promise<NavigationContent> {
  const t = await getTranslations("nav");
  const tA = await getTranslations("gbfxs.nav");
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

/** The gbfxs footer's typed content (brand facts resolved here, not in design). */
export async function gbfxsFooterContent(brand: BrandProfile): Promise<FooterContent> {
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
