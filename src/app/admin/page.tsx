import Link from "next/link";
import { Shield } from "lucide-react";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { AdminError, requireAdminContext } from "@/server/admin";
import { Logo } from "@/components/trade/Logo";
import { AdminWorkspace } from "@/components/admin/AdminWorkspace";
import { AdminSignOutButton } from "@/components/admin/AdminSignOutButton";
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
    <div className="min-h-screen bg-panel">
      {/* Operations header — deliberately distinct from the customer app: a
          dark console bar with the environment badge and the operator's roles,
          so nobody mistakes production for the trading UI. */}
      <header className="sticky top-0 z-30 border-b border-slate-700 bg-slate-900 text-slate-100">
        <div className="flex min-h-12 flex-wrap items-center gap-x-4 gap-y-2 px-4 py-2">
          <div className="flex items-center gap-3">
            <Logo inverted />
            <span className="hidden h-5 w-px bg-slate-700 sm:block" aria-hidden />
            <span className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-300">
              <Shield size={14} strokeWidth={2} aria-hidden />
              Operations Console
            </span>
          </div>

          <span
            className={`rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
              isSimulation
                ? "border-amber-400/50 bg-amber-400/10 text-amber-300"
                : "border-red-400/60 bg-red-500/15 text-red-300"
            }`}
            title={`Market data mode: ${process.env.MARKET_DATA_MODE ?? "simulation"}`}
          >
            {isSimulation ? "SIM" : "Live"}
          </span>

          <nav className="flex items-center gap-3 text-xs" aria-label="Primary">
            <Link href="/trade/AUDCAD" className="text-slate-400 transition hover:text-white">Trade</Link>
            <Link href="/account" className="text-slate-400 transition hover:text-white">Account</Link>
            <span className="font-medium text-white" aria-current="page">Operations</span>
          </nav>

          <div className="ml-auto flex flex-wrap items-center gap-2">
            {context.roles.slice(0, 3).map((role) => (
              <span key={role} className="rounded bg-slate-800 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-slate-300 ring-1 ring-inset ring-slate-700">
                {role.replaceAll("_", " ")}
              </span>
            ))}
            <span className="hidden h-5 w-px bg-slate-700 sm:block" aria-hidden />
            <span className="max-w-40 truncate text-xs text-slate-300">{userName}</span>
            <AdminSignOutButton />
          </div>
        </div>
      </header>
      <main id="main-content" tabIndex={-1} className="mx-auto max-w-screen-2xl px-4 py-6">
        <AdminWorkspace userName={userName} roles={context.roles} permissions={context.permissions} simpleApproval={simplePaymentApproval()} />
      </main>
    </div>
  );
}
