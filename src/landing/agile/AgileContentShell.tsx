import type { ReactNode } from "react";
import { Inter } from "next/font/google";
import { AgileStyles } from "./AgileStyles";
import { AgileNavbar } from "./AgileNavbar";
import { AgileFooter } from "./AgileFooter";

// The same sharp geometric sans the Agile landing renders in — interior
// pages and the landing must read as one product voice.
const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-agile-inter",
});

/**
 * Agile FGS content shell — the brand-owned chrome for every interior
 * marketing route (about, tools, analytics, education, legal, contact).
 *
 * The page bodies themselves are shared components built on the global design
 * tokens; the `ag-scope` class (see AgileStyles) remaps those tokens to
 * Agile's dark-institutional palette inside this tree, so shared content
 * reskins for Agile without a single product conditional or duplicated
 * component. Blackforrest renders the same bodies under the root (light)
 * tokens. Composition mirrors the landing: slim navbar, dark canvas,
 * institutional footer.
 */
export function AgileContentShell({ children }: { children: ReactNode }) {
  return (
    <div className={`ag-shell ag-scope flex min-h-screen flex-col ${inter.className}`}>
      <AgileStyles />
      {/* Interior pages: section anchors need the "/" prefix to jump back to
          the landing. */}
      <AgileNavbar anchorPrefix="/" />
      <main id="main-content" tabIndex={-1} className="flex-1">
        {children}
      </main>
      <AgileFooter />
    </div>
  );
}
