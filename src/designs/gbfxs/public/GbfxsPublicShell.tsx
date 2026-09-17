import { Inter } from "next/font/google";
import type { PublicDesignProps } from "@/designs/contracts";
import { ArticleCtaProvider } from "@/components/landing/ArticleCta";
import { GbfxsStyles } from "@/designs/gbfxs/GbfxsStyles";
import { GbfxsNavbar } from "@/designs/gbfxs/GbfxsNavbar";
import { GbfxsFooter } from "@/designs/gbfxs/GbfxsFooter";

// The same sharp geometric sans the gbfxs landing renders in — interior
// pages and the landing must read as one product voice.
const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-agile-inter",
});

/**
 * Global Forex Services content shell — the brand-owned PUBLIC design for
 * every interior marketing route (about, tools, analytics, education, legal,
 * contact). Selected by the design registry (publicDesign: "gbfxs").
 *
 * The page bodies themselves are shared components built on the global design
 * tokens; the `ag-scope` class (see GbfxsStyles) remaps those tokens to
 * Agile's dark-institutional palette inside this tree, so shared content
 * reskins for Agile without a single product conditional or duplicated
 * component. Blackforrest renders the same bodies under the root (light)
 * tokens. Composition mirrors the landing: slim navbar, dark canvas,
 * institutional footer. Interior mode: quick-link anchors point back to the
 * landing ("/#markets").
 */
export async function GbfxsPublicShell({ children, navigation, footer, articleCta }: PublicDesignProps) {
  return (
    <div className={`ag-shell ag-scope flex min-h-screen flex-col ${inter.className}`}>
      <GbfxsStyles />
      <GbfxsNavbar content={navigation} />
      <ArticleCtaProvider value={articleCta}>
        <main id="main-content" tabIndex={-1} className="flex-1">
          {children}
        </main>
      </ArticleCtaProvider>
      <GbfxsFooter content={footer} />
    </div>
  );
}
