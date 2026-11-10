"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { useForexSocket } from "@/hooks/useForexSocket";
import { useForexStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import { DEFAULT_MARKET_DATA_INTERVAL, type InstrumentView, type PositionSide } from "@/lib/types";
import { useOpenPosition } from "@/hooks/useOpenPosition";
import { AccountBar } from "./AccountBar";
import { ChartPanel } from "./ChartPanel";
import { TradingSideWorkspace } from "./TradingSideWorkspace";
import { PositionsTable } from "./PositionsTable";
import { InstrumentSelector } from "./InstrumentSelector";
import { InstrumentSwitcherSheet } from "./InstrumentSwitcherSheet";
import { MarketStatusBanner } from "./MarketStatusBanner";
import { MobileTabBar, OPEN_ORDER_EVENT, consumeOpenOrderFlag, rememberMobileSymbol } from "./MobileTabBar";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import type { WalletAddressEntry } from "@/server/userSettings";

interface Props {
  instrument: InstrumentView;
  instruments: InstrumentView[];
  marketDataMode: string;
  depositUiEnabled?: boolean;
  disabledPaymentMethods?: string[];
  walletAddresses?: WalletAddressEntry[];
  /** Equity/margin ratio that marks the margin warning (settings → env default 125). */
  marginWarningPercent?: number;
}

const WATCHLIST_STORAGE_KEY = "blckforest:watchlist";
const DOCK_STORAGE_KEY = "blckforest:dock";
const DOCK_HEIGHT_STORAGE_KEY = "blckforest:dock-height";
const MIN_DOCK_HEIGHT = 144;
const DEFAULT_DOCK_HEIGHT = 280;

/** Responsive trading workspace with a persistent desktop order ticket and a
 *  right-side mobile ticket, sharing one submission controller. */
export function Dashboard({
  instrument,
  instruments,
  marketDataMode,
  depositUiEnabled = true,
  disabledPaymentMethods = [],
  walletAddresses = [],
  marginWarningPercent = 125,
}: Props) {
  const applyInstruments = useForexStore((state) => state.applyInstruments);
  const storeInstruments = useForexStore((state) => state.instruments);
  const orderController = useOpenPosition();

  // In-place instrument switching: the route symbol seeds the workspace, but
  // selecting another instrument only swaps market data (store resubscribes)
  // — same view, preserved dock/watchlist state, no navigation. The URL is
  // silently replaced so refresh/share/deep links keep working.
  const [activeSymbol, setActiveSymbol] = useState(instrument.symbol);
  const activeInstrument =
    storeInstruments.find((i) => i.symbol.toUpperCase() === activeSymbol.toUpperCase()) ??
    instruments.find((i) => i.symbol.toUpperCase() === activeSymbol.toUpperCase()) ??
    instrument;
  const { status } = useForexSocket(activeInstrument.symbol, DEFAULT_MARKET_DATA_INTERVAL);

  const switchInstrument = (symbol: string) => {
    if (symbol === activeInstrument.symbol) return;
    setActiveSymbol(symbol);
    setSwitcherOpen(false);
    try {
      const url = new URL(window.location.href);
      url.pathname = `/trade/${symbol}`;
      url.searchParams.delete("tf");
      window.history.replaceState(null, "", url.toString());
    } catch { /* non-critical */ }
  };
  const [switcherOpen, setSwitcherOpen] = useState(false);
  const [tradeOpen, setTradeOpen] = useState(false);
  const [tradeSide, setTradeSide] = useState<PositionSide | null>(null);
  const [watchlistOpen, setWatchlistOpen] = useState(true);
  const [dockOpen, setDockOpen] = useState(true);
  const [dockHeight, setDockHeight] = useState(DEFAULT_DOCK_HEIGHT);
  const [viewportHeight, setViewportHeight] = useState(900);
  const dockHeightRef = useRef(DEFAULT_DOCK_HEIGHT);
  const dockResizeRef = useRef<{ startY: number; startHeight: number } | null>(null);

  const openTrade = useCallback((side: PositionSide | null = null) => {
    setTradeSide(side);
    if (window.matchMedia("(min-width: 1024px)").matches) return;
    setTradeOpen(true);
  }, []);

  useEffect(() => {
    const updateViewportHeight = () => setViewportHeight(window.innerHeight);
    updateViewportHeight();
    window.addEventListener("resize", updateViewportHeight);
    return () => window.removeEventListener("resize", updateViewportHeight);
  }, []);

  // Hydrate the watchlist from the server-resolved list so the rail renders
  // real instruments immediately; the socket's live list replaces it on connect.
  useEffect(() => {
    if (useForexStore.getState().instruments.length === 0 && instruments.length > 0) {
      applyInstruments(instruments);
    }
  }, [instruments, applyInstruments]);

  // The mobile tab bar's Trade destination returns to the live symbol.
  useEffect(() => {
    rememberMobileSymbol(activeInstrument.symbol);
  }, [activeInstrument.symbol]);

  // The Trade destination in the mobile tab bar opens the same ticket drawer
  // as the chart's Buy/Sell actions.
  useEffect(() => {
    if (consumeOpenOrderFlag()) openTrade();
    const onOpenOrder = () => openTrade();
    window.addEventListener(OPEN_ORDER_EVENT, onOpenOrder);
    return () => window.removeEventListener(OPEN_ORDER_EVENT, onOpenOrder);
  }, [openTrade]);

  // Rail/dock collapse choices persist per workstation (defaults: open).
  useEffect(() => {
    const storedWatchlist = window.localStorage.getItem(WATCHLIST_STORAGE_KEY);
    if (storedWatchlist != null) setWatchlistOpen(storedWatchlist !== "collapsed");
    const storedDock = window.localStorage.getItem(DOCK_STORAGE_KEY);
    if (storedDock != null) setDockOpen(storedDock !== "collapsed");
    const storedHeight = Number(window.localStorage.getItem(DOCK_HEIGHT_STORAGE_KEY));
    if (Number.isFinite(storedHeight) && storedHeight >= MIN_DOCK_HEIGHT) {
      dockHeightRef.current = storedHeight;
      setDockHeight(storedHeight);
    }
  }, []);

  const closeTrade = (open: boolean) => {
    setTradeOpen(open);
    if (!open) setTradeSide(null);
  };

  const resizeDock = (clientY: number) => {
    const drag = dockResizeRef.current;
    if (!drag) return;
    const maxHeight = Math.max(MIN_DOCK_HEIGHT, Math.floor(window.innerHeight * 0.55));
    const nextHeight = Math.min(maxHeight, Math.max(MIN_DOCK_HEIGHT, drag.startHeight + drag.startY - clientY));
    dockHeightRef.current = nextHeight;
    setDockHeight(nextHeight);
  };

  const finishDockResize = () => {
    if (!dockResizeRef.current) return;
    dockResizeRef.current = null;
    window.localStorage.setItem(DOCK_HEIGHT_STORAGE_KEY, String(dockHeightRef.current));
  };

  const toggleWatchlist = () => {
    setWatchlistOpen((open) => {
      window.localStorage.setItem(WATCHLIST_STORAGE_KEY, open ? "collapsed" : "open");
      return !open;
    });
  };

  const toggleDock = () => {
    setDockOpen((open) => {
      window.localStorage.setItem(DOCK_STORAGE_KEY, open ? "collapsed" : "open");
      return !open;
    });
  };

  return (
    <div className="trade-workspace terminal-ui flex min-h-dvh w-full flex-col overflow-x-hidden bg-canvas md:h-dvh md:overflow-hidden lg:h-screen">
      <AccountBar wsStatus={status} depositUiEnabled={depositUiEnabled} disabledPaymentMethods={disabledPaymentMethods} walletAddresses={walletAddresses} marginWarningPercent={marginWarningPercent} />
      <MarketStatusBanner marketDataMode={marketDataMode} wsStatus={status} />

      {/* Keep market discovery, charting, and order entry in stable columns on
          desktop; smaller screens open the same ticket in a right-side sheet. */}
      <div
        className={cn(
          "grid grid-cols-1 gap-0 bg-panel md:min-h-0 md:flex-1",
          watchlistOpen
            ? "lg:grid-cols-[240px_minmax(0,1fr)_340px]"
            : "lg:grid-cols-[2.5rem_minmax(0,1fr)_340px]",
        )}
      >
        {/* Market discovery rail — desktop only; collapses to a slim strip. */}
        <aside className="hidden min-h-0 lg:block">
          {watchlistOpen ? (
            <div className="flex h-full flex-col bg-canvas border-r border-border-soft">
              <InstrumentSelector
                activeSymbol={activeInstrument.symbol}
                onSelect={switchInstrument}
                headerAction={
                  <button
                    type="button"
                    onClick={toggleWatchlist}
                    aria-label="Collapse market watchlist"
                    title="Collapse watchlist"
                    className="rounded p-1 text-text-muted transition-colors hover:bg-panel-3 hover:text-text focus-visible:outline-2 focus-visible:outline-brand"
                  >
                    <PanelLeftClose size={14} strokeWidth={2} aria-hidden />
                  </button>
                }
              />
            </div>
          ) : (
            <div className="flex h-full w-full flex-col items-center gap-1 bg-panel py-2">
              <button
                type="button"
                onClick={toggleWatchlist}
                aria-label="Expand market watchlist"
                title="Markets"
                className="rounded p-1.5 text-text-muted transition-colors hover:bg-panel-2 hover:text-text focus-visible:outline-2 focus-visible:outline-brand"
              >
                <PanelLeftOpen size={15} strokeWidth={2} aria-hidden />
              </button>
            </div>
          )}
        </aside>

        <main
          id="main-content"
          tabIndex={-1}
          className="relative min-h-75 min-w-0 p-1 sm:min-h-100 md:min-h-0"
        >
          <ChartPanel
            instrument={activeInstrument}
            marketDataConnected={status === "open"}
            onSwitchInstrument={() => setSwitcherOpen(true)}
            onOpenTrade={openTrade}
          />
        </main>

        <aside aria-label="Trading workspace" className="hidden min-h-0 border-l border-border-soft bg-canvas lg:flex">
          <TradingSideWorkspace
            instrument={activeInstrument}
            orderController={orderController}
            marketDataConnected={status === "open"}
            initialSide={tradeSide}
            onSwitchInstrument={() => setSwitcherOpen(true)}
          />
        </aside>
      </div>

      {/* Desktop dock resizing is persisted; the mobile dock scales to the
          viewport and keeps its rows internally scrollable. */}
      <div
        data-activity-dock
        className={cn(
          "min-w-0 shrink-0 bg-panel pb-[calc(env(safe-area-inset-bottom)+3.5rem)] md:pb-0",
          dockOpen
            ? "min-h-50 h-[min(50dvh,30rem)] sm:h-[min(50dvh,34rem)] md:h-(--dock-height)"
            : "h-9",
        )}
        style={{ "--dock-height": `${dockHeight}px` } as React.CSSProperties}
      >
        {dockOpen && (
          <div
            role="separator"
            aria-orientation="horizontal"
            aria-label="Resize activity dock"
            aria-valuemin={MIN_DOCK_HEIGHT}
            aria-valuemax={Math.max(MIN_DOCK_HEIGHT, Math.floor(viewportHeight * 0.55))}
            aria-valuenow={dockHeight}
            tabIndex={0}
            onPointerDown={(event) => {
              dockResizeRef.current = { startY: event.clientY, startHeight: dockHeight };
              event.currentTarget.setPointerCapture(event.pointerId);
            }}
            onPointerMove={(event) => resizeDock(event.clientY)}
            onPointerUp={finishDockResize}
            onPointerCancel={finishDockResize}
            onKeyDown={(event) => {
              if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return;
              event.preventDefault();
              const delta = event.key === "ArrowUp" ? 24 : -24;
              setDockHeight((current) => {
                const maxHeight = Math.max(MIN_DOCK_HEIGHT, Math.floor(window.innerHeight * 0.55));
                const next = Math.min(maxHeight, Math.max(MIN_DOCK_HEIGHT, current + delta));
                dockHeightRef.current = next;
                window.localStorage.setItem(DOCK_HEIGHT_STORAGE_KEY, String(next));
                return next;
              });
            }}
            className="hidden cursor-row-resize touch-none items-center justify-center bg-panel-2 transition-colors hover:bg-brand-soft focus-visible:outline-2 focus-visible:outline-brand md:flex"
          >
            <span className="h-0.5 w-10 rounded-full bg-text-faint/50" aria-hidden />
          </div>
        )}
        <div className={dockOpen ? "h-[calc(100%-0.5rem)] md:h-[calc(100%-0.5rem)]" : "h-full"}>
          <PositionsTable instruments={instruments} collapsed={!dockOpen} onToggleCollapsed={toggleDock} />
        </div>
      </div>

      {/* One order-entry drawer for every screen size. A Buy/Sell shortcut
          opens the ticket with that side highlighted; it never submits. */}
      <Sheet open={tradeOpen} onOpenChange={closeTrade}>
        <SheetContent
          side="right"
          className="inset-y-0 right-0 flex h-dvh w-screen max-w-none flex-col gap-0 overflow-hidden rounded-none p-0 sm:max-w-none md:w-92 md:max-w-lg"
        >
          <SheetHeader className="w-full shrink-0 border-b border-border-soft pb-2 pl-4 pr-12 pt-3">
            <SheetTitle>Trading workspace</SheetTitle>
            <SheetDescription>Market context, order book, and order ticket.</SheetDescription>
          </SheetHeader>
          <div className="flex min-h-0 min-w-0 flex-1 overflow-hidden">
            <TradingSideWorkspace
              instrument={activeInstrument}
              orderController={orderController}
              marketDataConnected={status === "open"}
              initialSide={tradeSide}
              onSwitchInstrument={() => setSwitcherOpen(true)}
              compactNavigation
            />
          </div>
        </SheetContent>
      </Sheet>

      <MobileTabBar />

      <InstrumentSwitcherSheet
        open={switcherOpen}
        onOpenChange={setSwitcherOpen}
        activeSymbol={activeInstrument.symbol}
        onSelect={switchInstrument}
      />
    </div>
  );
}
