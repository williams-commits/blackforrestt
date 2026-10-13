"use client";

import { Suspense } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Activity, CandlestickChart, User } from "lucide-react";
import { useForexStore } from "@/lib/store";
import { cn } from "@/lib/utils";

const LAST_SYMBOL_KEY = "blckforest:last-symbol";
/** Set by the center Trade action off-terminal: the terminal opens the order
 *  sheet on mount so one tap anywhere reaches the ticket. */
const OPEN_ORDER_KEY = "blckforest:open-order";
/** Dashboard listens for this to raise the order sheet while on the chart. */
export const OPEN_ORDER_EVENT = "blckforest:open-order";

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

/** Consume the navigate-and-open flag (terminal mount effect). */
export function consumeOpenOrderFlag(): boolean {
  try {
    const flag = sessionStorage.getItem(OPEN_ORDER_KEY) === "1";
    if (flag) sessionStorage.removeItem(OPEN_ORDER_KEY);
    return flag;
  } catch {
    return false;
  }
}

function MobileTabBarInner() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const liveSymbol = useForexStore((s) => s.symbol);

  const symbol = liveSymbol ?? readLastSymbol();
  const tradeHref = symbol ? `/trade/${encodeURIComponent(symbol)}` : "/markets";
  const onTrade = pathname.startsWith("/trade/");
  const onAccount = pathname === "/account";
  const positionsActive = onAccount && searchParams.get("tab") === "positions";

  /** Center action — same job as the web FAB: raise the order ticket. On the
   *  chart it opens the sheet in place; anywhere else it routes to the last
   *  instrument and the terminal opens the ticket on arrival. */
  const openTrade = () => {
    if (onTrade) {
      window.dispatchEvent(new CustomEvent(OPEN_ORDER_EVENT));
      return;
    }
    try {
      sessionStorage.setItem(OPEN_ORDER_KEY, "1");
    } catch {
      /* storage unavailable — arrival opens normally */
    }
    router.push(tradeHref);
  };

  const navItems = [
    { href: "/markets", label: "Markets", Icon: CandlestickChart, active: pathname === "/markets" },
    { href: "/account?tab=positions", label: "Positions", Icon: Activity, active: positionsActive },
  ];
  const rightItems = [
    { href: "/account", label: "Account", Icon: User, active: onAccount && !positionsActive },
  ];

  const navLink = (item: { href: string; label: string; Icon: typeof User; active: boolean }) => (
    <Link
      href={item.href}
      aria-current={item.active ? "page" : undefined}
      className={cn(
        "flex min-h-14 flex-col items-center justify-center gap-0.5 px-1 text-(length:--term-text-2xs) font-medium transition-colors focus-visible:outline-2 focus-visible:outline-brand",
        item.active ? "text-brand" : "text-text-muted hover:text-text",
      )}
    >
      <item.Icon size={20} strokeWidth={2} aria-hidden />
      {item.label}
    </Link>
  );

  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-canvas pb-[env(safe-area-inset-bottom)] shadow-panel md:hidden"
    >
      <ul className="grid grid-cols-4 items-end">
        {navItems.map((item) => (
          <li key={item.label} className="flex-1">{navLink(item)}</li>
        ))}
        {/* Center Trade action — the web FAB relocated into the bar: raised
            brand pill with the same arrow glyph; opens the order ticket. */}
        <li className="flex flex-1 justify-center">
          <button
            type="button"
            onClick={openTrade}
            aria-label={onTrade ? "Open order ticket" : `Trade ${symbol ?? "instruments"}`}
            aria-haspopup="dialog"
            className={cn(
              "-translate-y-4 flex h-14 w-14 items-center justify-center rounded-full border-4 border-canvas bg-brand text-white shadow-2xl transition active:scale-95 focus-visible:outline-2 focus-visible:outline-brand",
              onTrade && "ring-2 ring-brand/40 ring-offset-2 ring-offset-canvas",
            )}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M3 17l6-6 4 4 8-8" /><path d="M21 7v6h-6" />
            </svg>
          </button>
        </li>
        {rightItems.map((item) => (
          <li key={item.label} className="flex-1">{navLink(item)}</li>
        ))}
      </ul>
    </nav>
  );
}

/** Phone bottom navigation (<md): Markets / Positions / Account plus the
 *  raised center Trade action. The Trade destination is an action, not a
 *  route link — it opens the order ticket like the web FAB. Tablet and
 *  desktop keep their inline navigation. Fixed above the safe area; pages
 *  add matching bottom padding so content is never covered. */
export function MobileTabBar() {
  return (
    <Suspense fallback={null}>
      <MobileTabBarInner />
    </Suspense>
  );
}
