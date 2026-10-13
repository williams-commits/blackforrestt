"use client";

import { Suspense } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Activity, CandlestickChart, LineChart, User } from "lucide-react";
import { useForexStore } from "@/lib/store";
import { cn } from "@/lib/utils";

const LAST_SYMBOL_KEY = "blckforest:last-symbol";

/** Remember the last-traded symbol so the Trade tab can return to it from
 *  surfaces where the live store has no symbol yet (fresh /account load). */
export function rememberMobileSymbol(symbol: string): void {
  try {
    sessionStorage.setItem(LAST_SYMBOL_KEY, symbol);
  } catch {
    /* storage unavailable — Trade falls back to Markets */
  }
}

function readLastSymbol(): string | null {
  try {
    return sessionStorage.getItem(LAST_SYMBOL_KEY);
  } catch {
    return null;
  }
}

function MobileTabBarInner() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const liveSymbol = useForexStore((s) => s.symbol);

  const symbol = liveSymbol ?? readLastSymbol();
  const tradeHref = symbol ? `/trade/${encodeURIComponent(symbol)}` : "/markets";
  const onAccount = pathname === "/account";
  const positionsActive = onAccount && searchParams.get("tab") === "positions";

  const items = [
    { href: "/markets", label: "Markets", Icon: CandlestickChart, active: pathname === "/markets" },
    { href: tradeHref, label: "Trade", Icon: LineChart, active: pathname.startsWith("/trade/") },
    { href: "/account?tab=positions", label: "Positions", Icon: Activity, active: positionsActive },
    { href: "/account", label: "Account", Icon: User, active: onAccount && !positionsActive },
  ];

  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-canvas pb-[env(safe-area-inset-bottom)] shadow-panel md:hidden"
    >
      <ul className="flex items-stretch">
        {items.map(({ href, label, Icon, active }) => (
          <li key={label} className="flex-1">
            <Link
              href={href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex min-h-14 flex-col items-center justify-center gap-0.5 px-1 text-(length:--term-text-2xs) font-medium transition-colors focus-visible:outline-2 focus-visible:outline-brand",
                active ? "text-brand" : "text-text-muted hover:text-text",
              )}
            >
              <Icon size={20} strokeWidth={2} aria-hidden />
              {label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

/** Phone bottom navigation (<md). Four real destinations over real routes;
 *  tablet and desktop keep their inline navigation. Fixed above the safe
 *  area — pages add matching bottom padding so content is never covered. */
export function MobileTabBar() {
  return (
    <Suspense fallback={null}>
      <MobileTabBarInner />
    </Suspense>
  );
}
