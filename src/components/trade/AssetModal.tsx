"use client";

import { useEffect, useId, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Dialog } from "@/components/ui/Dialog";
import { Pagination } from "@/components/ui/Pagination";
import { useForexStore } from "@/lib/store";
import { fmtPct, fmtPrice } from "@/lib/format";
import { InstrumentIcon } from "@/components/icons/InstrumentIcon";
import type { InstrumentCategory, InstrumentView } from "@/lib/types";

interface Props {
  open: boolean;
  onClose: () => void;
  activeSymbol: string;
}

const PAGE_SIZE = 24;
const TABS: { key: InstrumentCategory | "ALL"; label: string }[] = [
  { key: "ALL", label: "All" },
  { key: "FOREX", label: "Currencies" },
  { key: "COMMODITY", label: "Commodities" },
  { key: "INDEX", label: "Indices" },
  { key: "CRYPTO", label: "Crypto" },
  { key: "STOCK", label: "Stocks" },
];

/** Searchable, paginated, live-updating instrument picker. */
export function AssetModal({ open, onClose, activeSymbol }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const instruments = useForexStore((state) => state.instruments);
  const interval = useForexStore((state) => state.interval);
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState<(typeof TABS)[number]["key"]>("ALL");
  const [page, setPage] = useState(1);
  const searchId = useId();

  useEffect(() => {
    if (!open) return;
    setQuery("");
    setTab("ALL");
    setPage(1);
  }, [open]);

  const filtered = useMemo(() => {
    const normalizedQuery = query.trim().toUpperCase();
    return instruments.filter((instrument) => {
      if (tab !== "ALL" && instrument.category !== tab) return false;
      if (!normalizedQuery) return true;
      return (
        instrument.symbol.toUpperCase().includes(normalizedQuery) ||
        instrument.name.toUpperCase().includes(normalizedQuery)
      );
    });
  }, [instruments, query, tab]);

  useEffect(() => setPage(1), [query, tab]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const visible = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  function selectInstrument(symbol: string): void {
    const params = new URLSearchParams(searchParams.toString());
    params.set("tf", interval);
    router.push(`/trade/${encodeURIComponent(symbol)}?${params.toString()}`);
    onClose();
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Assets"
      description="Search and select an instrument to open its trading chart."
      className="h-dvh max-w-5xl sm:h-[min(86dvh,50rem)]"
    >
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <div className="shrink-0 border-b border-border px-4 py-3 sm:px-5">
          <label htmlFor={searchId} className="sr-only">
            Search instruments
          </label>
          <div className="relative max-w-sm">
            <svg
              aria-hidden="true"
              className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-faint"
              width="13"
              height="13"
              viewBox="0 0 24 24"
              fill="none"
            >
              <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
              <path d="m21 21-4.3-4.3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
            <input
              id={searchId}
              autoFocus
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search symbol or instrument…"
              className="h-10 w-full rounded-md border border-border bg-panel-2 pl-8 pr-3 text-xs outline-none placeholder:text-text-faint focus:border-brand focus-visible:ring-1 focus-visible:ring-brand"
            />
          </div>
        </div>

        <div
          role="tablist"
          aria-label="Instrument categories"
          className="flex shrink-0 items-center gap-1 overflow-x-auto border-b border-border bg-panel px-4 py-2 sm:px-5"
        >
          {TABS.map((item) => {
            const selected = tab === item.key;
            return (
              <button
                key={item.key}
                type="button"
                role="tab"
                aria-selected={selected}
                tabIndex={selected ? 0 : -1}
                onClick={() => setTab(item.key)}
                className={`whitespace-nowrap rounded-md px-3 py-1.5 text-[11px] font-medium transition-colors focus-visible:outline focus-visible:outline-brand ${
                  selected ? "bg-brand text-white" : "text-text-muted hover:bg-panel-2 hover:text-text"
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </div>

        <div className="min-h-0 flex-1 touch-pan-y overflow-y-auto overscroll-contain p-3 sm:p-4">
          {instruments.length === 0 ? (
            <div role="status" className="flex min-h-72 items-center justify-center text-sm text-text-faint">
              Loading instruments…
            </div>
          ) : filtered.length === 0 ? (
            <div role="status" className="flex min-h-72 items-center justify-center text-sm text-text-faint">
              No instruments match your search.
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4">
              {visible.map((instrument) => (
                <AssetCard
                  key={instrument.symbol}
                  instrument={instrument}
                  active={instrument.symbol === activeSymbol}
                  onClick={() => selectInstrument(instrument.symbol)}
                />
              ))}
            </div>
          )}
        </div>

        <Pagination
          page={safePage}
          pageSize={PAGE_SIZE}
          totalItems={filtered.length}
          onPageChange={setPage}
          label="instruments"
          compact
        />
      </div>
    </Dialog>
  );
}

function AssetCard({
  instrument,
  active,
  onClick,
}: {
  instrument: InstrumentView;
  active: boolean;
  onClick: () => void;
}) {
  const up = instrument.changePct >= 0;
  const slashIndex = instrument.symbol.includes("/") ? instrument.symbol.indexOf("/") : -1;
  const [base, quote] =
    slashIndex > 0
      ? [instrument.symbol.slice(0, slashIndex), instrument.symbol.slice(slashIndex + 1)]
      : instrument.symbol.length === 6
        ? [instrument.symbol.slice(0, 3), instrument.symbol.slice(3)]
        : [instrument.symbol, ""];

  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? "true" : undefined}
      aria-label={`${instrument.name}, ${fmtPrice(instrument.mid, instrument.digits)}, ${fmtPct(instrument.changePct)}`}
      className={`group flex min-h-24 flex-col gap-1 rounded-lg border p-3 text-left transition-all hover:shadow-sm focus-visible:outline focus-visible:outline-brand ${
        active ? "border-brand bg-brand-soft" : "border-border bg-canvas hover:border-text-faint"
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <InstrumentIcon symbol={instrument.symbol} size={20} />
          <span className="text-xs font-semibold tracking-tight">
            {base}
            {quote ? <span className="text-text-faint"> / {quote}</span> : null}
          </span>
        </div>
        <span className="text-[8px] font-medium uppercase text-text-faint">{instrument.category}</span>
      </div>
      <span className="truncate text-[9px] text-text-faint">{instrument.name}</span>
      <div className="mt-auto flex items-baseline justify-between gap-2">
        <span className={`text-sm font-bold tnum ${up ? "text-up" : "text-down"}`}>
          {fmtPrice(instrument.mid, instrument.digits)}
        </span>
        <span className={`text-[10px] font-medium tnum ${up ? "text-up" : "text-down"}`}>
          {fmtPct(instrument.changePct)}
        </span>
      </div>
    </button>
  );
}
