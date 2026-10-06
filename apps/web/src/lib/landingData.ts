import { hub } from "@/server/engine/hub";
import type { InstrumentCategory, InstrumentView } from "@/lib/types";

/**
 * SERVER-ONLY landing-page data accessors.
 *
 * Reads live instruments from the engine hub — the same source as
 * GET /api/instruments — so server-rendered tables show real, current prices.
 * Client islands then poll /api/instruments to refresh just the numbers.
 *
 * ⚠️ This module imports the server-only hub (which depends on node:crypto).
 * Client components must NOT import from here — use landingUi.ts for the
 * client-safe constants and formatters instead.
 *
 * Safe to call from a Server Component (page.tsx is force-dynamic). If the hub
 * isn't ready yet (cold start), accessors return empty arrays / null rather
 * than throwing — sections render their empty state.
 */

// Re-export client-safe helpers for server-component convenience.
export {
  CATEGORY_ORDER,
  CATEGORY_LABEL,
  CATEGORY_TAGLINE,
  formatPrice,
  formatChange,
} from "@/lib/landingUi";
export type { InstrumentView, InstrumentCategory };

/** All instruments, projected to the public InstrumentView shape. */
export function getLandingInstruments(): InstrumentView[] {
  if (!hub.isReady()) return [];
  return hub.listInstruments().map((s) => hub.instrumentView(s));
}

/** Instruments for a single asset class. */
export function getInstrumentsByCategory(category: InstrumentCategory): InstrumentView[] {
  return getLandingInstruments().filter((i) => i.category === category);
}

/**
 * A representative featured instrument for the hero card. Stable per render —
 * prefers a liquid, recognizable market. Falls back to the first instrument.
 */
export function getFeaturedInstrument(): InstrumentView | null {
  const all = getLandingInstruments();
  if (all.length === 0) return null;
  const preferred = ["XAUUSD", "BTCUSD", "EURUSD", "ETHUSD"];
  for (const sym of preferred) {
    const found = all.find((i) => i.symbol === sym);
    if (found) return found;
  }
  return all[0];
}
