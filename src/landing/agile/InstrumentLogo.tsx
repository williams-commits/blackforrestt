import { MarketIcon } from "@/components/landing/MarketIcons";
import { ASSET_DIR, currencyFlag, instrumentImage } from "@/components/icons/instrumentAssets";
import type { InstrumentCategory } from "@/lib/types";

/**
 * InstrumentLogo — the Agile landing's instrument token, rendered from the
 * SAME real-imagery map as the shared InstrumentIcon (one source of truth in
 * instrumentAssets). Sized by HEIGHT only: currency pairs are wider than
 * square (two overlapped flags) and must never sit inside a fixed-width
 * box — that clipped the pair and spilled the quote flag onto the adjacent
 * name. Singles render their own square chip. Falls back to the shared
 * category icon. Decorative — the symbol is always rendered as text beside
 * it.
 */
export function InstrumentLogo({
  symbol,
  base,
  quote,
  category,
  className = "",
}: {
  symbol: string;
  base: string;
  quote: string;
  category: InstrumentCategory;
  className?: string;
}) {
  const single = instrumentImage(symbol);
  if (single) {
    return (
      <span className={`inline-flex shrink-0 ${className}`}>
        <span className="inline-flex h-full aspect-square items-center justify-center rounded-full border border-white/10 bg-white/[0.05]">
          {/* eslint-disable-next-line @next/next/no-img-element -- decorative instrument mark; the symbol sits adjacent */}
          <img src={ASSET_DIR + single} alt="" loading="lazy" decoding="async" className="h-[62%] w-[62%] object-contain" />
        </span>
      </span>
    );
  }

  const flagBase = currencyFlag(base);
  const flagQuote = currencyFlag(quote);
  if (flagBase && flagQuote) {
    return (
      <span className={`inline-flex shrink-0 items-center ${className}`}>
        {/* eslint-disable-next-line @next/next/no-img-element -- decorative currency flags; the symbol sits adjacent */}
        <img
          src={ASSET_DIR + flagBase}
          alt=""
          loading="lazy"
          decoding="async"
          className="relative z-10 aspect-square h-full w-auto rounded-full object-cover ring-1 ring-black/40"
        />
        {/* eslint-disable-next-line @next/next/no-img-element -- decorative currency flags; the symbol sits adjacent */}
        <img
          src={ASSET_DIR + flagQuote}
          alt=""
          loading="lazy"
          decoding="async"
          className="-ml-[26%] aspect-square h-[74%] w-auto rounded-full object-cover ring-1 ring-black/40"
        />
      </span>
    );
  }

  // Unmapped instrument — the shared category mark keeps the slot intact.
  return (
    <span className={`inline-flex shrink-0 ${className}`}>
      <span className="inline-flex h-full aspect-square items-center justify-center">
        <MarketIcon category={category} className="h-full w-full" />
      </span>
    </span>
  );
}
