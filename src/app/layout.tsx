import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "@/components/providers";
import { brandName } from "@/lib/branding";

const name = brandName();

export const metadata: Metadata = {
  title: { default: `${name} — Multi-asset Trading`, template: `%s | ${name}` },
  description: "A multi-asset trading platform for forex, commodities, indices and crypto.",
  robots: { index: true, follow: true },
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
