import Link from "next/link";
import type { MouseEvent } from "react";
import { InstrumentIcon } from "@/components/icons/InstrumentIcon";

/** Trade-terminal URL for a market symbol. */
export function tradeHref(symbol: string): string {
  return `/trade/${encodeURIComponent(symbol)}`;
}

/** Instrument icon + symbol linking to that market's trade terminal page. */
export function SymbolLink({ symbol, className = "" }: { symbol: string; className?: string }) {
  return (
    <Link
      href={tradeHref(symbol)}
      onClick={(event) => event.stopPropagation()}
      aria-label={`Open ${symbol} in the trade terminal`}
      className={`inline-flex items-center gap-1.5 hover:text-brand hover:underline ${className}`}
    >
      <InstrumentIcon symbol={symbol} size={14} />
      {symbol}
    </Link>
  );
}

/** Row-level click handler that opens the position's market in the trade
 *  terminal. Clicks on interactive elements inside the row (close buttons,
 *  inputs, nested links) are ignored. The SymbolLink inside each row remains
 *  the keyboard-accessible path to the same destination. */
export function rowNavigate(router: { push: (href: string) => void }, symbol: string) {
  return (event: MouseEvent<HTMLTableRowElement>) => {
    if (event.target instanceof Element && event.target.closest("button, a, input, select, textarea, label, [role=button]")) return;
    router.push(tradeHref(symbol));
  };
}
