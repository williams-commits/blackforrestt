import type { Metadata } from "next";
import { Montserrat, JetBrains_Mono, Newsreader } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getTranslations } from "next-intl/server";
import "./globals.css";
import { Providers } from "@/components/providers";
import { ThemeProvider } from "@/components/ThemeProvider";
import { FormatLocaleBridge } from "@/components/FormatLocaleBridge";
import { TopProgressBar } from "@/components/ui/TopProgressBar";
import { brandDomain, currentBrandProfile, safeBrandColor } from "@/lib/branding";
import { LOCALE_BCP47, LOCALE_OG, RTL_LOCALES } from "@/i18n/config";
import { languageAlternates } from "@/lib/seo";

/*
  Self-hosted fonts via next/font. CSP `font-src 'self' data:` permits these
  (next/font self-hosts as data-URI / same-origin), but blocks the Google Fonts
  CDN — so next/font is the only compatible loader here.

  Each font exposes its CSS-variable name on `<html>`, which globals.css maps
  into the --font-sans / --font-mono / --font-serif design tokens.
*/
const sans = Montserrat({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-sans-loaded",
});
const mono = JetBrains_Mono({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-mono-loaded",
});
const serif = Newsreader({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-serif-loaded",
  style: ["normal", "italic"],
});

/*
  Apply the saved theme before paint to avoid a flash of the wrong scheme.
  Runs inline in the <head>; reads localStorage (key kept in sync with
  ThemeProvider). Defaults to light. Must stay a plain string — no JSX — so it
  serializes verbatim.
*/
const themeNoFlashScript = `(function(){try{var t=document.cookie.match(/blckforest-theme=(\\w+)/);t=t?t[1]:localStorage.getItem('blckforest-theme');if(t==='dim'){document.documentElement.classList.add('dim');}}catch(e){}})();`;

// Force dynamic rendering so branding values (brandName, brandDomain, etc.)
// are read from process.env at request time, not baked into static HTML at
// build time. This allows changing SUPPORT_EMAIL, BRAND_DOMAIN, etc. in
// .env.production with only a container recreate (--force-recreate), instead
// of requiring a full image rebuild.
export const dynamic = "force-dynamic";

