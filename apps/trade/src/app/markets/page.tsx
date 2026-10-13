import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { listInstrumentViews } from "@/server/instruments";
import { MarketsClient } from "@/components/trade/MarketsClient";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Markets",
  description: "Browse and search live instruments.",
  robots: { index: false, follow: false },
};

/** Full-width market browser (the mobile Markets destination; works at any
 *  width). Same instrument source and socket the terminal uses — no separate
 *  feed, no synthetic data. */
export default async function MarketsPage() {
  const session = await import("@/auth").then((m) => m.auth());
  if (!session?.user?.id) redirect("/login");
  const instruments = await listInstrumentViews();
  if (instruments.length === 0) {
    return (
      <main id="main-content" tabIndex={-1} className="terminal-ui flex min-h-dvh items-center justify-center bg-canvas">
        <p className="text-sm text-text-muted">No instruments are currently configured.</p>
      </main>
    );
  }
  return <MarketsClient instruments={instruments} />;
}
