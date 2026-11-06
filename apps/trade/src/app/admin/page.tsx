import Link from "next/link";
import { CandlestickChart, Shield, User } from "lucide-react";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { AdminError, requireAdminContext } from "@/server/admin";
import { Logo } from "@/components/trade/Logo";
import { AdminWorkspace } from "@/components/admin/AdminWorkspace";
import { AccountUserMenu } from "@/components/account/AccountUserMenu";
import { TradeSearchButton } from "@/components/GlobalSearchPalette";
import { simplePaymentApproval } from "@/server/payments";

export const dynamic = "force-dynamic";

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Admin Console",
  description: "Operations console for platform administrators.",
  robots: { index: false, follow: false },
}


export default async function AdminPage() {
  let context;
  try {
    context = await requireAdminContext("ADMIN_DASHBOARD");
  } catch (error) {
    if (error instanceof AdminError && error.status === 401) redirect("/login?callbackUrl=/admin");
    if (error instanceof AdminError && error.status === 403) redirect("/account?admin=forbidden");
    throw error;
  }
  const session = await auth();
  const userName = session?.user?.name ?? session?.user?.email ?? context.actorId;
  // Live vs simulation — an ops console should never make you guess.
  const isSimulation = process.env.MARKET_DATA_MODE !== "live";

  return (
    <div className="flat-ui terminal-ui min-h-screen">
      <header className="sticky top-0 z-30 flex min-h-12 flex-wrap items-center gap-3 bg-card px-3 py-2 sm:flex-nowrap sm:px-4">
        <Logo />
        <nav
          aria-label="Primary"
          className="order-3 flex w-full items-center gap-1 overflow-x-auto text-xs sm:order-0 sm:w-auto"
        >
          <Link
            href="/trade/AUDCAD"
            className="flex shrink-0 items-center gap-1.5 rounded-md px-2 py-1.5 text-muted-foreground transition-colors duration-150 hover:bg-accent hover:text-foreground"
          >
            <CandlestickChart size={14} strokeWidth={2} aria-hidden />
            <span className="hidden sm:inline">Trade Terminal</span>
            <span className="sm:hidden">Trade</span>
          </Link>
          <Link
            href="/account"
            className="flex shrink-0 items-center gap-1.5 rounded-md px-2 py-1.5 text-muted-foreground transition-colors duration-150 hover:bg-accent hover:text-foreground"
          >
            <User size={14} strokeWidth={2} aria-hidden />
            Account
          </Link>
          <Link
            href="/admin"
            aria-current="page"
            className="flex shrink-0 items-center gap-1.5 rounded-md bg-accent px-2 py-1.5 font-semibold text-foreground"
          >
            <Shield size={14} strokeWidth={2} aria-hidden />
            <span className="hidden sm:inline">Operations</span>
            <span className="sm:hidden">Admin</span>
          </Link>
        </nav>

        <div className="ml-auto flex shrink-0 items-center gap-1.5">
          <span
            className={`rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
              isSimulation
                ? "border-transparent bg-(--term-warning-bg) text-(--term-warning-fg)"
                : "border-down/30 bg-down/10 text-down"
            }`}
            title={`Market data mode: ${process.env.MARKET_DATA_MODE ?? "simulation"}`}
          >
            {isSimulation ? "SIM" : "Live"}
          </span>
          <TradeSearchButton className="hidden sm:flex" />
          <AccountUserMenu
            displayName={userName}
            email={session?.user?.email ?? ""}
            accountNo={null}
            secondaryLabel={context.roles.slice(0, 2).map((role) => role.replaceAll("_", " ")).join(" · ") || "Operations"}
            isAdmin
          />
        </div>
      </header>
      <main id="main-content" tabIndex={-1} className="mx-auto max-w-screen-2xl px-4 py-6">
        <AdminWorkspace permissions={context.permissions} simpleApproval={simplePaymentApproval()} />
      </main>
    </div>
  );
}
