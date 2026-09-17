/** Chrome content: navigation + footer (placeholder groups). */
import { getTranslations } from "next-intl/server";
import type { FooterContent, NavigationContent } from "@/content/contracts";

export async function __DOMAIN_KEY__NavigationContent(): Promise<NavigationContent> {
  const t = await getTranslations("nav");
  return {
    ariaLabel: t("company"),
    onLanding: true,
    quickLinks: [],
    groups: [],
    loginLabel: t("login"),
    registerLabel: t("openAccount"),
    loginHref: "/login",
    registerHref: "/register",
    menuToggle: { open: t("openMenu"), close: t("closeMenu") },
  };
}

export async function __DOMAIN_KEY__FooterContent(): Promise<FooterContent> {
  const t = await getTranslations("footer");
  return {
    tagline: t("tagline"),
    contact: { address: "", supportEmail: "" },
    registrationSummary: "",
    columns: [],
    risk: { heading: t("riskWarning"), paragraphs: [t("risk1")] },
    copyright: t("copyright"),
    trademarkLine: t("trademark"),
  };
}
