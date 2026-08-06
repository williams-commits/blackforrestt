import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { AdminError, requireAdminContext } from "@/server/admin";
import { Logo } from "@/components/trade/Logo";
import { AdminWorkspace } from "@/components/admin/AdminWorkspace";
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

  return (
    <div className="min-h-screen bg-panel">
      <header className="sticky top-0 z-30 flex min-h-12 flex-wrap items-center gap-4 border-b border-border bg-canvas px-4 py-2">
        <Logo />
        <nav className="flex items-center gap-4 text-xs" aria-label="Primary">
          <Link href="/trade/AUDCAD" className="text-text-muted hover:text-text">Trade</Link>
          <Link href="/account" className="text-text-muted hover:text-text">Account</Link>
          <span className="font-medium text-text">Operations</span>
        </nav>
        <div className="ml-auto text-xs text-text-muted">{userName}</div>
      </header>
      <main id="main-content" tabIndex={-1} className="mx-auto max-w-screen-2xl px-4 py-6">
        <AdminWorkspace userName={userName} roles={context.roles} permissions={context.permissions} simpleApproval={simplePaymentApproval()} />
      </main>
    </div>
  );
}
