"use client";

import { useState } from "react";
import { ArrowLeftRight, BookOpen, CandlestickChart } from "lucide-react";
import type { OpenPositionController } from "@/hooks/useOpenPosition";
import type { InstrumentView, PositionSide } from "@/lib/types";
import { cn } from "@/lib/utils";
import { TabsContent, TabsList, TabsRoot, TabsTrigger } from "@/components/ui/Tabs";
import { MarketMarkers } from "./MarketMarkers";
import { TradePanel } from "./TradePanel";

type WorkspaceTab = "market" | "book" | "trade";

export function TradingSideWorkspace({
  instrument,
  orderController,
  marketDataConnected,
  initialSide = null,
  onSwitchInstrument,
  className,
}: {
  instrument: InstrumentView;
  orderController: OpenPositionController;
  marketDataConnected: boolean;
  initialSide?: PositionSide | null;
  onSwitchInstrument?: () => void;
  className?: string;
}) {
  const [activeTab, setActiveTab] = useState<WorkspaceTab>("trade");

  return (
    <TabsRoot
      orientation="vertical"
      value={activeTab}
      onValueChange={(value) => setActiveTab(value as WorkspaceTab)}
      className={cn("min-h-0 flex-1 flex-row gap-0", className)}
    >
      <TabsList
        variant="line"
        aria-label="Trading workspace"
        className="h-full shrink-0 justify-start gap-1 border-r border-border-soft bg-panel p-2"
      >
        <TabsTrigger
          value="market"
          aria-label="Market overview"
          title="Market overview"
          className="h-10 w-10 flex-none justify-center rounded-md p-0 text-text-faint data-[state=active]:bg-brand-soft data-[state=active]:text-brand"
        >
          <CandlestickChart size={17} strokeWidth={1.8} aria-hidden />
        </TabsTrigger>
        <TabsTrigger
          value="book"
          aria-label="Order book"
          title="Order book"
          className="h-10 w-10 flex-none justify-center rounded-md p-0 text-text-faint data-[state=active]:bg-brand-soft data-[state=active]:text-brand"
        >
          <BookOpen size={17} strokeWidth={1.8} aria-hidden />
        </TabsTrigger>
        <TabsTrigger
          value="trade"
          aria-label="Trade ticket"
          title="Trade ticket"
          className="h-10 w-10 flex-none justify-center rounded-md p-0 text-text-faint data-[state=active]:bg-brand-soft data-[state=active]:text-brand"
        >
          <ArrowLeftRight size={17} strokeWidth={1.8} aria-hidden />
        </TabsTrigger>
      </TabsList>

      <TabsContent forceMount value="market" className="min-h-0 min-w-0 flex-1 overflow-hidden">
        <MarketMarkers
          instrument={instrument}
          marketDataConnected={marketDataConnected}
          view="market"
        />
      </TabsContent>

      <TabsContent forceMount value="book" className="min-h-0 min-w-0 flex-1 overflow-hidden">
        <MarketMarkers
          instrument={instrument}
          marketDataConnected={marketDataConnected}
          view="book"
        />
      </TabsContent>

      <TabsContent forceMount value="trade" className="min-h-0 min-w-0 flex-1 overflow-hidden">
        <TradePanel
          instrument={instrument}
          orderController={orderController}
          marketDataConnected={marketDataConnected}
          initialSide={initialSide}
          onSwitchInstrument={onSwitchInstrument}
        />
      </TabsContent>
    </TabsRoot>
  );
}
