/**
 * Blackforrest chrome content: navigation + footer (shared by the landing
 * and every interior page of the blackforrest domain family).
 */
import { getTranslations } from "next-intl/server";
import type { BrandProfile } from "@/lib/branding";
import { brandRegistrationSummary } from "@/lib/branding";
import type { FooterContent, NavigationContent } from "@/content/contracts";

const PAYMENT_METHODS: Array<{ src: string; alt: string; aspect: number }> = [
  { src: "/payments/visa.png", alt: "Visa", aspect: 1200 / 762 },
  { src: "/payments/mastercard.png", alt: "Mastercard", aspect: 1280 / 995 },
  { src: "/payments/maestro.png", alt: "Maestro", aspect: 2000 / 1227 },
  { src: "/payments/amex.jpg", alt: "American Express", aspect: 1790 / 1106 },
  { src: "/payments/bitcoin.png", alt: "Bitcoin", aspect: 849 / 255 },
];

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

