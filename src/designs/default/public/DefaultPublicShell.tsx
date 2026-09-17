import type { ReactNode } from "react";
import { currentBrandProfile } from "@/lib/branding";
import { blackforestFooterContent, blackforestNavigationContent } from "@/domains/blackforrest/content";
import { Navbar } from "@/components/landing/Navbar";
import { Footer } from "@/components/landing/Footer";

/**
 * DEFAULT public-page shell — the primary brand's light editorial chrome
 * (Navbar + Footer) for the (content) route group. Selected by the design
 * registry whenever a domain's publicDesign is "default" or unknown. The
 * chrome's typed content is assembled here once and passed down.
 */
export async function DefaultPublicShell({ children }: { children: ReactNode }) {
  const brand = await currentBrandProfile();
  const [navigation, footer] = await Promise.all([
    blackforestNavigationContent(),
    blackforestFooterContent(brand),
  ]);
  return (
    <div className="min-h-screen flex flex-col">
      <Navbar content={navigation} />
      <main id="main-content" tabIndex={-1} className="flex-1">{children}</main>
      <Footer content={footer} />
    </div>
  );
}
