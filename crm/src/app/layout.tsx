import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import { crmBranding } from "@/lib/branding";
import { BrandingProvider } from "@/components/BrandingProvider";
import { Toaster } from "@/components/ui/sonner";
import { cn } from "@/lib/utils";

/** Product typeface (shadcn nova preset) — variable-loaded so tokens can
 * reference it. Falls back to the system stack when unavailable. */
const geist = Geist({ subsets: ["latin"], variable: "--font-sans" });

const branding = crmBranding();

export const metadata: Metadata = {
  title: {
    default: branding.name,
    template: `%s · ${branding.name}`,
  },
  description: "Sales and relationship management platform.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className={cn("font-sans", geist.variable)}>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var t=localStorage.getItem("crm-theme");var d=t==="dark"||(!t&&window.matchMedia("(prefers-color-scheme: dark)").matches);if(d)document.documentElement.setAttribute("data-theme","dark");}catch(e){}`,
          }}
        />
      </head>
      <body className="min-h-screen antialiased">
        <BrandingProvider value={branding}>{children}</BrandingProvider>
        <Toaster />
      </body>
    </html>
  );
}
