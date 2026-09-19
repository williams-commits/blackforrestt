// GENERATED FILE — DO NOT EDIT.
// SOURCE: src/domains/<key>/index.ts (content loaders)
// REGENERATE: npm run platform -- registry generate
// This file is a read-only build artifact; CI fails if it drifts from its sources.


import type { DomainContentLoaders } from "../../content/contracts";

/** Domain key → lazy content loaders (server-side only). */
export const DOMAIN_CONTENT: Record<string, () => Promise<DomainContentLoaders>> = {
  blackforrest: async () => (await import("../blackforrest")).contentLoaders,
  gbfxs: async () => (await import("../gbfxs")).contentLoaders,
  vistest: async () => (await import("../vistest")).contentLoaders,
};
