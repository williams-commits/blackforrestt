/**
 * Shared date formatting — the single source of truth for dates across the
 * account portal and admin console. Replaces the five divergent formats that
 * previously coexisted (en-GB dates, en-US dates, MM/DD/YY, MM/DD HH:mm with
 * no year, raw toLocaleString()).
 *
 * All functions render in the user's active locale but with a stable shape
 * (day first vs month first follows the locale; time is always included in
 * fmtDateTime; fmtDate is date-only).
 */

function asDate(value: Date | string | number): Date {
  return value instanceof Date ? value : new Date(value);
}

/** Date only, e.g. "15 Aug 2026". */
export function fmtDate(value: Date | string | number): string {
  return asDate(value).toLocaleDateString(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

/** Date + time, e.g. "15 Aug 2026, 14:32". */
export function fmtDateTime(value: Date | string | number): string {
  const date = asDate(value);
  return `${date.toLocaleDateString(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
  })}, ${date.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}`;
}

/** Relative time: "just now", "5 min ago", "3 hr ago", "4 days ago". */
export function fmtAgo(value: Date | string | number): string {
  const diff = Date.now() - asDate(value).getTime();
  if (diff < 60_000) return "just now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} min ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)} hr ago`;
  if (diff < 30 * 86_400_000) return `${Math.floor(diff / 86_400_000)} days ago`;
  return fmtDate(value);
}

/** ISO yyyy-mm-dd for <input type="date"> values. */
export function toDateInputValue(value: Date | string | number): string {
  const d = asDate(value);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
