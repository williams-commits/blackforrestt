import type { InstrumentCategory } from "@/lib/types";

/**
 * Consistent line-style SVG marks for each asset class. Uses `currentColor` so
 * the icons track the theme (light + dim) automatically, matching the inline-SVG
 * convention used across the app (Navbar, ThemeToggle, VOD play buttons). Kept as
 * a component rather than image files for crispness at any size and zero asset
 * weight.
 */

interface IconProps {
  className?: string;
}

export function MarketIcon({ category, className = "" }: { category: InstrumentCategory; className?: string }) {
  switch (category) {
    case "FOREX":
      return <ForexIcon className={className} />;
    case "CRYPTO":
      return <CryptoIcon className={className} />;
    case "COMMODITY":
      return <CommodityIcon className={className} />;
    case "INDEX":
      return <IndexIcon className={className} />;
    case "STOCK":
      return <IndexIcon className={className} />;
    default:
      return <IndexIcon className={className} />;
  }
}

/** Forex — two circulating currencies. */
function ForexIcon({ className = "" }: IconProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 48 48"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="17" cy="17" r="9" />
      <circle cx="31" cy="31" r="9" />
      <path d="M14.5 14.5h5M17 13v3" />
      <path d="M28.5 32.5h5M31 31v3M28 28.5h6M28 35.5h6" />
      <path d="M24 22.5l1.8 2.5M26 26l1.8-2.5" />
    </svg>
  );
}

/** Crypto — a coin / blockchain node motif. */
function CryptoIcon({ className = "" }: IconProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 48 48"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="24" cy="24" r="15" />
      <path d="M19 16h6.5a4 4 0 0 1 0 8H19zM19 24h7a4 4 0 0 1 0 8h-7z" />
      <path d="M21 13v3M21 32v3M25 13v3M25 32v3" />
    </svg>
  );
}

/** Commodities — stacked bars (metals / energy). */
function CommodityIcon({ className = "" }: IconProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 48 48"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="8" y="28" width="8" height="12" rx="1.5" />
      <rect x="20" y="20" width="8" height="20" rx="1.5" />
      <rect x="32" y="12" width="8" height="28" rx="1.5" />
      <path d="M11 28l3-6 3 6M23 20l3-6 3 6" />
    </svg>
  );
}

/** Indices — a rising market line over a baseline. */
function IndexIcon({ className = "" }: IconProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 48 48"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M7 38h34" />
      <path d="M10 32l8-9 6 5 10-13" />
      <path d="M28 15h6v6" />
      <circle cx="18" cy="23" r="1.6" fill="currentColor" stroke="none" />
      <circle cx="24" cy="28" r="1.6" fill="currentColor" stroke="none" />
    </svg>
  );
}
