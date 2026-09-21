import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { crmBranding } from "@/lib/branding";
import { BrandingProvider } from "@/components/BrandingProvider";

const branding = crmBranding();

/** Single product typeface — a modern professional sans, variable-loaded so
 * design tokens can reference it (never `.className`, which skips the CSS
 * custom property). Falls back to the system stack when unavailable. */
const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: branding.name,
    template: `%s · ${branding.name}`,
  },
  description: "Sales and relationship management platform.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className={inter.variable}>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var t=localStorage.getItem("crm-theme");var d=t==="dark"||(!t&&window.matchMedia("(prefers-color-scheme: dark)").matches);if(d)document.documentElement.setAttribute("data-theme","dark");}catch(e){}`,
          }}
        />
      </head>
      <body className="min-h-screen antialiased">
        <BrandingProvider value={branding}>{children}</BrandingProvider>
      </body>
    </html>
  );
}
