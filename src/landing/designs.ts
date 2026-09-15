/**
 * THE design registry — maps design keys to landing designs and public-page
 * shells.
 *
 * A domain's config (src/domains/<domain>/domain.config.ts) selects a
 * `landingDesign` and a `publicDesign` from the key registry
 * (src/landing/designKeys.ts — the records below are TYPED by those keys, so
 * TypeScript guarantees every registered key has a component here). Adding a
 * design = build it under src/landing/<design>/ + add its key to designKeys.ts
 * + a component here; adding a domain that reuses an existing design requires
 * NO design work at all.
 *
 *   DEFAULT DESIGN  — src/landing/blackforest/ (the standard architecture)
 *   CUSTOM DESIGNS  — src/landing/agile/      (fully custom composition that
 *                     still consumes the typed content contracts)
 *
 * Designs consume typed content (src/content/contracts.ts) assembled by the
 * domain content packages — never i18n catalogs directly for landing copy.
 */
import type { ComponentType, ReactNode } from "react";
import {
  DEFAULT_LANDING_DESIGN,
  DEFAULT_PUBLIC_DESIGN,
  LANDING_DESIGN_KEYS,
  PUBLIC_DESIGN_KEYS,
  type LandingDesignKey,
  type PublicDesignKey,
} from "./designKeys";
import { BlackForestLanding } from "./blackforest/BlackForestLanding";
import { AgileLanding } from "./agile/AgileLanding";
import { DefaultPublicShell } from "./blackforest/DefaultPublicShell";
import { AgileContentShell } from "./agile/AgileContentShell";

export { DEFAULT_LANDING_DESIGN, DEFAULT_PUBLIC_DESIGN };

/** Landing designs: async server components that internally resolve their
 *  domain's typed content and render their own section composition. */
const LANDING_DESIGNS: Record<LandingDesignKey, ComponentType> = {
  default: BlackForestLanding,
  agile: AgileLanding,
};

/** Public-page shells for the (content) route group (about, tools, analytics,
 *  education, legal, contact). Each shell receives the shared page bodies as
 *  children. */
const PUBLIC_SHELLS: Record<PublicDesignKey, ComponentType<{ children: ReactNode }>> = {
  default: DefaultPublicShell,
  agile: AgileContentShell,
};

/** The landing design for a key; unknown keys fall back to the default design
 *  so a bad config value can never blank the site. */
export function landingDesignFor(key: string | null | undefined): ComponentType {
  return LANDING_DESIGNS[(key ?? "") as LandingDesignKey] ?? LANDING_DESIGNS[DEFAULT_LANDING_DESIGN];
}

/** The public-page shell for a key (same fallback guarantee). */
export function publicShellFor(key: string | null | undefined): ComponentType<{ children: ReactNode }> {
  return PUBLIC_SHELLS[(key ?? "") as PublicDesignKey] ?? PUBLIC_SHELLS[DEFAULT_PUBLIC_DESIGN];
}

/** Design keys that actually exist — the domain registry validation gate
 *  consumes these (pure data, safe to import anywhere). */
export function landingDesignKeys(): string[] {
  return [...LANDING_DESIGN_KEYS];
}

export function publicDesignKeys(): string[] {
  return [...PUBLIC_DESIGN_KEYS];
}
