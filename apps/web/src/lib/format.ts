/**
 * Number formatting helpers shared by the UI.
 *
 * All functions are null-safe and trim trailing zeros for a clean look while
 * preserving full precision for large/small values.
 *
 * Locale-aware: the active locale is set per-render via `setFormatLocale()`
 * (called from the FormatLocaleBridge client component, which reads the
 * next-intl locale). Until then the default "en" formatting applies. This
 * keeps every existing call site unchanged (no signature changes) while
 * producing locale-correct decimal separators (e.g. "," in DE/ES).
 */

/** The BCP-47 locale used for formatting. Defaults to "en". */
let activeLocale = "en";

/**
 * Set the active formatting locale. Called once per render from
 * FormatLocaleBridge (a client component). Safe to call repeatedly.
 */
export function setFormatLocale(locale: string): void {
  activeLocale = locale || "en";
}

/** Current formatting locale (for diagnostics). */
export function getFormatLocale(): string {
  return activeLocale;
}

/** Format a number with up to `maxDp` decimals, trimming trailing zeros. */
export function fmtNum(v: number | null | undefined, maxDp = 8): string {
  if (v == null || !isFinite(v)) return "—";
  if (activeLocale === "en") {
    const fixed = v.toFixed(maxDp);
    // trim trailing zeros but keep at least the integer part
    return fixed.replace(/\.?0+$/, "") || "0";
  }
  // Non-en: use Intl so decimal/grouping separators localize, then trim
  // trailing zeros (Intl doesn't trim by default).
  const s = new Intl.NumberFormat(activeLocale, {
    minimumFractionDigits: 0,
    maximumFractionDigits: maxDp,
  }).format(v);
  return s;
}

/** Format a price for display using a market's precision. */
export function fmtPrice(v: number | null | undefined, precision: number): string {
  if (v == null || !isFinite(v)) return "—";
  return v.toLocaleString(activeLocale, {
    minimumFractionDigits: precision,
    maximumFractionDigits: precision,
  });
}

/** Format a quantity, trimming zeros. */
export function fmtQty(v: number | null | undefined, precision = 6): string {
  return fmtNum(v, precision);
}

/** Compact USD-style formatting for large volumes (1.2M, 3.4K). */
export function fmtCompact(v: number | null | undefined): string {
  if (v == null || !isFinite(v)) return "—";
  if (activeLocale !== "en") {
    // Use Intl compact notation for localized suffixes/separators.
    return new Intl.NumberFormat(activeLocale, {
      notation: "compact",
      maximumFractionDigits: 2,
    }).format(v);
  }
  const abs = Math.abs(v);
  if (abs >= 1e9) return (v / 1e9).toFixed(2) + "B";
  if (abs >= 1e6) return (v / 1e6).toFixed(2) + "M";
  if (abs >= 1e3) return (v / 1e3).toFixed(2) + "K";
  return fmtNum(v, 2);
}

/** Signed percent with + / − prefix. */
export function fmtPct(v: number | null | undefined, dp = 2): string {
  if (v == null || !isFinite(v)) return "—";
  const sign = v > 0 ? "+" : "";
  return sign + fmtNum(v, dp) + "%";
}

/** Signed PnL string. */
export function fmtSigned(v: number | null | undefined, dp = 2): string {
  if (v == null || !isFinite(v)) return "—";
  const sign = v > 0 ? "+" : "";
  return sign + fmtNum(v, dp);
}
