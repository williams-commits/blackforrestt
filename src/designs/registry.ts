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

/** Every registered design key (tests assert against the generated truth). */
export function landingDesignKeys(): string[] {
  return Object.keys(DESIGN_MANIFESTS);
}

export async function landingDesignFor(
  key: string | null | undefined,
): Promise<ComponentType<LandingDesignProps>> {
  const manifest = DESIGN_MANIFESTS[key ?? ""] ?? DESIGN_MANIFESTS["default"]!;
  return manifest.landing();
}

export async function publicShellFor(
  key: string | null | undefined,
): Promise<ComponentType<PublicDesignProps>> {
  const manifest = DESIGN_MANIFESTS[key ?? ""] ?? DESIGN_MANIFESTS["default"]!;
  return manifest.publicShell();
}
