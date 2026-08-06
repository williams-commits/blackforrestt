import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "@/components/providers";
import { brandName, brandDomain, brandShortName } from "@/lib/branding";

// Force dynamic rendering so branding values (brandName, brandDomain, etc.)
// are read from process.env at request time, not baked into static HTML at
// build time. This allows changing SUPPORT_EMAIL, BRAND_DOMAIN, etc. in
// .env.production with only a container recreate (--force-recreate), instead
// of requiring a full image rebuild.
export const dynamic = "force-dynamic";

const name = brandName();
const domain = brandDomain();
const siteUrl = `https://${domain}`;

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  // Template: a page setting `title: "About Us"` renders as
  // "About Us — Black Forest Digital". The default covers the landing page.
  title: { default: `${name} — Multi-asset Trading`, template: `%s — ${name}` },
  description: "Trade forex, commodities, indices and crypto on a lightning-fast platform with real-time quotes, advanced charting, and tight spreads.",
  applicationName: name,
  keywords: ["trading", "forex", "CFD", "commodities", "indices", "crypto", "online broker", "trading platform"],
  authors: [{ name: brandShortName() }],
  creator: brandShortName(),
  publisher: name,
  robots: { index: true, follow: true, googleBot: { index: true, follow: true } },
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: siteUrl,
    siteName: name,
    title: `${name} — Multi-asset Trading`,
    description: "Trade forex, commodities, indices and crypto on a lightning-fast platform with real-time quotes, advanced charting, and tight spreads.",
  },
  twitter: {
    card: "summary_large_image",
    title: `${name} — Multi-asset Trading`,
    description: "Trade forex, commodities, indices and crypto on a lightning-fast platform.",
  },
  icons: [
    { rel: "icon", url: "/favicon.svg" },
    { rel: "shortcut icon", url: "/favicon.svg" },
    { rel: "apple-touch-icon", url: "/favicon.svg" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-canvas text-text antialiased">
        <a href="#main-content" className="skip-link">Skip to main content</a>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
