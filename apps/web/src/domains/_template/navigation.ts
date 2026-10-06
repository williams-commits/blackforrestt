/** Chrome content: navigation + footer using shared namespaces. */
import { getTranslations } from "next-intl/server";
import type { BrandProfile } from "@/lib/branding";
import type { FooterContent, NavigationContent } from "@/content/contracts";

export async function __DOMAIN_KEY__NavigationContent(): Promise<NavigationContent> {
  const t = await getTranslations("nav");
  return {
    ariaLabel: t("company"),
    onLanding: true,
    quickLinks: [],
    groups: [
      { key: "company", label: t("company"), links: [
        { label: t("menu.about"), href: "/about" },
        { label: t("menu.contact"), href: "/contact" },
      ]},
      { key: "tools", label: t("tools"), links: [
        { label: t("menu.informers"), href: "/tools/informers" },
        { label: t("menu.calendars"), href: "/tools/calendars" },
      ]},
    ],
    loginLabel: t("login"),
    registerLabel: t("openAccount"),
    loginHref: "/login",
    registerHref: "/register",
    menuToggle: { open: t("openMenu"), close: t("closeMenu") },
  };
}

export async function __DOMAIN_KEY__FooterContent(brand: BrandProfile): Promise<FooterContent> {
  const t = await getTranslations("footer");
  return {
    tagline: t("tagline", { company: brand.name }),
    contact: { address: brand.address ?? "", supportEmail: brand.supportEmail },
    registrationSummary: "",
    columns: [
      { key: "company", label: "Company", links: [
        { label: "About", href: "/about" },
        { label: "Contact", href: "/contact" },
      ]},
      { key: "tools", label: "Tools", links: [
        { label: "Informers", href: "/tools/informers" },
        { label: "Calendars", href: "/tools/calendars" },
      ]},
      { key: "legal", label: "Legal", links: [
        { label: "Privacy", href: "/legal/privacy" },
        { label: "Terms", href: "/legal/terms" },
      ]},
    ],
    risk: { heading: t("riskWarning"), paragraphs: [t("risk1")] },
    copyright: t("copyright", { company: brand.name }),
    trademarkLine: t("trademark", { tm: brand.trademark, company: brand.name }),
  };
}
