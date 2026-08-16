import { Skeleton } from "@/components/ui/Skeleton";

/**
 * Trade terminal loading skeleton — mirrors the actual terminal layout:
 * account bar (top) · chart + trade panel (2-column main) · positions (bottom).
 * Replaces the old root-level skeleton that showed an incorrect 3-column
 * layout on every route in the app.
 */
export default function TradeLoading() {
  return (
    <div className="flex min-h-dvh w-full flex-col gap-px bg-border md:h-dvh md:overflow-hidden lg:h-screen">
      {/* Account bar */}
      <Skeleton className="h-12 shrink-0 rounded-none" />

      {/* Main area: chart + trade panel */}
      <div className="grid flex-1 grid-cols-1 md:min-h-0 md:grid-cols-[minmax(0,1fr)_320px]">
        <Skeleton className="min-h-75 rounded-none sm:min-h-100 md:min-h-0" />
        <Skeleton className="hidden rounded-none md:block" />
      </div>

      {/* Positions strip */}
      <Skeleton className="h-60 min-h-50 shrink-0 rounded-none sm:h-88 md:h-64 lg:h-70" />
    </div>
  );
}
