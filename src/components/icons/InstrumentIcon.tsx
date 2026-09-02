"use client";

import { ASSET_DIR, currencyFlag, instrumentImage } from "./instrumentAssets";

/**
 * InstrumentIcon — renders a circular badge for any of the 45 trading
 * instruments. Real imagery first (currency flags, crypto/index/stock logos
 * from the shared instrumentAssets map), with the inline SVG/CSS badges as
 * the fallback for anything unmapped — CSP-safe either way (local assets).
 *
 * Category designs:
 *  - Forex: two overlapping currency circles (base behind, quote front-right).
 *  - Crypto: single coin circle with brand colour + glyph.
 *  - Commodity: chemical-symbol circle with metallic/dark gradients.
 *  - Index: country/exchange coloured circle + abbreviation.
 *  - Stock: brand-coloured ticker circle.
 */

// ─── Currency definitions (forex) ────────────────────────────────────────────

interface CurrencyDef {
  bg: string;
  glyph: string;
}

const CURRENCIES: Record<string, CurrencyDef> = {
  USD: { bg: "#1a7f4e", glyph: "$" },
  EUR: { bg: "#1d4ed8", glyph: "€" },
  GBP: { bg: "#4338ca", glyph: "£" },
  JPY: { bg: "#b91c1c", glyph: "¥" },
  AUD: { bg: "#b45309", glyph: "A$" },
  CAD: { bg: "#b91c1c", glyph: "C$" },
  NZD: { bg: "#0f766e", glyph: "N$" },
  CHF: { bg: "#7f1d1d", glyph: "₣" },
};

// ─── Single-instrument definitions (non-forex) ────────────────────────────────

interface BadgeDef {
  bg: string;
  /** Glyph or short text shown inside the circle. */
  label: string;
  /** Text colour (defaults to white). */
  color?: string;
  /** Font size scale relative to circle diameter (default 0.4). */
  fontSize?: number;
}

const CRYPTO: Record<string, BadgeDef> = {
  BTCUSD: { bg: "#f7931a", label: "₿" },
  ETHUSD: { bg: "#627eea", label: "Ξ" },
  SOLUSD: { bg: "#9945ff", label: "◎" },
  XRPUSD: { bg: "#23292f", label: "✕" },
  ADAUSD: { bg: "#0033ad", label: "₳" },
  DOGEUSD: { bg: "#c2a633", label: "Ð" },
  LINKUSD: { bg: "#2a5ada", label: "⬡" },
  AVAXUSD: { bg: "#e84142", label: "▲" },
  MATICUSD: { bg: "#8247e5", label: "⬢" },
  // Bare asset tickers (wallet/deposit flows) — same brand identities.
  USDT: { bg: "#26a17b", label: "₮" },
  USDC: { bg: "#2775ca", label: "$" },
  BTC: { bg: "#f7931a", label: "₿" },
  ETH: { bg: "#627eea", label: "Ξ" },
};

const COMMODITIES: Record<string, BadgeDef> = {
  XAUUSD: { bg: "linear-gradient(135deg,#ffd700,#daa520)", label: "Au" },
  XAGUSD: { bg: "linear-gradient(135deg,#e8e8e8,#a9a9a9)", label: "Ag", color: "#333" },
  WTIUSD: { bg: "#1a1a1a", label: "Oil" },
  XBRUSD: { bg: "#2d2d2d", label: "Brt" },
  XPTUSD: { bg: "linear-gradient(135deg,#e5e4e2,#b9b9b9)", label: "Pt", color: "#333" },
  XPDUSD: { bg: "linear-gradient(135deg,#dadada,#9c9c9c)", label: "Pd", color: "#333" },
  NGUSD: { bg: "#0d6efd", label: "Gas", fontSize: 0.32 },
  HGUSD: { bg: "linear-gradient(135deg,#b87333,#8b4513)", label: "Cu" },
};

const INDICES: Record<string, BadgeDef> = {
  US30: { bg: "#1e3a8a", label: "DOW" },
  NAS100: { bg: "#0e7490", label: "NAS" },
  SPX500: { bg: "#1e3a8a", label: "S&P" },
  GER40: { bg: "#1a1a1a", label: "DAX" },
  UK100: { bg: "#1d4ed8", label: "FTSE" },
  FRA40: { bg: "#1e3a8a", label: "CAC" },
  JPN225: { bg: "#b91c1c", label: "日" },
  VIX: { bg: "#312e81", label: "VIX" },
};

const STOCKS: Record<string, BadgeDef> = {
  AAPL: { bg: "#a2aaad", label: "", color: "#333" },
  MSFT: { bg: "#00a4ef", label: "" },
  NVDA: { bg: "#76b900", label: "" },
  TSLA: { bg: "#cc0000", label: "T" },
};

// ─── Component ────────────────────────────────────────────────────────────────

interface InstrumentIconProps {
  symbol: string;
  /** Circle diameter in px. Default 20. */
  size?: number;
  className?: string;
}

