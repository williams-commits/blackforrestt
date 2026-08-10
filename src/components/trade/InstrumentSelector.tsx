"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useForexStore } from "@/lib/store";
import { fmtPrice, fmtPct } from "@/lib/format";
import { InstrumentIcon } from "@/components/icons/InstrumentIcon";
import type { InstrumentCategory } from "@/lib/types";

interface Props {
  activeSymbol: string;
}

const CATEGORY_ORDER: InstrumentCategory[] = ["FOREX", "COMMODITY", "INDEX", "CRYPTO", "STOCK"];
const CATEGORY_LABEL: Record<InstrumentCategory, string> = {
  FOREX: "Forex",
  COMMODITY: "Commodities",
  INDEX: "Indices",
  CRYPTO: "Crypto",
  STOCK: "Stocks",
};

/** Left sidebar: searchable list of instruments grouped by category. */
export function InstrumentSelector({ activeSymbol }: Props) {
  const router = useRouter();
  const instruments = useForexStore((s) => s.instruments);
  const [query, setQuery] = useState("");

  const grouped = useMemo(() => {
    const q = query.trim().toUpperCase();
    const filtered = instruments.filter((i) =>
      q ? i.symbol.includes(q) || i.name.toUpperCase().includes(q) : true,
    );
    const map = new Map<InstrumentCategory, typeof filtered>();
    for (const cat of CATEGORY_ORDER) map.set(cat, []);
    for (const i of filtered) {
      const arr = map.get(i.category);
      if (arr) arr.push(i);
    }
    return map;
  }, [instruments, query]);

  const total = instruments.length;

  return (
    <div className="flex flex-col h-full bg-panel">
      <div className="px-1.5 pt-1.5 pb-1">
        <div className="relative">
          <svg className="absolute left-2 top-1/2 -translate-y-1/2 text-text-faint" width="11" height="11" viewBox="0 0 24 24" fill="none">
            <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
            <path d="m21 21-4.3-4.3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search"
            className="w-full h-6 bg-canvas border border-border rounded pl-6 pr-2 text-[11px] outline-none focus:border-brand placeholder:text-text-faint"
          />
        </div>
      </div>

      <div className="flex items-center justify-between px-1.5 py-0.5 text-[9px] text-text-faint uppercase border-y border-border-soft bg-panel-2">
        <span>Symbol</span>
        <span>{total}</span>
      </div>

      <ul className="flex-1 overflow-y-auto">
        {CATEGORY_ORDER.map((cat) => {
          const items = grouped.get(cat) ?? [];
          if (items.length === 0) return null;
          return (
            <li key={cat}>
              <div className="px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-text-faint bg-canvas sticky top-0 z-10 border-b border-border-soft">
                {CATEGORY_LABEL[cat]}
              </div>
              {items.map((i) => {
                const up = i.changePct >= 0;
                return (
                  <div key={i.symbol}>
                    <button
                      onClick={() => router.push(`/trade/${i.symbol}`)}
                      className={`w-full flex items-center justify-between gap-1 px-1.5 py-3 text-left hover:bg-panel-2 transition-colors border-b border-border-soft ${
                        i.symbol === activeSymbol ? "bg-brand-soft" : ""
                      }`}
                    >
                      <div className="flex items-center gap-1.5 min-w-0">
                        <InstrumentIcon symbol={i.symbol} size={16} />
                        <div className="min-w-0">
                          <div className="text-[11px] font-semibold truncate leading-tight">{i.name}</div>
                          <div className="text-[9px] text-text-faint truncate leading-tight flex items-center gap-1">
                            <span>{i.symbol}</span>
                            <span aria-hidden="true">·</span>
                            <span>{fmtPrice(i.mid, i.digits)}</span>
                          </div>
                        </div>
                      </div>
                      <div className={`text-[9px] tnum font-medium leading-tight ${up ? "text-up" : "text-down"}`}>
                        {fmtPct(i.changePct)}
                      </div>
                    </button>
                  </div>
                );
              })}
            </li>
          );
        })}
        {instruments.length === 0 && (
          <li className="px-3 py-6 text-center text-text-faint text-xs">No instruments.</li>
        )}
      </ul>
    </div>
  );
}
