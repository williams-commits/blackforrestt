"use client";

import { Suspense } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Activity, CandlestickChart, TrendingUpDown, User } from "lucide-react";
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
        "mx-1 flex min-h-14 flex-col items-center justify-center gap-0.5 rounded-xl px-1 text-(length:--term-text-2xs) font-medium transition-all duration-150 active:scale-95 focus-visible:outline-2 focus-visible:outline-brand",
        item.active ? "bg-brand-soft text-brand m-0.5" : "text-text-muted hover:text-text",
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
      <ul className="grid grid-cols-5">
        {navItems.map((item) => (
          <li key={item.label}>{navLink(item)}</li>
        ))}
        {/* Center Trade action — the fifth, in-flow center button. Same job
            and brand styling as the web FAB (brand fill + arrow glyph), sized
            and aligned with the nav items around it. */}
        <li>
          <button
            type="button"
            onClick={openTrade}
            aria-label={onTrade ? "Open order ticket" : `Trade ${symbol ?? "instruments"}`}
            aria-haspopup="dialog"
            className="flex min-h-14 w-full flex-col items-center justify-center gap-0.5 px-1 transition focus-visible:outline-2 focus-visible:outline-brand active:scale-95"
          >
            <span className={cn(
              "flex h-9 w-9 items-center justify-center rounded-full bg-brand text-white shadow-sm transition",
              onTrade && "ring-2 ring-brand/40",
            )}>
              <TrendingUpDown size={16} strokeWidth={2} aria-hidden />
            </span>
            <span className="text-(length:--term-text-2xs) font-semibold text-brand">Trade</span>
          </button>
        </li>
        {rightItems.map((item) => (
          <li key={item.label}>{navLink(item)}</li>
        ))}
      </ul>
    </nav>
  );
}

/** Phone bottom navigation (<md): five in-flow destinations — Markets,
 *  Positions, Trade (center action), Account. Trade opens the order
 *  ticket like the web FAB rather than linking to a route. Tablet and
 *  desktop keep their inline navigation. Fixed above the safe area; pages
 *  add matching bottom padding so content is never covered. */
export function MobileTabBar() {
  return (
    <Suspense fallback={null}>
      <MobileTabBarInner />
    </Suspense>
  );
}
