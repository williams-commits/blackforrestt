import { resolveCurrentDomain } from "@/domains/resolve";
import { publicShellFor } from "@/landing/designs";

/**
 * Shared layout for the marketing content pages (About, Tools, Analytics,
 * Education, Legal) — a thin brand dispatcher, mirroring src/app/page.tsx.
 *
 *   request host → resolveCurrentDomain() → domain's publicDesign key
 *     → design registry (src/landing/designs.ts) → public-page shell
 *
 * Each design family owns its chrome for these routes: the default design
 * keeps the light editorial navbar + footer; the agile design renders its
 * dark-institutional shell (own navbar, footer, scoped tokens). Page bodies
 * stay shared; identity stays design-owned.
 */
export default async function ContentLayout({ children }: { children: React.ReactNode }) {
  const { host } = await resolveCurrentDomain();
  const Shell = publicShellFor(host.publicDesign);
  return <Shell>{children}</Shell>;
}
