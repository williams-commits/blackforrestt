"use client";

import { useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { clientTradeUrl } from "@/lib/branding";
import { InstrumentIcon } from "@/components/icons/InstrumentIcon";
import { useInstruments } from "@/components/landing/useInstruments";
import type { InstrumentCategory, InstrumentView } from "@/lib/types";
import { CATEGORY_LABEL, formatPrice, formatChange } from "@/lib/landingUi";

interface TradingPlaygroundProps {
  /** Server-rendered instrument list (initial values, avoids empty flash). */
  initial: InstrumentView[];
}

const CATEGORY_ORDER: InstrumentCategory[] = ["FOREX", "CRYPTO", "COMMODITY", "INDEX", "STOCK"];

const PRESET_QUERIES = [
  { label: "gold", q: "gold" },
  { label: "btc", q: "btc" },
  { label: "eur", q: "eur" },
  { label: "oil", q: "oil" },
  { label: "us30", q: "us30" },
];

/**
 * The trading playground — a code-styled prompt that reveals available market
 * instruments instantly as you type. No editor dependency: it's a styled input
 * with a mono font, a blinking prompt caret, and syntax-coloured live results.
 * Results group by category and each row links to the trade route.
 */
export function TradingPlayground({ initial }: TradingPlaygroundProps) {
  const t = useTranslations("playground");
  const instruments = useInstruments(initial, 3000);
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const grouped = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = q
      ? instruments.filter(
          (i) =>
            i.symbol.toLowerCase().includes(q) ||
            i.name.toLowerCase().includes(q) ||
            i.category.toLowerCase().includes(q),
        )
      : instruments;
    const map = new Map<InstrumentCategory, InstrumentView[]>();
    for (const cat of CATEGORY_ORDER) map.set(cat, []);
    for (const inst of filtered) {
      const bucket = map.get(inst.category);
      if (bucket) bucket.push(inst);
    }
    return CATEGORY_ORDER.map((cat) => ({ cat, items: map.get(cat) ?? [] })).filter(
      (g) => g.items.length > 0,
    );
  }, [instruments, query]);

  const totalShown = grouped.reduce((n, g) => n + g.items.length, 0);

  return (
    <div className="rounded-xl border border-border bg-canvas shadow-card overflow-hidden">
      {/* Window chrome */}
      <div className="flex items-center gap-1.5 h-9 px-3 bg-panel-2 border-b border-border">
        <span className="h-2.5 w-2.5 rounded-full bg-down/60" />
        <span className="h-2.5 w-2.5 rounded-full bg-brand/70" />
        <span className="h-2.5 w-2.5 rounded-full bg-up/60" />
        <span className="ml-3 text-[10px] font-mono text-text-faint">{t("windowTitle")}</span>
        <span className="ml-auto inline-flex items-center gap-1.5 text-[10px] font-mono text-up">
          <span className="h-1.5 w-1.5 rounded-full bg-up animate-pulse" /> {t("connected")}
        </span>
      </div>

      {/* Prompt input */}
      <div className="px-4 py-3 border-b border-border-soft bg-canvas">
        <label htmlFor="pg-input" className="sr-only">
          {t("searchLabel")}
        </label>
        <div className="flex items-center gap-2 font-mono text-sm">
          <span className="text-brand select-none" aria-hidden="true">$</span>
          <input
            id="pg-input"
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("placeholder")}
            spellCheck={false}
            autoComplete="off"
            className="flex-1 bg-transparent outline-none text-text placeholder:text-text-faint caret-brand"
          />
          <span className="text-[10px] text-text-faint hidden sm:inline">
            {t("matches", { count: totalShown })}
          </span>
        </div>

        {/* Preset chips */}
        <div className="mt-3 flex flex-wrap gap-1.5">
          {PRESET_QUERIES.map((p) => (
            <button
              key={p.label}
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                setQuery(p.q);
                inputRef.current?.focus();
              }}
              className="px-2 py-0.5 rounded border border-border bg-panel text-[11px] font-mono text-text-muted hover:text-brand hover:border-brand transition"
            >
              {p.label}
            </button>
          ))}
          {query && (
            <button
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                setQuery("");
                inputRef.current?.focus();
              }}
              className="px-2 py-0.5 rounded border border-border bg-panel text-[11px] font-mono text-text-muted hover:text-down transition"
            >
              {t("clear")}
            </button>
          )}
        </div>
      </div>

      {/* Results */}
      <div className="max-h-[420px] overflow-y-auto">
        {grouped.length === 0 ? (
          <div className="px-4 py-10 text-center font-mono text-sm text-text-faint">
            <div className="text-text-muted">{t("noMatch")} “{query}”</div>
            <div className="mt-1 text-xs">{t("noMatchHint")}</div>
          </div>
        ) : (
          grouped.map((g) => (
            <div key={g.cat}>
              <div className="sticky top-0 z-10 px-4 py-1.5 bg-panel-2 border-b border-border-soft text-[10px] font-mono uppercase tracking-widest text-text-faint flex justify-between">
                <span>{CATEGORY_LABEL[g.cat]}</span>
                <span>{g.items.length}</span>
              </div>
              <ul>
                {g.items.map((inst) => {
                  const up = inst.changePct >= 0;
                  return (
                    <li key={inst.symbol}>
                      <a
                        href={clientTradeUrl(`/trade/${inst.symbol}`)}
                        className="grid grid-cols-[minmax(0,1fr)_auto_auto_auto] items-center gap-x-4 px-4 py-2.5 hover:bg-panel-2 transition border-b border-border-soft last:border-0"
                      >
                        <span className="flex items-center gap-2 min-w-0">
                          <InstrumentIcon symbol={inst.symbol} size={18} />
                          <span className="font-mono text-sm font-semibold text-text">{inst.symbol}</span>
                          <span className="truncate text-xs text-text-muted font-sans">{inst.name}</span>
                        </span>
                        <span className="tnum font-mono text-xs text-down text-right">
                          {formatPrice(inst.bid, inst.digits)}
                        </span>
                        <span className="tnum font-mono text-xs text-up text-right">
                          {formatPrice(inst.ask, inst.digits)}
                        </span>
                        <span className={`tnum font-mono text-xs font-semibold text-right w-16 ${up ? "text-up" : "text-down"}`}>
                          {formatChange(inst.changePct)}
                        </span>
                      </a>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))
        )}
      </div>

      {/* Status bar */}
      <div className="flex items-center justify-between px-4 py-2 bg-panel-2 border-t border-border text-[10px] font-mono text-text-faint">
        <span>{t("clickToTrade")}</span>
        <span>{t("indexed", { count: instruments.length })}</span>
      </div>
    </div>
  );
}
