// GENERATED FILE — DO NOT EDIT.
// SOURCE: src/designs/<key>/design.ts
// REGENERATE: npm run platform -- registry generate
// This file is a read-only build artifact; CI fails if it drifts from its sources.


import type { DesignManifest } from "../../designs/contracts";
import { design as defaultDesign } from "../default/design";
import { design as gbfxsDesign } from "../gbfxs/design";

/** Every registered design manifest. */
export const DESIGN_MANIFESTS: Record<string, DesignManifest> = {
  [defaultDesign.key]: defaultDesign,
  [gbfxsDesign.key]: gbfxsDesign,
};
