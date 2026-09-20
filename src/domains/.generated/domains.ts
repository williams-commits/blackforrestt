// GENERATED FILE — DO NOT EDIT.
// SOURCE: src/domains/<key>/domain.config.ts
// REGENERATE: npm run platform -- registry generate
// This file is a read-only build artifact; CI fails if it drifts from its sources.


import type { DomainDefinition } from "../../platform/registry-types";
import { BLACKFOREST_DOMAIN } from "../blackforrest/domain.config";
import { GBFXS_DOMAIN } from "../gbfxs/domain.config";

/** Every registered domain manifest, priority order (first = default). */
export const DOMAINS: readonly DomainDefinition[] = [
  BLACKFOREST_DOMAIN,
  GBFXS_DOMAIN,
];
