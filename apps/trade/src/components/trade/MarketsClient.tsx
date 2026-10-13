"use client";

import { useEffect } from "react";
import { useForexSocket } from "@/hooks/useForexSocket";
import { useForexStore } from "@/lib/store";
import { ConnectionDot } from "./ConnectionDot";
import { InstrumentSelector } from "./InstrumentSelector";
import { Logo } from "./Logo";
import { MobileTabBar, rememberMobileSymbol } from "./MobileTabBar";
import type { InstrumentView } from "@/lib/types";

/**
 * Markets browser body: the shared InstrumentSelector over the same socket
 * the terminal uses (anchored to the first instrument for the live list and
 * connection state). Server list hydrates instantly; WS replaces it on
 * connect; per-tick quotes keep rows live. Rows navigate to the chart.
 */
export function MarketsClient({ instruments }: { instruments: InstrumentView[] }) {
  const interval = useForexStore((s) => s.interval);
  const applyInstruments = useForexStore((s) => s.applyInstruments);
  const activeSymbol = useForexStore((s) => s.symbol);
  const anchor = instruments[0]!.symbol;
  const { status } = useForexSocket(anchor, interval);

  useEffect(() => {
    if (useForexStore.getState().instruments.length === 0) {
      applyInstruments(instruments);
    }
  }, [instruments, applyInstruments]);

  useEffect(() => {
    rememberMobileSymbol(anchor);
  }, [anchor]);

  return (
    <div className="terminal-ui flex min-h-dvh w-full flex-col bg-canvas">
      <header className="sticky top-0 z-20 flex min-h-11 shrink-0 items-center gap-2.5 bg-canvas px-3 shadow-panel">
        <Logo />
        <span className="text-(length:--term-text-2xs) font-semibold text-brand bg-brand-soft px-1.5 py-0.5 rounded">
          MARKETS
        </span>
        <div className="ml-auto flex items-center gap-2">
          <ConnectionDot status={status} />
        </div>
      </header>
      <main
        id="main-content"
        tabIndex={-1}
        className="flex min-h-0 flex-1 flex-col pb-[calc(env(safe-area-inset-bottom)+4rem)] md:pb-0"
      >
        <InstrumentSelector activeSymbol={activeSymbol ?? ""} />
      </main>
      <MobileTabBar />
    </div>
  );
}
