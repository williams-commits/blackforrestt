/**
 * Number formatting helpers shared by the UI.
 *
 * All functions are null-safe and trim trailing zeros for a clean look while
 * preserving full precision for large/small values.
 */

/** Format a number with up to `maxDp` decimals, trimming trailing zeros. */
export function fmtNum(v: number | null | undefined, maxDp = 8): string {
  if (v == null || !isFinite(v)) return "—";
  const fixed = v.toFixed(maxDp);
  // trim trailing zeros but keep at least the integer part
  return fixed.replace(/\.?0+$/, "") || "0";
}

/** Format a price for display using a market's precision. */
export function fmtPrice(v: number | null | undefined, precision: number): string {
  if (v == null || !isFinite(v)) return "—";
  return v.toLocaleString("en-US", {
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
  return sign + v.toFixed(dp) + "%";
}

/** Signed PnL string. */
export function fmtSigned(v: number | null | undefined, dp = 2): string {
  if (v == null || !isFinite(v)) return "—";
  const sign = v > 0 ? "+" : "";
  return sign + fmtNum(v, dp);
}
