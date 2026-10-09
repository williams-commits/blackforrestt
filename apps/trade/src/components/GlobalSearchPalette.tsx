"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Search } from "lucide-react";
import { Dialog } from "@/components/ui/Dialog";
import { InstrumentIcon } from "@/components/icons/InstrumentIcon";
import { useForexStore } from "@/lib/store";
import type { InstrumentCategory } from "@/lib/types";

interface PaletteInstrument {
  symbol: string;
  name: string;
  category: InstrumentCategory;
}

const CATEGORY_ORDER: InstrumentCategory[] = ["FOREX", "COMMODITY", "INDEX", "CRYPTO", "STOCK"];
const CATEGORY_LABEL: Record<InstrumentCategory, string> = {
  FOREX: "Forex",
  COMMODITY: "Commodities",
  INDEX: "Indices",
  CRYPTO: "Crypto",
  STOCK: "Stocks",
};

/** Open the global search palette from any surface (same event-bus pattern
 *  as the CRM palette — no provider, no prop drilling). */
export function openTradeSearch() {
  window.dispatchEvent(new CustomEvent("trade:open-search"));
}

/**
 * Global search palette: ⌘K / "/" opens a symbol-search dialog from anywhere
 * in the app (terminal, account portal, admin) and jumps straight to the
 * instrument in the terminal. Data prefers the live store (terminal pages,
 * filled by the WS snapshot); outside the terminal it fetches the catalog
 * from /api/instruments once per session.
 */
