"use client";

import { useEffect, useState } from "react";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { useForexSocket } from "@/hooks/useForexSocket";
import { useForexStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import type { CandleInterval, InstrumentView } from "@/lib/types";
import { AccountBar } from "./AccountBar";
import { ChartPanel } from "./ChartPanel";
import { TradePanel } from "./TradePanel";
import { PositionsTable } from "./PositionsTable";
import { InstrumentSelector } from "./InstrumentSelector";
import { AssetModal } from "./AssetModal";
import { MarketStatusBanner } from "./MarketStatusBanner";
import { MobileTabBar, rememberMobileSymbol } from "./MobileTabBar";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import type { WalletAddressEntry } from "@/server/userSettings";

interface Props {
  instrument: InstrumentView;
  instruments: InstrumentView[];
  initialInterval?: CandleInterval | null;
  marketDataMode: string;
  depositUiEnabled?: boolean;
  disabledPaymentMethods?: string[];
  walletAddresses?: WalletAddressEntry[];
  /** Equity/margin ratio that marks the margin warning (settings → env default 125). */
  marginWarningPercent?: number;
}

const WATCHLIST_STORAGE_KEY = "blckforest:watchlist";
const DOCK_STORAGE_KEY = "blckforest:dock";

/** Responsive professional trading workspace. Desktop (lg+) is a deliberate
 *  three-track grid — market discovery | chart (dominant, minmax(0,1fr)) |
 *  execution ticket — over an activity dock; tablet keeps chart + ticket and
 *  phones stack with the order sheet. */
export function Dashboard({
  instrument,
  instruments,
  initialInterval = null,
  marketDataMode,
  depositUiEnabled = true,
  disabledPaymentMethods = [],
  walletAddresses = [],
  marginWarningPercent = 125,
}: Props) {
  const interval = useForexStore((state) => state.interval);
  const setInterval = useForexStore((state) => state.setInterval);
  const applyInstruments = useForexStore((state) => state.applyInstruments);
  const { status } = useForexSocket(instrument.symbol, interval);
  const [assetModalOpen, setAssetModalOpen] = useState(false);
  const [mobileOrderOpen, setMobileOrderOpen] = useState(false);
  const [watchlistOpen, setWatchlistOpen] = useState(true);
  const [dockOpen, setDockOpen] = useState(true);

  useEffect(() => {
    if (initialInterval && initialInterval !== useForexStore.getState().interval) {
      setInterval(initialInterval);
    }
  }, [initialInterval, setInterval]);

  // Hydrate the watchlist from the server-resolved list so the rail renders
  // real instruments immediately; the socket's live list replaces it on connect.
  useEffect(() => {
    if (useForexStore.getState().instruments.length === 0 && instruments.length > 0) {
      applyInstruments(instruments);
    }
  }, [instruments, applyInstruments]);

  // The mobile tab bar's Trade destination returns to the live symbol.
  useEffect(() => {
    rememberMobileSymbol(instrument.symbol);
  }, [instrument.symbol]);

  // Rail/dock collapse choices persist per workstation (defaults: open).
  useEffect(() => {
    const storedWatchlist = window.localStorage.getItem(WATCHLIST_STORAGE_KEY);
    if (storedWatchlist != null) setWatchlistOpen(storedWatchlist !== "collapsed");
    const storedDock = window.localStorage.getItem(DOCK_STORAGE_KEY);
    if (storedDock != null) setDockOpen(storedDock !== "collapsed");
  }, []);

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
      <AccountBar wsStatus={status} depositUiEnabled={depositUiEnabled} disabledPaymentMethods={disabledPaymentMethods} walletAddresses={walletAddresses} marginWarningPercent={marginWarningPercent} onOpenAssets={() => setAssetModalOpen(true)} />
      <MarketStatusBanner marketDataMode={marketDataMode} wsStatus={status} />

      {/* Chart + discovery rail + order panel — tablet (md) gets chart +
          ticket side-by-side; desktop (lg) adds the market rail. The chart
          always takes the dominant minmax(0,1fr) track. No dividing lines:
          the shell surface (bg-panel) separates the canvas cards tonally. */}
      <div
        className={cn(
          "grid grid-cols-1 gap-0 bg-panel md:min-h-0 md:flex-1 md:grid-cols-[minmax(0,1fr)_300px]",
          watchlistOpen
            ? "lg:grid-cols-[240px_minmax(0,1fr)_340px]"
            : "lg:grid-cols-[2.5rem_minmax(0,1fr)_340px]",
        )}
      >
        {/* Market discovery rail — desktop only; collapses to a slim strip. */}
        <aside className="hidden min-h-0 lg:block">
          {watchlistOpen ? (
            <div className="flex h-full flex-col bg-panel">
              <InstrumentSelector
                activeSymbol={instrument.symbol}
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
          className="relative min-h-75 p-1 sm:min-h-100 md:min-h-0"
        >
          <ChartPanel instrument={instrument} onOpenAssets={() => setAssetModalOpen(true)} />
          {/* Mobile trade FAB — visible only below md (tablet gets the inline
              panel), floating above the bottom tab bar and hidden while the
              order sheet is open so it doesn't compete with the footer. */}
          <button
            type="button"
            onClick={() => setMobileOrderOpen(true)}
            className={`fixed bottom-[calc(env(safe-area-inset-bottom)+4.5rem)] right-4 z-30 flex items-center gap-2 rounded-full bg-brand px-6 py-3.5 text-sm font-bold text-white shadow-2xl transition active:scale-95 md:hidden ${mobileOrderOpen ? "pointer-events-none opacity-0" : ""}`}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 17l6-6 4 4 8-8" /><path d="M21 7v6h-6" />
            </svg>
            Trade
          </button>
        </main>

        {/* Order panel — hidden on phones (FAB opens bottom sheet), inline from md up */}
        <aside className="hidden min-h-0 bg-panel md:block">
          <TradePanel instrument={instrument} />
        </aside>
      </div>

      {/* Activity dock — collapses to its tab strip on short laptops so the
          chart and order controls keep their space. Phones get bottom
          padding so the fixed tab bar never covers the last rows. */}
      <div className={cn("shrink-0 bg-panel pb-[calc(env(safe-area-inset-bottom)+3.5rem)] md:pb-0", dockOpen ? "min-h-50 h-60 sm:h-88 md:h-64 lg:h-70" : "h-9")}>
        <PositionsTable instruments={instruments} collapsed={!dockOpen} onToggleCollapsed={toggleDock} />
      </div>

      {/* Mobile order entry — purpose-built bottom sheet (side-anchored Radix
          Sheet with slide-in, focus trap, Escape and scroll lock). The
          panel's own footer pads env(safe-area-inset-bottom) so the Buy/Sell
          actions stay clear of the home indicator. */}
      <Sheet open={mobileOrderOpen} onOpenChange={setMobileOrderOpen}>
        <SheetContent
          side="bottom"
          className="h-[92dvh] gap-0 rounded-t-2xl p-0 md:hidden sm:max-w-none"
        >
          <SheetHeader className="border-b border-border-soft pb-2 pt-3">
            <SheetTitle>Trade {instrument.symbol}</SheetTitle>
            <SheetDescription>Review the order details before submitting.</SheetDescription>
          </SheetHeader>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
            <TradePanel instrument={instrument} />
          </div>
        </SheetContent>
      </Sheet>

      <MobileTabBar />

      <AssetModal
        open={assetModalOpen}
        onClose={() => setAssetModalOpen(false)}
        activeSymbol={instrument.symbol}
      />
    </div>
  );
}