export function InstrumentIcon({ symbol, size = 20, className = "" }: InstrumentIconProps) {
  const sym = symbol.toUpperCase();

  // Real logo for mapped singles (crypto, indices, commodities, stocks).
  const image = instrumentImage(sym);
  if (image) {
    return <ImageBadge src={ASSET_DIR + image} size={size} className={className} />;
  }
  // Real flags for mapped currency pairs.
  const flagBase = sym.length === 6 ? currencyFlag(sym.slice(0, 3)) : null;
  const flagQuote = sym.length === 6 ? currencyFlag(sym.slice(3, 6)) : null;
  if (flagBase && flagQuote) {
    return <FlagPair base={ASSET_DIR + flagBase} quote={ASSET_DIR + flagQuote} size={size} className={className} />;
  }
  // Inline-SVG badge fallback (forex glyph circles etc.).
  if (sym.length === 6 && CURRENCIES[sym.slice(0, 3)] && CURRENCIES[sym.slice(3, 6)]) {
    return <ForexBadge symbol={sym} size={size} className={className} />;
  }
  // Crypto / commodity / index / stock: single circle lookup.
  const def = CRYPTO[sym] ?? COMMODITIES[sym] ?? INDICES[sym] ?? STOCKS[sym];
  if (def) {
    return <SingleBadge def={def} size={size} className={className} />;
  }
  // Fallback: monogram circle.
  return <FallbackBadge symbol={sym} size={size} className={className} />;
}

// ─── Forex: two overlapping currency circles ──────────────────────────────────

function ForexBadge({ symbol, size, className }: { symbol: string; size: number; className: string }) {
  const base = CURRENCIES[symbol.slice(0, 3)]!;
  const quote = CURRENCIES[symbol.slice(3, 6)]!;
  const big = size; // base circle = full size
  const small = Math.round(size * 0.72); // quote circle slightly smaller, overlapping
  const offset = Math.round(size * 0.55); // front-right offset
  const glyphBig = Math.round(size * 0.4);
  const glyphSmall = Math.round(small * 0.4);

  return (
    <span
      className={`relative inline-flex shrink-0 ${className}`}
      style={{ width: offset + small, height: big }}
      aria-hidden="true"
    >
      {/* Base currency (behind, full size) */}
      <CurrencyCircle def={base} size={big} fontSize={glyphBig} />
      {/* Quote currency (front-right, smaller) */}
      <span className="absolute bottom-0" style={{ left: offset }}>
        <CurrencyCircle def={quote} size={small} fontSize={glyphSmall} />
      </span>
    </span>
  );
}

function CurrencyCircle({ def, size, fontSize }: { def: CurrencyDef; size: number; fontSize: number }) {
  return (
    <span
      className="inline-flex items-center justify-center rounded-full text-white font-bold shrink-0 ring-1 ring-border"
      style={{ width: size, height: size, background: def.bg, fontSize }}
    >
      {def.glyph}
    </span>
  );
}

// ─── Single badge (crypto / commodity / index / stock) ────────────────────────

function SingleBadge({ def, size, className }: { def: BadgeDef; size: number; className: string }) {
  const fontSize = Math.round(size * (def.fontSize ?? 0.36));
  return (
    <span
      className={`inline-flex items-center justify-center rounded-full font-bold shrink-0 ring-1 ring-border ${className}`}
      style={{
        width: size,
        height: size,
        background: def.bg,
        color: def.color ?? "#fff",
        fontSize,
      }}
      aria-hidden="true"
    >
      {def.label}
    </span>
  );
}

// ─── Real-imagery renderers ───────────────────────────────────────────────────

function ImageBadge({ src, size, className }: { src: string; size: number; className: string }) {
  return (
    <span
      className={`inline-flex items-center justify-center rounded-full bg-panel ring-1 ring-border shrink-0 ${className}`}
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- decorative instrument mark; the symbol sits adjacent */}
      <img src={src} alt="" loading="lazy" decoding="async" style={{ width: "62%", height: "62%", objectFit: "contain" }} />
    </span>
  );
}

function FlagPair({ base, quote, size, className }: { base: string; quote: string; size: number; className: string }) {
  const small = Math.round(size * 0.72);
  const offset = Math.round(size * 0.55);
  return (
    <span
      className={`relative inline-flex shrink-0 ${className}`}
      style={{ width: offset + small, height: size }}
      aria-hidden="true"
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- decorative currency flags; the symbol sits adjacent */}
      <img
        src={base}
        alt=""
        loading="lazy"
        decoding="async"
        className="relative z-10 rounded-full"
        style={{ width: size, height: size, objectFit: "cover", boxShadow: "0 0 0 1px var(--color-border)" }}
      />
      {/* eslint-disable-next-line @next/next/no-img-element -- decorative currency flags; the symbol sits adjacent */}
      <img
        src={quote}
        alt=""
        loading="lazy"
        decoding="async"
        className="absolute bottom-0 rounded-full"
        style={{ left: offset, width: small, height: small, objectFit: "cover", boxShadow: "0 0 0 1px var(--color-border)" }}
      />
    </span>
  );
}

// ─── Fallback (unknown instrument) ────────────────────────────────────────────

function FallbackBadge({ symbol, size, className }: { symbol: string; size: number; className: string }) {
  const mono = symbol.slice(0, 2).toUpperCase();
  const fontSize = Math.round(size * 0.36);
  return (
    <span
      className={`inline-flex items-center justify-center rounded-full font-bold shrink-0 ring-1 ring-border bg-panel-3 text-text-muted ${className}`}
      style={{ width: size, height: size, fontSize }}
      aria-hidden="true"
    >
      {mono}
    </span>
  );
}