export function GlobalSearchPalette() {
  const router = useRouter();
  const { status } = useSession();
  const storeInstruments = useForexStore((s) => s.instruments);
  const [catalog, setCatalog] = useState<PaletteInstrument[] | null>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const instruments: PaletteInstrument[] = useMemo(
    () =>
      storeInstruments.length > 0
        ? storeInstruments.map((i) => ({ symbol: i.symbol, name: i.name, category: i.category }))
        : (catalog ?? []),
    [storeInstruments, catalog],
  );

  // First open outside the terminal: pull the catalog (cache for the session).
  useEffect(() => {
    if (!open || storeInstruments.length > 0 || catalog !== null) return;
    let cancelled = false;
    fetch("/api/instruments")
      .then((r) => (r.ok ? r.json() : { data: [] }))
      .then((body) => {
        if (!cancelled) setCatalog(Array.isArray(body?.data) ? body.data : []);
      })
      .catch(() => {
        if (!cancelled) setCatalog([]);
      });
    return () => {
      cancelled = true;
    };
  }, [open, storeInstruments.length, catalog]);

  useEffect(() => {
    if (status !== "authenticated") return;
    function onKey(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      const typing =
        ["INPUT", "TEXTAREA", "SELECT"].includes(target?.tagName ?? "") ||
        target?.isContentEditable === true;
      // ⌘K/Ctrl+K works everywhere; "/" only outside text entry (the
      // terminal's order tickets must receive the character untouched).
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen(true);
      } else if (event.key === "/" && !typing) {
        event.preventDefault();
        setOpen(true);
      }
    }
    function onOpen() {
      setOpen(true);
    }
    document.addEventListener("keydown", onKey);
    window.addEventListener("trade:open-search", onOpen);
    return () => {
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("trade:open-search", onOpen);
    };
  }, [status]);

  const flat = useMemo(() => {
    const q = query.trim().toUpperCase();
    const filtered = q
      ? instruments.filter((i) => i.symbol.includes(q) || i.name.toUpperCase().includes(q))
      : instruments;
    return filtered.slice(0, 40);
  }, [instruments, query]);

  const grouped = useMemo(() => {
    const map = new Map<InstrumentCategory, PaletteInstrument[]>();
    for (const cat of CATEGORY_ORDER) map.set(cat, []);
    for (const instrument of flat) {
      const arr = map.get(instrument.category);
      if (arr) arr.push(instrument);
    }
    return [...map.entries()].filter(([, list]) => list.length > 0);
  }, [flat]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  function go(symbol: string) {
    setOpen(false);
    setQuery("");
    router.push(`/trade/${symbol}`);
  }

  if (status !== "authenticated") return null;

  return (
    <Dialog
      open={open}
      onClose={() => setOpen(false)}
      icon={<Search size={14} />}
      title="Search"
      description="Jump to an instrument — ⌘K from anywhere"
      className="sm:max-w-md"
    >
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="shrink-0 border-b border-border px-3 py-2.5">
          <div className="relative">
            <Search
              size={13}
              aria-hidden
              className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-text-faint"
            />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "ArrowDown") {
                  event.preventDefault();
                  setActiveIndex((i) => Math.min(flat.length - 1, i + 1));
                } else if (event.key === "ArrowUp") {
                  event.preventDefault();
                  setActiveIndex((i) => Math.max(0, i - 1));
                } else if (event.key === "Enter") {
                  const hit = flat[activeIndex];
                  if (hit) {
                    event.preventDefault();
                    go(hit.symbol);
                  }
                }
              }}
              placeholder="Search symbol or name…"
              aria-label="Search instruments"
              // Radix focuses the dialog container; steal focus into the
              // field so typing works immediately.
              autoFocus
              className="h-9 w-full rounded-md border border-border bg-panel pl-8 pr-3 text-sm text-text outline-none transition placeholder:text-text-faint focus:border-brand focus:ring-2 focus:ring-brand/25"
            />
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto py-1" role="listbox" aria-label="Instruments">
          {instruments.length === 0 ? (
            <p className="px-4 py-6 text-center text-xs text-text-muted">Loading instruments…</p>
          ) : flat.length === 0 ? (
            <p className="px-4 py-6 text-center text-xs text-text-muted">No instruments match “{query.trim()}”.</p>
          ) : (
            grouped.map(([category, list]) => (
              <div key={category}>
                <p className="px-3 pb-0.5 pt-2 text-(length:--term-text-2xs) font-semibold uppercase tracking-wider text-text-faint">
                  {CATEGORY_LABEL[category]}
                </p>
                {list.map((instrument) => {
                  const index = flat.indexOf(instrument);
                  const active = index === activeIndex;
                  return (
                    <button
                      key={instrument.symbol}
                      type="button"
                      role="option"
                      aria-selected={active}
                      onMouseEnter={() => setActiveIndex(index)}
                      onClick={() => go(instrument.symbol)}
                      className={`flex w-full items-center gap-2.5 px-3 py-2 text-left transition-colors ${
                        active ? "bg-panel-2" : "hover:bg-panel-2/60"
                      }`}
                    >
                      <InstrumentIcon symbol={instrument.symbol} size={18} className="shrink-0" />
                      <span className="shrink-0 text-xs font-semibold text-text tnum">{instrument.symbol}</span>
                      <span className="min-w-0 flex-1 truncate text-xs text-text-muted">{instrument.name}</span>
                      <span className="shrink-0 text-(length:--term-text-2xs) text-text-faint">
                        {CATEGORY_LABEL[instrument.category]}
                      </span>
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>
        <p className="shrink-0 border-t border-border px-3 py-1.5 text-(length:--term-text-2xs) text-text-faint">
          ↑↓ to navigate · Enter to open · Esc to close
        </p>
      </div>
    </Dialog>
  );
}

/** Icon trigger for headers (account portal banner, terminal account bar). */
export function TradeSearchButton({ className = "" }: { className?: string }) {
  return (
    <button
      type="button"
      onClick={openTradeSearch}
      aria-label="Search instruments"
      className={`flex size-8 shrink-0 items-center justify-center rounded-md text-text-muted transition-colors hover:bg-panel-2 hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 ${className}`}
    >
      <Search size={15} />
    </button>
  );
}
