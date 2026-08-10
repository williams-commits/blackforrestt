"use client";

import { useEffect, useState } from "react";
import { useForexSocket } from "@/hooks/useForexSocket";
import { useForexStore } from "@/lib/store";
import type { CandleInterval, InstrumentView } from "@/lib/types";
import { AccountBar } from "./AccountBar";
import { ChartPanel } from "./ChartPanel";
import { TradePanel } from "./TradePanel";
import { PositionsTable } from "./PositionsTable";
import { AssetModal } from "./AssetModal";
import { Dialog } from "@/components/ui/Dialog";
import { MarketStatusBanner } from "./MarketStatusBanner";

interface Props {
  instrument: InstrumentView;
  instruments: InstrumentView[];
  initialInterval?: CandleInterval | null;
  marketDataMode: string;
  depositUiEnabled?: boolean;
  disabledPaymentMethods?: string[];
}

/** Responsive professional trading workspace. */
export function Dashboard({
  instrument,
  instruments,
  initialInterval = null,
  marketDataMode,
  depositUiEnabled = true,
  disabledPaymentMethods = [],
}: Props) {
  const interval = useForexStore((state) => state.interval);
  const setInterval = useForexStore((state) => state.setInterval);
  const { status } = useForexSocket(instrument.symbol, interval);
  const [assetModalOpen, setAssetModalOpen] = useState(false);
  const [mobileOrderOpen, setMobileOrderOpen] = useState(false);

  useEffect(() => {
    if (initialInterval && initialInterval !== useForexStore.getState().interval) {
      setInterval(initialInterval);
    }
  }, [initialInterval, setInterval]);

  return (
    <div className="flex min-h-dvh w-full flex-col overflow-x-hidden bg-canvas md:h-dvh md:overflow-hidden lg:h-screen">
      <AccountBar wsStatus={status} depositUiEnabled={depositUiEnabled} disabledPaymentMethods={disabledPaymentMethods} onOpenAssets={() => setAssetModalOpen(true)} />
      <MarketStatusBanner marketDataMode={marketDataMode} wsStatus={status} />

      {/* Chart + order panel — tablet (md) gets side-by-side, desktop (lg) gets the full layout */}
      <div className="grid grid-cols-1 gap-px bg-border md:min-h-0 md:flex-1 md:grid-cols-[minmax(0,1fr)_300px] lg:grid-cols-[minmax(0,1fr)_340px]">
        <main
          id="main-content"
          tabIndex={-1}
          className="relative min-h-75 bg-canvas p-1 sm:min-h-100 md:min-h-0"
        >
          <ChartPanel instrument={instrument} onOpenAssets={() => setAssetModalOpen(true)} />
          {/* Mobile trade FAB — visible only below md (tablet gets the inline panel) */}
          <button
            type="button"
            onClick={() => setMobileOrderOpen(true)}
            className="fixed bottom-[calc(env(safe-area-inset-bottom)+1rem)] right-4 z-30 flex items-center gap-2 rounded-full bg-brand px-6 py-3.5 text-sm font-bold text-white shadow-2xl transition active:scale-95 md:hidden"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 17l6-6 4 4 8-8" /><path d="M21 7v6h-6" />
            </svg>
            Trade
          </button>
        </main>

        {/* Order panel — hidden on phones (FAB opens bottom sheet), inline from md up */}
        <aside className="hidden min-h-0 bg-canvas md:block">
          <TradePanel instrument={instrument} />
        </aside>
      </div>

      {/* Positions dock — shorter on mobile to leave room for the chart + FAB */}
      <div className="h-60 min-h-50 shrink-0 sm:h-88 md:h-64 lg:h-70">
        <PositionsTable instruments={instruments} />
      </div>

      {/* Mobile bottom sheet order panel — slides up from bottom, partial height */}
      <Dialog
        open={mobileOrderOpen}
        onClose={() => setMobileOrderOpen(false)}
        title={`Trade ${instrument.symbol}`}
        description="Review the order details before submitting."
        className="max-h-[88dvh] w-full max-w-md self-end rounded-b-none rounded-t-2xl md:hidden"
      >
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          <TradePanel instrument={instrument} />
        </div>
      </Dialog>

      <AssetModal
        open={assetModalOpen}
        onClose={() => setAssetModalOpen(false)}
        activeSymbol={instrument.symbol}
      />
    </div>
  );
}
