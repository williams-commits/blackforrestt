"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { KeyboardEvent, PointerEvent } from "react";
import {
  ChevronDown,
  GripVertical,
  Maximize2,
  Minimize2,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTheme } from "@/components/ThemeProvider";
import { Button } from "@/components/ui/Button";
import { ChipGroup } from "@/components/ui/ChipGroup";
import { InstrumentIcon } from "@/components/icons/InstrumentIcon";
import { useForexStore } from "@/lib/store";
import { TIMEFRAMES, type CandleInterval, type InstrumentView, type Quote } from "@/lib/types";
import { fmtPrice } from "@/lib/format";
import { isExecutableQuote } from "@/lib/marketFreshness";
import { tradingViewSymbolFor } from "@/lib/tradingViewSymbols";

interface Props {
  instrument: InstrumentView;
  marketDataConnected: boolean;
  marketDataMode: string;
  onSwitchInstrument?: () => void;
  onOpenTrade?: (side: "BUY" | "SELL") => void;
}

const TIMEFRAME_STORAGE_KEY = "blckforest:chart-timeframe";
const TRADINGVIEW_INTERVALS: Record<CandleInterval, string> = {
  "1m": "1",
  "5m": "5",
  "15m": "15",
  "1h": "60",
  "4h": "240",
  "1d": "D",
};

function isInterval(value: string | null): value is CandleInterval {
  return value != null && (TIMEFRAMES as readonly string[]).includes(value);
}

