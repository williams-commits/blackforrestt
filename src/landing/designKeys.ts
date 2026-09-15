/**
 * Design key registry (pure data — importable anywhere, including tests and
 * the domain registry validation gate).
 *
 * These are the design keys a domain's config may select. The component
 * mappings live in src/landing/designs.ts, which TYPES its records by these
 * keys — TypeScript enforces that every key below has a component and no
 * unregistered key exists. Keep this list and designs.ts in one commit.
 */

/** Landing designs (apex "/" page). */
export const LANDING_DESIGN_KEYS = ["default", "agile"] as const;
export type LandingDesignKey = (typeof LANDING_DESIGN_KEYS)[number];

/** Public-page shells ((content) route group chrome). */
export const PUBLIC_DESIGN_KEYS = ["default", "agile"] as const;
export type PublicDesignKey = (typeof PUBLIC_DESIGN_KEYS)[number];

export const DEFAULT_LANDING_DESIGN: LandingDesignKey = "default";
export const DEFAULT_PUBLIC_DESIGN: PublicDesignKey = "default";
