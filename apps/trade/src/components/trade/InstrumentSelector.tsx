"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Star } from "lucide-react";
import { useForexStore } from "@/lib/store";
import { fmtPrice, fmtPct } from "@/lib/format";
import { InstrumentIcon } from "@/components/icons/InstrumentIcon";
import type { InstrumentCategory, InstrumentView } from "@/lib/types";
import { Input } from "@/components/ui/Input";

interface Props {
  activeSymbol: string;
  /** Optional control rendered at the right of the header strip (the rail's
   *  collapse toggle in the desktop workstation). */
  headerAction?: React.ReactNode;
}

const CATEGORY_ORDER: InstrumentCategory[] = ["FOREX", "COMMODITY", "INDEX", "CRYPTO", "STOCK"];
const CATEGORY_LABEL: Record<InstrumentCategory, string> = {
  FOREX: "Forex",
  COMMODITY: "Commodities",
  INDEX: "Indices",
  CRYPTO: "Crypto",
  STOCK: "Stocks",
};
const FAVORITES_KEY = "blckforest:watchlist-favorites";

/** Left rail: searchable, category-grouped watchlist of the live instrument
 *  list (store — hydrated from the server list, refreshed by the socket).
 *  Rows can be starred into a pinned Favorites group (persisted locally). */
