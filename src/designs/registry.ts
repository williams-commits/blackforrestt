/**
 * Design registry — thin consumer of the GENERATED manifest registry.
 *
 * Adding a design = create src/designs/<key>/ with a design.ts manifest, then
 * regenerate (`npm run platform -- registry generate`). No hand-maintained
 * key lists anywhere.
 */
import type { ComponentType } from "react";
import type { LandingDesignProps, PublicDesignProps } from "@/designs/contracts";
import { DESIGN_MANIFESTS } from "@/designs/.generated/designs";

export const DEFAULT_LANDING_DESIGN = "default";
export const DEFAULT_PUBLIC_DESIGN = "default";

export function designKeys(): string[] {
  return Object.keys(DESIGN_MANIFESTS);
}

export function landingDesignKeys(): string[] {
  return Object.keys(DESIGN_MANIFESTS);
}
export const LANDING_DESIGN_KEYS = landingDesignKeys() as unknown as readonly string[];
export const PUBLIC_DESIGN_KEYS = LANDING_DESIGN_KEYS;
export type LandingDesignKey = string;
export type PublicDesignKey = string;

export async function landingDesignFor(
  key: string | null | undefined,
): Promise<ComponentType<LandingDesignProps>> {
  const manifest = DESIGN_MANIFESTS[key ?? ""] ?? DESIGN_MANIFESTS[DEFAULT_LANDING_DESIGN]!;
  return manifest.landing();
}

export async function publicShellFor(
  key: string | null | undefined,
): Promise<ComponentType<PublicDesignProps>> {
  const manifest = DESIGN_MANIFESTS[key ?? ""] ?? DESIGN_MANIFESTS[DEFAULT_PUBLIC_DESIGN]!;
  return manifest.publicShell();
}
