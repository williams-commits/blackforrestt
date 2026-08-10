"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { clientTradeUrl } from "@/lib/branding";
import type { InstrumentView } from "@/lib/types";
import { formatPrice, formatChange } from "@/lib/landingUi";
import { InstrumentIcon } from "@/components/icons/InstrumentIcon";

interface LivePriceProps {
  /** Initial server-rendered instrument (avoids layout shift / empty flash). */
  initial: InstrumentView;
}

/**
 * Refreshes a single instrument's bid/ask/mid/change by polling the public
 * /api/instruments endpoint. Mirrors the InformersWidget polling pattern (every
 * few seconds). Only this card's numbers update — the rest of the page is
 * static server HTML.
 */
export function LivePrice({ initial }: LivePriceProps) {
  const [inst, setInst] = useState<InstrumentView>(initial);
  const t = useTranslations("hero.featured");

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const res = await fetch("/api/instruments", { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as { instruments: InstrumentView[] };
        if (!active) return;
        const found = data.instruments.find((i) => i.symbol === initial.symbol);
        if (found) setInst(found);
      } catch {
        /* offline — keep last known values */
      }
    };
    const id = setInterval(load, 3000);
    return () => {
      active = false;
      clearInterval(id);
    };
  }, [initial.symbol]);

  const up = inst.changePct >= 0;
  const href = clientTradeUrl(`/trade/${inst.symbol}`);

  return (
    <a
      href={href}
      className="group block rounded-xl border border-border bg-canvas p-5 hover:shadow-card transition"
    >
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <InstrumentIcon symbol={inst.symbol} size={24} />
            <span className="font-mono text-sm font-semibold tracking-tight">{inst.symbol}</span>
            <span className="text-xs text-text-faint">{inst.name}</span>
          </div>
          <div className="mt-1 text-[11px] uppercase tracking-widest text-brand">{t("label")}</div>
        </div>
        <span className={`tnum text-sm font-semibold ${up ? "text-up" : "text-down"}`}>
          {formatChange(inst.changePct)}
        </span>
      </div>

      <div className="mt-4 flex items-end justify-between">
        <div>
          <div className="text-[10px] uppercase tracking-widest text-text-faint">{t("mid")}</div>
          <div className="tnum font-mono text-2xl font-semibold">{formatPrice(inst.mid, inst.digits)}</div>
        </div>
        <div className="flex gap-4 text-right">
          <div>
            <div className="text-[10px] uppercase tracking-widest text-text-faint">{t("bid")}</div>
            <div className="tnum font-mono text-sm text-down">{formatPrice(inst.bid, inst.digits)}</div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-widest text-text-faint">{t("ask")}</div>
            <div className="tnum font-mono text-sm text-up">{formatPrice(inst.ask, inst.digits)}</div>
          </div>
        </div>
      </div>

      {/* Sparkline-ish pulse strip: visual rhythm from the change sign. */}
      <div className="mt-4 flex items-center gap-1.5 h-8" aria-hidden="true">
        {Array.from({ length: 24 }).map((_, i) => {
          const seed = (i * 7 + inst.symbol.charCodeAt(0)) % 10;
          const h = 20 + ((seed * 13 + Math.abs(inst.changePct * 100)) % 70);
          return (
            <span
              key={i}
              className={`flex-1 rounded-sm ${up ? "bg-up/60" : "bg-down/50"}`}
              style={{ height: `${Math.min(100, h)}%`, opacity: 0.4 + (i / 24) * 0.6 }}
            />
          );
        })}
      </div>

      <div className="mt-4 flex items-center justify-between text-xs">
        <span className="text-text-muted">{t("tradeNow", { symbol: inst.symbol })}</span>
        <span className="text-brand font-semibold group-hover:translate-x-0.5 transition">→</span>
      </div>
    </a>
  );
}
