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
    <div className="flex min-h-dvh w-full flex-col overflow-x-hidden bg-canvas lg:h-screen lg:overflow-hidden">
      <AccountBar wsStatus={status} depositUiEnabled={depositUiEnabled} disabledPaymentMethods={disabledPaymentMethods} onOpenAssets={() => setAssetModalOpen(true)} />
      <MarketStatusBanner marketDataMode={marketDataMode} wsStatus={status} />

      <div className="grid min-h-[clamp(32rem,62dvh,52rem)] grid-cols-1 gap-px bg-border lg:min-h-0 lg:flex-1 lg:grid-cols-[minmax(0,1fr)_340px]">
        <main
          id="main-content"
          tabIndex={-1}
          className="relative min-h-128 bg-canvas p-1.5 sm:min-h-152 lg:min-h-0"
        >
          <ChartPanel instrument={instrument} onOpenAssets={() => setAssetModalOpen(true)} />
          <button
            type="button"
            onClick={() => setMobileOrderOpen(true)}
            className="fixed bottom-[calc(env(safe-area-inset-bottom)+1rem)] right-4 z-30 rounded-full bg-brand px-5 py-3 text-sm font-semibold text-white shadow-xl  focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand lg:hidden"
          >
            Trade {instrument.symbol}
          </button>
        </main>

        <aside className="hidden min-h-0 bg-canvas lg:block">
          <TradePanel instrument={instrument} />
        </aside>
      </div>

      <div className="h-88 min-h-72 shrink-0 sm:h-98 lg:h-70">
        <PositionsTable instruments={instruments} />
      </div>

      <Dialog
        open={mobileOrderOpen}
        onClose={() => setMobileOrderOpen(false)}
        title={`Trade ${instrument.symbol}`}
        description="Review the order details before submitting."
        className="h-dvh max-w-md lg:hidden"
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
