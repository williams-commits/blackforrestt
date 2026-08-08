import type { Metadata } from "next";
import { Montserrat, JetBrains_Mono, Newsreader } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getTranslations } from "next-intl/server";
import "./globals.css";
import { Providers } from "@/components/providers";
import { ThemeProvider } from "@/components/ThemeProvider";
import { FormatLocaleBridge } from "@/components/FormatLocaleBridge";
import { brandName, brandDomain, brandShortName } from "@/lib/branding";
import { LOCALE_BCP47, LOCALE_OG } from "@/i18n/config";

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
const themeNoFlashScript = `(function(){try{var t=localStorage.getItem('blckforest-theme');if(t==='dim'){document.documentElement.classList.add('dim');}}catch(e){}})();`;

// Force dynamic rendering so branding values (brandName, brandDomain, etc.)
// are read from process.env at request time, not baked into static HTML at
// build time. This allows changing SUPPORT_EMAIL, BRAND_DOMAIN, etc. in
// .env.production with only a container recreate (--force-recreate), instead
// of requiring a full image rebuild.
export const dynamic = "force-dynamic";

const name = brandName();
const domain = brandDomain();
const siteUrl = `https://${domain}`;

// generateMetadata (not a static export) so og:locale reflects the active
// language resolved from the NEXT_LOCALE cookie.
export async function generateMetadata(): Promise<Metadata> {
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
    keywords: ["trading", "forex", "CFD", "commodities", "indices", "crypto", "online broker", "trading platform"],
    authors: [{ name: brandShortName() }],
    creator: brandShortName(),
    publisher: name,
    robots: { index: true, follow: true, googleBot: { index: true, follow: true } },
    alternates: { canonical: "/" },
    openGraph: {
      type: "website",
      locale: ogLocale,
      url: siteUrl,
      siteName: name,
      title: `${name} — ${t("titleDefault")}`,
      description,
    },
    twitter: {
      card: "summary_large_image",
      title: `${name} — ${t("titleDefault")}`,
      description: t("twitterDescription"),
    },
    icons: [
      { rel: "icon", url: "/favicon.svg" },
      { rel: "shortcut icon", url: "/favicon.svg" },
      { rel: "apple-touch-icon", url: "/favicon.svg" },
    ],
  };
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();
  const htmlLang = LOCALE_BCP47[locale as keyof typeof LOCALE_BCP47] ?? "en";
  // Load messages for the client provider (same resolver as request.ts).
  const messages = (await import(`../messages/${locale}.json`)).default;

  return (
    <html lang={htmlLang} className={`${sans.variable} ${mono.variable} ${serif.variable}`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeNoFlashScript }} />
      </head>
      <body className="bg-canvas text-text antialiased">
        <a href="#main-content" className="skip-link">Skip to main content</a>
        <ThemeProvider>
          <NextIntlClientProvider locale={locale} messages={messages}>
            <FormatLocaleBridge />
            <Providers>{children}</Providers>
          </NextIntlClientProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
