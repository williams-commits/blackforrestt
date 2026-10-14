"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { InstrumentSelector } from "./InstrumentSelector";

/**
 * Slide-out instrument switcher — one shared surface for every "change
 * instrument" entry point (the chart's instrument identity and the order
 * ticket's selector button). Reuses the watchlist rail's InstrumentSelector
 * (search, categories, favorites, live prices); picking a row navigates and
 * the sheet closes.
 */
export function InstrumentSwitcherSheet({
  open,
  onOpenChange,
  activeSymbol,
  onSelect,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  activeSymbol: string;
  /** In-place selection — switching no longer navigates. */
  onSelect?: (symbol: string) => void;
}) {
  const pathname = usePathname();
  // Navigating to the picked instrument changes the route — close the sheet.
  useEffect(() => {
    if (open) onOpenChange(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex h-dvh w-80 flex-col gap-0 p-0 sm:max-w-none"
      >
        <SheetHeader className="border-b border-border-soft pb-3 pt-4">
          <SheetTitle>Switch instrument</SheetTitle>
          <SheetDescription>Search or pick a market to load its chart.</SheetDescription>
        </SheetHeader>
        <div className="flex min-h-0 flex-1 flex-col">
          <InstrumentSelector activeSymbol={activeSymbol} onSelect={onSelect} />
        </div>
      </SheetContent>
    </Sheet>
  );
}
