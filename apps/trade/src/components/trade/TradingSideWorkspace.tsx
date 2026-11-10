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
  compactNavigation = false,
  className,
}: {
  instrument: InstrumentView;
  orderController: OpenPositionController;
  marketDataConnected: boolean;
  initialSide?: PositionSide | null;
  onSwitchInstrument?: () => void;
  compactNavigation?: boolean;
  className?: string;
}) {
  const [activeTab, setActiveTab] = useState<WorkspaceTab>("trade");

  return (
    <TabsRoot
      orientation={compactNavigation ? "horizontal" : "vertical"}
      value={activeTab}
      onValueChange={(value) => setActiveTab(value as WorkspaceTab)}
      className={cn(
        "min-h-0 min-w-0 w-full flex-1 self-stretch gap-0 overflow-hidden",
        compactNavigation ? "flex-col" : "flex-row",
        className,
      )}
    >
      <TabsList
        variant="default"
        aria-label="Trading workspace"
        className={cn(
          "shrink-0 rounded-none bg-panel",
          compactNavigation
            ? "h-11 w-full self-auto justify-around gap-1 border-b border-border-soft px-3 py-1"
            : "h-full w-14 self-stretch justify-start gap-2 border-r border-border-soft px-2 py-3",
        )}
      >
        <TabsTrigger
          value="market"
          aria-label="Market overview"
          title="Market overview"
          className={cn(
            "h-10 rounded-lg p-0 text-text-faint hover:bg-panel-2 data-[state=active]:bg-brand-soft data-[state=active]:text-brand",
            compactNavigation
              ? "w-auto flex-1 justify-center"
              : "w-10 flex-none justify-center data-[orientation=vertical]:justify-center",
          )}
        >
          <CandlestickChart size={17} strokeWidth={1.8} aria-hidden />
        </TabsTrigger>
        <TabsTrigger
          value="book"
          aria-label="Order book"
          title="Order book"
          className={cn(
            "h-10 rounded-lg p-0 text-text-faint hover:bg-panel-2 data-[state=active]:bg-brand-soft data-[state=active]:text-brand",
            compactNavigation
              ? "w-auto flex-1 justify-center"
              : "w-10 flex-none justify-center data-[orientation=vertical]:justify-center",
          )}
        >
          <BookOpen size={17} strokeWidth={1.8} aria-hidden />
        </TabsTrigger>
        <TabsTrigger
          value="trade"
          aria-label="Trade ticket"
          title="Trade ticket"
          className={cn(
            "h-10 rounded-lg p-0 text-text-faint hover:bg-panel-2 data-[state=active]:bg-brand-soft data-[state=active]:text-brand",
            compactNavigation
              ? "w-auto flex-1 justify-center"
              : "w-10 flex-none justify-center data-[orientation=vertical]:justify-center",
          )}
        >
          <ArrowLeftRight size={17} strokeWidth={1.8} aria-hidden />
        </TabsTrigger>
      </TabsList>

      <TabsContent forceMount value="market" className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <MarketMarkers
          instrument={instrument}
          marketDataConnected={marketDataConnected}
          view="market"
        />
      </TabsContent>

      <TabsContent forceMount value="book" className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <MarketMarkers
          instrument={instrument}
          marketDataConnected={marketDataConnected}
          view="book"
        />
      </TabsContent>

      <TabsContent forceMount value="trade" className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
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