export function ChartPanel({
  instrument,
  marketDataConnected,
  marketDataMode,
  onSwitchInstrument,
  onOpenTrade,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { theme } = useTheme();
  const panelRef = useRef<HTMLDivElement>(null);
  const interval = useForexStore((state) => state.interval);
  const setInterval = useForexStore((state) => state.setInterval);
  const quote = useForexStore((state) => state.quote);
  const [now, setNow] = useState(0);
  const [fullscreen, setFullscreen] = useState(false);
  const tradingViewSymbol = tradingViewSymbolFor(instrument.symbol, instrument.category);
  const liveQuote =
    marketDataConnected && isExecutableQuote(quote, instrument.symbol, now || Date.now())
      ? quote
      : null;

  useEffect(() => {
    setNow(Date.now());
    const timer = window.setInterval(() => setNow(Date.now()), 1_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const queryInterval = searchParams.get("tf");
    const storedInterval = window.localStorage.getItem(TIMEFRAME_STORAGE_KEY);
    const preferred = isInterval(queryInterval)
      ? queryInterval
      : isInterval(storedInterval)
        ? storedInterval
        : null;
    if (preferred && preferred !== useForexStore.getState().interval) setInterval(preferred);
  }, [searchParams, setInterval]);

  useEffect(() => {
    const handleFullscreen = () => setFullscreen(document.fullscreenElement === panelRef.current);
    document.addEventListener("fullscreenchange", handleFullscreen);
    return () => document.removeEventListener("fullscreenchange", handleFullscreen);
  }, []);

  const selectTimeframe = useCallback(
    (next: CandleInterval) => {
      if (next === interval) return;
      window.localStorage.setItem(TIMEFRAME_STORAGE_KEY, next);
      setInterval(next);
      const params = new URLSearchParams(searchParams.toString());
      params.set("tf", next);
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [interval, pathname, router, searchParams, setInterval],
  );

  const toggleFullscreen = async () => {
    const panel = panelRef.current;
    if (!panel) return;
    if (document.fullscreenElement === panel) await document.exitFullscreen();
    else await panel.requestFullscreen();
  };

  return (
    <div
      ref={panelRef}
      data-testid="professional-chart-panel"
      className={`flex h-full min-h-112 flex-col overflow-hidden bg-canvas shadow-panel lg:min-h-0 ${
        fullscreen ? "rounded-none" : "rounded-xl"
      }`}
    >
      <div className="flex shrink-0 flex-col gap-1.5 bg-panel-2 px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          {onSwitchInstrument ? (
            <button
              type="button"
              onClick={onSwitchInstrument}
              aria-haspopup="dialog"
              title="Switch instrument"
              className="flex min-w-0 items-center gap-2 rounded-md px-1.5 py-1 transition-colors hover:bg-panel-2 focus-visible:outline-2 focus-visible:outline-brand"
            >
              <InstrumentIcon symbol={instrument.symbol} size={20} />
              <span className="text-sm font-bold tracking-tight">{instrument.symbol}</span>
              <span className="hidden min-w-0 truncate text-(length:--term-text-2xs) font-medium text-text-faint sm:inline">
                {instrument.name}
              </span>
              <span className="rounded bg-brand-soft px-1.5 py-0.5 text-(length:--term-text-2xs) font-medium uppercase text-brand">
                {instrument.category}
              </span>
              <ChevronDown size={13} aria-hidden className="shrink-0 text-text-faint" />
            </button>
          ) : (
            <>
              <InstrumentIcon symbol={instrument.symbol} size={20} />
              <span className="text-sm font-bold tracking-tight">{instrument.symbol}</span>
              <span className="text-(length:--term-text-2xs) font-medium text-text-faint">{instrument.name}</span>
              <span className="rounded bg-brand-soft px-1.5 py-0.5 text-(length:--term-text-2xs) font-medium uppercase text-brand">
                {instrument.category}
              </span>
            </>
          )}
          {liveQuote ? (
            <span className="flex items-baseline gap-1.5">
              <span className="text-base font-bold leading-none tabular-nums text-text">
                {fmtPrice(liveQuote.mid, instrument.digits)}
              </span>
              {liveQuote.changePct !== 0 ? (
                <span className={`text-(length:--term-text-2xs) font-semibold leading-none tabular-nums ${
                  liveQuote.changePct > 0 ? "text-up" : "text-down"
                }`}>
                  {liveQuote.changePct > 0 ? "▲" : "▼"} {Math.abs(liveQuote.changePct).toFixed(2)}%
                </span>
              ) : null}
            </span>
          ) : (
            <span className="text-xs font-medium text-text-faint">Quote unavailable</span>
          )}
          <span
            role="status"
            title="TradingView supplies chart data. App market data remains the source for quotes and order execution."
            className="inline-flex shrink-0 items-center rounded bg-panel-3 px-1.5 py-0.5 text-(length:--term-text-2xs) text-text-muted"
          >
            TradingView chart
          </span>
          <span className="hidden text-(length:--term-text-2xs) text-text-faint xl:inline">
            App quote · {marketDataMode === "finnhub" ? "Finnhub" : marketDataMode}
          </span>
        </div>

        <div className="flex min-w-0 items-center justify-between gap-2 overflow-x-auto sm:justify-end">
          <ChipGroup
            ariaLabel="Chart timeframe"
            size="sm"
            value={interval}
            onChange={selectTimeframe}
            options={TIMEFRAMES.map((timeframe) => ({ value: timeframe, label: timeframe }))}
          />
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={fullscreen ? "Exit full screen" : "Full screen"}
            title={fullscreen ? "Exit full screen" : "Full screen"}
            onClick={() => void toggleFullscreen()}
          >
            {fullscreen ? <Minimize2 size={15} aria-hidden /> : <Maximize2 size={15} aria-hidden />}
          </Button>
        </div>
      </div>

      <div className="relative min-h-112 flex-1 lg:min-h-0">
        {tradingViewSymbol ? (
          <TradingViewChart
            key={`${tradingViewSymbol}-${interval}-${theme}`}
            symbol={tradingViewSymbol}
            interval={interval}
            theme={theme === "dim" ? "dark" : "light"}
          />
        ) : (
          <div
            className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-canvas p-6 text-center"
            role="status"
          >
            <p className="text-sm font-semibold text-text">TradingView symbol unavailable</p>
            <p className="max-w-sm text-xs text-text-muted">
              No TradingView market is configured for {instrument.symbol}. The chart is unavailable for this instrument.
            </p>
          </div>
        )}
        {onOpenTrade ? (
          <FloatingTradeControls
            instrument={instrument}
            liveQuote={liveQuote}
            onOpenTrade={onOpenTrade}
          />
        ) : null}
      </div>
    </div>
  );
}

function TradingViewChart({
  symbol,
  interval,
  theme,
}: {
  symbol: string;
  interval: CandleInterval;
  theme: "dark" | "light";
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    setStatus("loading");
    const widgetContainer = document.createElement("div");
    widgetContainer.className = "tradingview-widget-container";
    widgetContainer.style.height = "100%";
    widgetContainer.style.width = "100%";

    const widget = document.createElement("div");
    widget.className = "tradingview-widget-container__widget";
    widget.style.height = "calc(100% - 24px)";
    widget.style.width = "100%";

    const attribution = document.createElement("div");
    attribution.className = "tradingview-widget-copyright";
    attribution.style.height = "24px";
    attribution.style.padding = "4px 10px 0";
    attribution.style.fontSize = "10px";
    const attributionLink = document.createElement("a");
    attributionLink.href = `https://www.tradingview.com/symbols/${encodeURIComponent(symbol.split(":").at(-1) ?? symbol)}/`;
    attributionLink.target = "_blank";
    attributionLink.rel = "noopener nofollow";
    attributionLink.textContent = "TradingView";
    attribution.append("Chart by ", attributionLink);

    const script = document.createElement("script");
    script.type = "text/javascript";
    script.async = true;
    script.src = "https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js";
    script.textContent = JSON.stringify({
      autosize: true,
      symbol,
      interval: TRADINGVIEW_INTERVALS[interval],
      timezone: "Etc/UTC",
      theme,
      style: "1",
      locale: "en",
      allow_symbol_change: false,
      calendar: false,
      details: false,
      hotlist: false,
      hide_side_toolbar: true,
      hide_top_toolbar: true,
      hide_legend: false,
      save_image: false,
      withdateranges: false,
      support_host: "https://www.tradingview.com",
    });
    const handleLoad = () => setStatus("ready");
    const handleError = () => setStatus("error");
    script.addEventListener("load", handleLoad);
    script.addEventListener("error", handleError);

    widgetContainer.append(widget, attribution, script);
    container.replaceChildren(widgetContainer);

    return () => {
      script.removeEventListener("load", handleLoad);
      script.removeEventListener("error", handleError);
      container.replaceChildren();
    };
  }, [interval, retry, symbol, theme]);

  return (
    <div data-testid="tradingview-chart" className="absolute inset-0 w-full bg-canvas">
      <div ref={containerRef} className="absolute inset-0" />
      {status === "loading" ? (
        <div role="status" className="absolute inset-x-0 bottom-8 z-10 flex justify-center">
          <span className="rounded bg-canvas/90 px-3 py-2 text-xs text-text-muted shadow-card">
            Loading TradingView chart…
          </span>
        </div>
      ) : status === "error" ? (
        <div role="alert" className="absolute inset-x-0 bottom-8 z-10 flex justify-center">
          <div className="flex items-center gap-2 rounded bg-canvas/95 px-3 py-2 text-xs text-text-muted shadow-card">
            <span>TradingView could not load this chart.</span>
            <Button type="button" variant="outline" size="sm" onClick={() => setRetry((value) => value + 1)}>
              Retry
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function FloatingTradeControls({
  instrument,
  liveQuote,
  onOpenTrade,
}: {
  instrument: InstrumentView;
  liveQuote: Quote | null;
  onOpenTrade: (side: "BUY" | "SELL") => void;
}) {
  const controlsRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ pointerId: number; clientX: number; clientY: number; left: number; top: number } | null>(null);
  const [position, setPosition] = useState<{ left: number; top: number } | null>(null);

  const clampPosition = useCallback((left: number, top: number) => {
    const controls = controlsRef.current;
    const bounds = controls?.parentElement?.getBoundingClientRect();
    if (!controls || !bounds) return { left, top };
    return {
      left: Math.min(Math.max(8, bounds.width - controls.offsetWidth - 8), Math.max(8, left)),
      top: Math.min(Math.max(8, bounds.height - controls.offsetHeight - 8), Math.max(8, top)),
    };
  }, []);

  useEffect(() => {
    const parent = controlsRef.current?.parentElement;
    if (!parent) return;
    const observer = new ResizeObserver(() => {
      setPosition((current) => current ? clampPosition(current.left, current.top) : current);
    });
    observer.observe(parent);
    return () => observer.disconnect();
  }, [clampPosition]);

  const beginDrag = (event: PointerEvent<HTMLButtonElement>) => {
    if (event.button !== 0) return;
    const controls = controlsRef.current;
    const bounds = controls?.parentElement?.getBoundingClientRect();
    const rect = controls?.getBoundingClientRect();
    if (!controls || !bounds || !rect) return;

    event.preventDefault();
    setPosition(clampPosition(rect.left - bounds.left, rect.top - bounds.top));
    dragRef.current = {
      pointerId: event.pointerId,
      clientX: event.clientX,
      clientY: event.clientY,
      left: rect.left - bounds.left,
      top: rect.top - bounds.top,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const moveControls = (event: PointerEvent<HTMLButtonElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    setPosition(clampPosition(
      drag.left + event.clientX - drag.clientX,
      drag.top + event.clientY - drag.clientY,
    ));
  };

  const endDrag = (event: PointerEvent<HTMLButtonElement>) => {
    if (dragRef.current?.pointerId === event.pointerId) dragRef.current = null;
  };

  const nudgeControls = (event: KeyboardEvent<HTMLButtonElement>) => {
    const offsets: Record<string, [number, number]> = {
      ArrowLeft: [-12, 0],
      ArrowRight: [12, 0],
      ArrowUp: [0, -12],
      ArrowDown: [0, 12],
    };
    const offset = offsets[event.key];
    if (!offset) return;
    event.preventDefault();
    const rect = controlsRef.current?.getBoundingClientRect();
    const bounds = controlsRef.current?.parentElement?.getBoundingClientRect();
    if (!rect || !bounds) return;
    setPosition(clampPosition(
      (position?.left ?? rect.left - bounds.left) + offset[0],
      (position?.top ?? rect.top - bounds.top) + offset[1],
    ));
  };

  return (
    <div
      ref={controlsRef}
      data-testid="floating-trade-controls"
      className="pointer-events-auto absolute right-3 top-3 z-20 w-52 select-none overflow-hidden rounded-xl border border-border-soft bg-canvas/95 shadow-xl backdrop-blur-md"
      style={position ? { left: position.left, top: position.top, right: "auto" } : undefined}
    >
      <div className="flex h-7 items-center justify-between bg-panel/80 px-2.5">
        <span className="flex items-center gap-1.5 text-(length:--term-text-2xs) font-semibold uppercase tracking-wide text-text-faint">
          <span className={`h-1.5 w-1.5 rounded-full ${liveQuote ? "bg-up" : "bg-down"}`} aria-hidden />
          Spread
          <span className="tabular-nums text-text-muted">
            {liveQuote ? fmtPrice(liveQuote.ask - liveQuote.bid, instrument.digits) : "—"}
          </span>
        </span>
        <button
          type="button"
          aria-label="Move trade shortcuts; use arrow keys to reposition"
          title="Drag to reposition, or use arrow keys"
          onPointerDown={beginDrag}
          onPointerMove={moveControls}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          onKeyDown={nudgeControls}
          className="touch-none cursor-grab rounded p-1 text-text-faint transition-colors hover:bg-panel-3 hover:text-text active:cursor-grabbing focus-visible:outline-2 focus-visible:outline-brand"
        >
          <GripVertical size={13} strokeWidth={2} aria-hidden />
        </button>
      </div>
      <div className="grid grid-cols-2 gap-1.5 p-1.5">
        <Button
          type="button"
          variant="sell"
          size="sm"
          aria-label={liveQuote ? `Open sell ticket at ${fmtPrice(liveQuote.bid, instrument.digits)}` : "Open sell ticket — live quote unavailable"}
          onClick={() => onOpenTrade("SELL")}
          className="h-11 min-w-0 flex-col gap-0 px-1 py-1 leading-tight"
        >
          <span className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide">
            <TrendingDown size={12} strokeWidth={2} aria-hidden />
            Sell
          </span>
          <span className="max-w-full truncate text-xs tabular-nums">
            {liveQuote ? fmtPrice(liveQuote.bid, instrument.digits) : "—"}
          </span>
        </Button>
        <Button
          type="button"
          variant="buy"
          size="sm"
          aria-label={liveQuote ? `Open buy ticket at ${fmtPrice(liveQuote.ask, instrument.digits)}` : "Open buy ticket — live quote unavailable"}
          onClick={() => onOpenTrade("BUY")}
          className="h-11 min-w-0 flex-col gap-0 px-1 py-1 leading-tight"
        >
          <span className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide">
            <TrendingUp size={12} strokeWidth={2} aria-hidden />
            Buy
          </span>
          <span className="max-w-full truncate text-xs tabular-nums">
            {liveQuote ? fmtPrice(liveQuote.ask, instrument.digits) : "—"}
          </span>
        </Button>
      </div>
    </div>
  );
}
