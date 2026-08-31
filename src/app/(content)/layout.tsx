import { currentBrandProfile } from "@/lib/branding";
import { Navbar } from "@/components/landing/Navbar";
import { Footer } from "@/components/landing/Footer";
import { AgileContentShell } from "@/landing/agile/AgileContentShell";

/**
 * Shared layout for the marketing content pages (About, Tools, Analytics,
 * Education, Legal) — a thin brand dispatcher, mirroring src/app/page.tsx.
 *
 * Each brand family gets its own chrome for these routes: the primary brand
 * keeps the light editorial navbar + footer, Agile FGS renders its
 * dark-institutional shell (own navbar, footer, scoped tokens). Page bodies
 * stay shared; identity stays brand-owned.
 */
export default async function ContentLayout({ children }: { children: React.ReactNode }) {
  const brand = await currentBrandProfile();
  if (brand.landingTemplate === "agile") {
    return <AgileContentShell>{children}</AgileContentShell>;
  }
  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />

      <main id="main-content" tabIndex={-1} className="flex-1">{children}</main>

      <Footer />
    </div>
  );
}
