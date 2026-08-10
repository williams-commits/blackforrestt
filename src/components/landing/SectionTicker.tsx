"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { clientTradeUrl } from "@/lib/branding";
import { InstrumentIcon } from "@/components/icons/InstrumentIcon";
import type { InstrumentCategory, InstrumentView } from "@/lib/types";
import { CATEGORY_LABEL, formatPrice, formatChange } from "@/lib/landingUi";

interface SectionTickerProps {
  category: InstrumentCategory;
  /** Server-rendered rows (initial values, avoids empty flash). */
  initial: InstrumentView[];
}

/**
 * A live instrument table for one asset class. Renders the server-provided rows
 * immediately, then polls /api/instruments every few seconds and refreshes only
 * the numeric cells. Each row links straight to the per-instrument trade route
 * on the trade subdomain.
 */
export function SectionTicker({ category, initial }: SectionTickerProps) {
  const [rows, setRows] = useState<InstrumentView[]>(initial);
  const t = useTranslations("markets.table");
  const catLabel = CATEGORY_LABEL[category];

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const res = await fetch("/api/instruments", { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as { instruments: InstrumentView[] };
        if (!active) return;
        const next = data.instruments.filter((i) => i.category === category);
        if (next.length > 0) setRows(next);
      } catch {
        /* offline — keep last known values */
      }
    };
    const id = setInterval(load, 3000);
    return () => {
      active = false;
      clearInterval(id);
    };
  }, [category]);

  if (rows.length === 0) {
    return <p className="text-sm text-text-muted">{t("loading")}</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="text-left text-[10px] uppercase tracking-widest text-text-faint border-b border-border-soft">
            <th className="py-2 pr-4 font-semibold">{t("symbol")}</th>
            <th className="py-2 pr-4 font-semibold hidden sm:table-cell">{t("name")}</th>
            <th className="py-2 pr-4 font-semibold text-right">{t("bid")}</th>
            <th className="py-2 pr-4 font-semibold text-right">{t("ask")}</th>
            <th className="py-2 pl-4 font-semibold text-right">{t("change24h")}</th>
          </tr>
        </thead>
        <tbody className="font-mono">
          {rows.slice(0, 8).map((r) => {
            const up = r.changePct >= 0;
            return (
              <tr
                key={r.symbol}
                className="border-b border-border-soft last:border-0 hover:bg-panel-2 transition"
              >
                <td className="py-2.5 pr-4">
                  <a
                    href={clientTradeUrl(`/trade/${r.symbol}`)}
                    className="flex items-center gap-2 font-semibold text-text hover:text-brand transition"
                  >
                    <InstrumentIcon symbol={r.symbol} size={16} />
                    {r.symbol}
                  </a>
                </td>
                <td className="py-2.5 pr-4 hidden sm:table-cell">
                  <span className="text-text-muted font-sans text-xs truncate">{r.name}</span>
                </td>
                <td className="tnum py-2.5 pr-4 text-right text-down">{formatPrice(r.bid, r.digits)}</td>
                <td className="tnum py-2.5 pr-4 text-right text-up">{formatPrice(r.ask, r.digits)}</td>
                <td className={`tnum py-2.5 pl-4 text-right font-semibold ${up ? "text-up" : "text-down"}`}>
                  {formatChange(r.changePct)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="mt-3 text-[11px] text-text-faint">
        {t("count", { count: rows.length, label: catLabel })}
      </p>
    </div>
  );
}
