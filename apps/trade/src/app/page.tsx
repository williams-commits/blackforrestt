import { redirect } from "next/navigation";
import { listInstrumentViews } from "@/server/instruments";

export const dynamic = "force-dynamic";

/**
 * Trade-origin root. The middleware treats `/` as a marketing path and
 * redirects it to the family's apex site, so this page only renders when that
 * handoff is bypassed — in that case route straight into the terminal on the
 * configured default instrument (first active instrument; never a hardcoded
 * symbol) rather than showing a placeholder. `/trade/[symbol]` carries the
 * auth gate, so unauthenticated visitors land on /login from there.
 */
export default async function TradeHome() {
  const instruments = await listInstrumentViews();
  const first = instruments[0];
  if (!first) redirect("/login");
  redirect(`/trade/${encodeURIComponent(first.symbol)}`);
}