export function InstrumentSelector({ activeSymbol, headerAction }: Props) {
  const router = useRouter();
  const instruments = useForexStore((s) => s.instruments);
  const [query, setQuery] = useState("");
  const [favorites, setFavorites] = useState<string[]>([]);

  // Customizable watchlist: stars persist per browser.
  useEffect(() => {
    try {
      const stored = JSON.parse(window.localStorage.getItem(FAVORITES_KEY) ?? "[]");
      if (Array.isArray(stored)) setFavorites(stored.filter((s) => typeof s === "string"));
    } catch { /* corrupted entry — start fresh */ }
  }, []);

  const toggleFavorite = (symbol: string) => {
    setFavorites((prev) => {
      const next = prev.includes(symbol) ? prev.filter((s) => s !== symbol) : [...prev, symbol];
      try {
        window.localStorage.setItem(FAVORITES_KEY, JSON.stringify(next));
      } catch { /* storage unavailable — this session only */ }
      return next;
    });
  };

  const filtered = useMemo(() => {
    const q = query.trim().toUpperCase();
    return instruments.filter((i) =>
      q ? i.symbol.includes(q) || i.name.toUpperCase().includes(q) : true,
    );
  }, [instruments, query]);

  const grouped = useMemo(() => {
    const map = new Map<InstrumentCategory, InstrumentView[]>();
    for (const cat of CATEGORY_ORDER) map.set(cat, []);
    for (const i of filtered) {
      const arr = map.get(i.category);
      if (arr) arr.push(i);
    }
    return map;
  }, [filtered]);

  const favoriteRows = useMemo(
    () => favorites.map((symbol) => instruments.find((i) => i.symbol === symbol)).filter((i): i is InstrumentView => Boolean(i)),
    [favorites, instruments],
  );

  const total = instruments.length;
  const noSearchMatches =
    query.trim() !== "" && CATEGORY_ORDER.every((cat) => (grouped.get(cat) ?? []).length === 0) && favoriteRows.length === 0;

  const row = (i: InstrumentView) => {
    const up = i.changePct >= 0;
    const active = i.symbol === activeSymbol;
    const isFavorite = favorites.includes(i.symbol);
    return (
      <div key={i.symbol} className="group/row">
        <div
          className={`w-full flex items-center justify-between gap-1.5 pl-1.5 pr-1 py-2 text-left transition-colors hover:bg-panel-2 ${
            active ? "bg-brand-soft" : ""
          }`}
        >
          <button
            onClick={() => router.push(`/trade/${i.symbol}`)}
            aria-current={active ? "true" : undefined}
            className="flex min-w-0 flex-1 items-center justify-between gap-1.5 text-left"
          >
            <div className="flex min-w-0 items-center gap-1.5">
              <InstrumentIcon symbol={i.symbol} size={16} />
              <div className="min-w-0">
                <div className={`text-(length:--term-text-xs) truncate leading-tight ${active ? "font-bold text-brand" : "font-semibold"}`}>
                  {i.symbol}
                </div>
                <div className="text-(length:--term-text-2xs) text-text-faint truncate leading-tight">
                  {i.name}
                </div>
              </div>
            </div>
            <div className="flex shrink-0 flex-col items-end leading-tight">
              <span className="text-(length:--term-text-xs) font-medium tnum">
                {fmtPrice(i.mid, i.digits)}
              </span>
              <span className={`text-(length:--term-text-2xs) tnum font-medium ${up ? "text-up" : "text-down"}`}>
                {fmtPct(i.changePct)}
              </span>
            </div>
          </button>
          <button
            type="button"
            onClick={() => toggleFavorite(i.symbol)}
            aria-label={isFavorite ? `Remove ${i.symbol} from favorites` : `Add ${i.symbol} to favorites`}
            aria-pressed={isFavorite}
            className={`shrink-0 rounded p-1.5 transition-colors focus-visible:outline-2 focus-visible:outline-brand ${
              isFavorite ? "text-brand" : "text-text-faint opacity-60 hover:opacity-100 hover:text-text"
            }`}
          >
            <Star size={13} strokeWidth={2} fill={isFavorite ? "currentColor" : "none"} aria-hidden />
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-panel">
      {/* Header strip: list title + count + the rail's collapse control. */}
      <div className="flex h-8 shrink-0 items-center gap-1.5 bg-panel-2 px-2">
        <span className="text-(length:--term-text-2xs) font-semibold uppercase tracking-wide text-text-faint">
          Markets
        </span>
        <span className="text-(length:--term-text-2xs) tnum text-text-faint">{total}</span>
        {headerAction && <span className="ml-auto flex items-center">{headerAction}</span>}
      </div>

      <div className="px-1.5 pt-1.5 pb-1">
        <div className="relative">
          <svg className="absolute left-2 top-1/2 -translate-y-1/2 text-text-faint" width="11" height="11" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
            <path d="m21 21-4.3-4.3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
          <label htmlFor="watchlist-search" className="sr-only">Search instruments</label>
          <Input
            id="watchlist-search"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search"
            className="h-7 pl-6 pr-2 text-(length:--term-text-xs) placeholder:text-text-faint"
          />
        </div>
      </div>

      <ul className="min-h-0 flex-1 overflow-y-auto">
        {favoriteRows.length > 0 && (
          <li>
            <div className="sticky top-0 z-10 bg-panel-2/60 px-1.5 py-0.5 text-(length:--term-text-2xs) font-semibold uppercase tracking-wide text-text-faint">
              Favorites
            </div>
            {favoriteRows.filter((i) => !query.trim() || filtered.includes(i)).map((i) => row(i))}
          </li>
        )}
        {CATEGORY_ORDER.map((cat) => {
          const items = grouped.get(cat) ?? [];
          if (items.length === 0) return null;
          return (
            <li key={cat}>
              <div className="bg-panel-2/60 px-1.5 py-0.5 text-(length:--term-text-2xs) font-semibold uppercase tracking-wide text-text-faint sticky top-0 z-10">
                {CATEGORY_LABEL[cat]}
              </div>
              {items.map((i) => row(i))}
            </li>
          );
        })}
        {instruments.length === 0 && (
          <li className="px-3 py-6 text-center text-text-faint text-xs" role="status">
            Loading instruments…
          </li>
        )}
        {noSearchMatches && (
          <li className="px-3 py-6 text-center text-text-faint text-xs">No instruments match your search.</li>
        )}
      </ul>
    </div>
  );
}