// generateMetadata (not a static export) so og:locale reflects the active
// language resolved from the NEXT_LOCALE cookie.
export async function generateMetadata(): Promise<Metadata> {
  // Per-host branding: the mirror domain (e.g. agilefgs.com) titles and
  // describes itself under its own brand. Canonical/SEO URLs stay on the
  // primary domain so mirror content consolidates search indexing.
  const brand = await currentBrandProfile();
  const name = brand.name;
  const siteUrl = `https://${brandDomain()}`;
  const locale = await getLocale();
  const ogLocale = LOCALE_OG[locale as keyof typeof LOCALE_OG] ?? LOCALE_OG.en;
  const t = await getTranslations({ namespace: "Metadata", locale });
  const description = t("description");
  return {
    metadataBase: new URL(siteUrl),
    // Template: a page setting `title: "About Us"` renders as
    // "About Us — Black Forest Digital". The default covers the landing page.
    title: { default: `${name} — ${t("titleDefault")}`, template: `%s — ${name}` },
    description,
    applicationName: name,
    // Focused, high-intent terms only — long keyword lists read as spam to
    // crawlers and dilute relevance.
    keywords: ["online broker", "forex trading", "CFD trading", "commodities", "indices", "crypto trading", "trading platform"],
    authors: [{ name: brand.shortName }],
    creator: brand.shortName,
    publisher: brand.legalName,
    robots: { index: true, follow: true, googleBot: { index: true, follow: true } },
    // hreflang: the unprefixed URL is the default-locale (en) canonical; every
    // other locale lives at /<locale> (middleware strips the prefix and sets
    // the locale cookie — see src/middleware.ts).
    alternates: { canonical: "/", languages: languageAlternates("/") },
    openGraph: {
      type: "website",
      locale: ogLocale,
      url: siteUrl,
      siteName: name,
      title: `${name} — ${t("titleDefault")}`,
      description,
      // Per-brand share image (BRAND_OVERRIDES ogImage), primary default.
      images: [{ url: brand.ogImage || "/og.png", width: 1200, height: 630, alt: `${name} — multi-asset trading platform` }],
    },
    twitter: {
      card: "summary_large_image",
      title: `${name} — ${t("titleDefault")}`,
      description: t("twitterDescription"),
      images: ["/og.png"],
    },
    manifest: "/manifest.webmanifest",
    icons: [
      // Host-aware generated favicon — custom glyph/accent per brand family.
      { rel: "icon", url: "/brand/icon.svg" },
      { rel: "shortcut icon", url: "/brand/icon.svg" },
      { rel: "apple-touch-icon", url: "/brand/icon.svg" },
    ],
  };
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const brand = await currentBrandProfile();
  // Per-domain theme: a brand with an accentColor re-skins every --color-brand
  // utility (buttons, links, badges, focus rings) for its host only. Soft
  // tints and the dim-mode variant are derived with color-mix so one hex
  // re-themes light + dark. Injected into <head> before any content — no
  // flash of the default accent.
  const brandAccent = safeBrandColor(brand.accentColor);
  const brandThemeCss = brandAccent
    ? `:root{--color-brand:${brandAccent};--color-brand-soft:color-mix(in srgb, ${brandAccent} 14%, #fff)}`
      + `html.dim{--color-brand:color-mix(in srgb, ${brandAccent} 88%, #fff);--color-brand-soft:color-mix(in srgb, ${brandAccent} 24%, #000)}`
    : null;
  const siteUrl = `https://${brandDomain()}`;
  const locale = await getLocale();
  const htmlLang = LOCALE_BCP47[locale as keyof typeof LOCALE_BCP47] ?? "en";
  const isRTL = RTL_LOCALES.has(locale);
  // Load messages for the client provider (same resolver as request.ts).
  const messages = (await import(`../messages/${locale}.json`)).default;

  // Organization + WebSite structured data. Regulatory identifiers are only
  // included when configured via the COMPANY_* env placeholders — never
  // publish invented claims.
  const organization: Record<string, unknown> = {
    "@type": "Organization",
    name: brand.legalName,
    alternateName: brand.name,
    url: siteUrl,
    logo: `${siteUrl}/favicon.svg`,
    email: brand.supportEmail,
  };
  if (brand.address) organization.address = { "@type": "PostalAddress", streetAddress: brand.address };
  if (brand.companyJurisdiction) organization.foundingLocation = { "@type": "Place", name: brand.companyJurisdiction };
  if (brand.companyRegistrationNumber) organization.identifier = { "@type": "PropertyValue", name: "Company registration number", value: brand.companyRegistrationNumber };
  if (brand.companyRegulator) organization.hasCredential = `${brand.companyRegulator}${brand.companyLicenseNumber ? ` license ${brand.companyLicenseNumber}` : ""}`;
  const jsonLd = JSON.stringify([
    { "@context": "https://schema.org", ...organization },
    { "@context": "https://schema.org", "@type": "WebSite", name: brand.name, url: siteUrl },
  ]);

  return (
    // suppressHydrationWarning: the no-flash theme script (below) adds the
    // `dim` class to <html> before React hydrates, so the server-rendered
    // className intentionally differs from the live DOM for dim-theme users.
    <html
      lang={htmlLang}
      dir={isRTL ? "rtl" : "ltr"}
      className={`${sans.variable} ${mono.variable} ${serif.variable}`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeNoFlashScript }} />
        {brandThemeCss && <style id="brand-accent" dangerouslySetInnerHTML={{ __html: brandThemeCss }} />}
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd }} />
      </head>
      <body className="bg-canvas text-text antialiased">
        <a href="#main-content" className="skip-link">Skip to main content</a>
        <TopProgressBar />
        <ThemeProvider>
          <NextIntlClientProvider locale={locale} messages={messages}>
            <FormatLocaleBridge />
            <Providers brand={brand}>{children}</Providers>
          </NextIntlClientProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
