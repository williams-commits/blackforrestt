"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArticleLayout, Section } from "@/components/landing/ArticleLayout";

type Bias = "bullish" | "bearish" | "neutral";

interface AnalysisResponse {
  symbol: string;
  interval: string;
  price: number;
  changePct: number;
  indicators: { sma20: number | null; sma50: number | null; rsi14: number | null; atr14: number | null };
  levels: { support: number | null; resistance: number | null };
  bias: Bias;
  high24h: number;
  low24h: number;
  asOf: string;
}

interface InstrumentListItem {
  symbol: string;
  name: string;
  category: string;
  digits: number;
}

const INTERVALS = ["1m", "5m", "15m", "1h", "4h", "1d"] as const;

const BIAS_STYLE: Record<Bias, { chip: string; label: string; arrow: string }> = {
  bullish: { chip: "bg-up/15 text-up", label: "Bullish bias", arrow: "↑" },
  bearish: { chip: "bg-down/15 text-down", label: "Bearish bias", arrow: "↓" },
  neutral: { chip: "bg-brand-soft text-brand", label: "Neutral / Range", arrow: "↔" },
};

function fmt(value: number | null | undefined, digits: number): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return value.toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

export default function TechnicalPage() {
  const [symbol, setSymbol] = useState("EURUSD");
  const [tf, setTf] = useState<(typeof INTERVALS)[number]>("1h");

  const instruments = useQuery<InstrumentListItem[]>({
    queryKey: ["instruments"],
    queryFn: async () => {
      const res = await fetch("/api/instruments", { cache: "no-store" });
      const data = await res.json();
      return (data.instruments ?? []) as InstrumentListItem[];
    },
    staleTime: 60_000,
  });

  const analysis = useQuery<AnalysisResponse>({
    queryKey: ["technical", symbol, tf],
    queryFn: async () => {
      const res = await fetch(`/api/analysis/technical?symbol=${symbol}&interval=${tf}`, { cache: "no-store" });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? "Analysis unavailable");
      return (await res.json()) as AnalysisResponse;
    },
    refetchInterval: 5_000,
    retry: 1,
  });

  const data = analysis.data;
  const digits = instruments.data?.find((i) => i.symbol === symbol)?.digits ?? 5;
  const biasStyle = data ? BIAS_STYLE[data.bias] : BIAS_STYLE.neutral;

  return (
    <ArticleLayout
      eyebrow="Analytics"
      title="Technical Analysis"
      description="Live technical breakdowns computed from current price action — moving averages, RSI, ATR, and support/resistance levels."
    >
      {/* Controls */}
      <div className="bg-canvas border border-border rounded-xl p-4 mb-4 flex flex-wrap items-center gap-3">
        <label className="text-[11px] text-text-muted">
          Instrument
          <select
            value={symbol}
            onChange={(e) => setSymbol(e.target.value)}
            className="ml-2 h-9 rounded border border-border bg-panel px-2 text-sm"
          >
            {(instruments.data ?? []).map((i) => (
              <option key={i.symbol} value={i.symbol}>{i.symbol} — {i.name}</option>
            ))}
          </select>
        </label>
        <label className="text-[11px] text-text-muted">
          Timeframe
          <select
            value={tf}
            onChange={(e) => setTf(e.target.value as (typeof INTERVALS)[number])}
            className="ml-2 h-9 rounded border border-border bg-panel px-2 text-sm"
          >
            {INTERVALS.map((tf) => <option key={tf} value={tf}>{tf}</option>)}
          </select>
        </label>
      </div>

      {analysis.error ? (
        <div className="bg-canvas border border-border rounded-xl p-5 text-sm text-text-muted" role="alert">
          {analysis.error instanceof Error ? analysis.error.message : "Analysis is unavailable right now."}
        </div>
      ) : !data ? (
        <div className="bg-canvas border border-border rounded-xl p-5 text-sm text-text-faint">Computing analysis…</div>
      ) : (
        <div className="bg-canvas border border-border rounded-xl overflow-hidden">
          <div className="px-5 py-3 border-b border-border bg-panel-2 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-base font-bold">{data.symbol}</span>
              <span className={`text-[11px] px-2 py-0.5 rounded font-medium ${biasStyle.chip}`}>{biasStyle.label}</span>
            </div>
            <span className="text-[11px] text-text-faint">{data.interval.toUpperCase()} · {new Date(data.asOf).toLocaleTimeString("en-GB")}</span>
          </div>
          <div className="p-5 space-y-4">
            <Section>
              <p>
                {data.symbol} trades at <strong>{fmt(data.price, digits)}</strong>{" "}
                ({data.changePct >= 0 ? "+" : ""}{data.changePct.toFixed(2)}% on the day). The {data.interval.toUpperCase()}{" "}
                structure is <strong>{biasStyle.label.toLowerCase()}</strong>: SMA(20) sits at {fmt(data.indicators.sma20, digits)}{" "}
                and SMA(50) at {fmt(data.indicators.sma50, digits)}. RSI(14) reads {data.indicators.rsi14 != null ? data.indicators.rsi14.toFixed(1) : "—"}.
              </p>
            </Section>
            <div className="grid grid-cols-3 gap-3">
              <Level label="24h High" value={fmt(data.high24h, digits)} />
              <Level label="Resistance" value={fmt(data.levels.resistance, digits)} />
              <Level label="Current" value={fmt(data.price, digits)} highlight />
              <Level label="Support" value={fmt(data.levels.support, digits)} />
              <Level label="24h Low" value={fmt(data.low24h, digits)} />
              <Level label="Trend" value={`${biasStyle.arrow} ${data.bias === "neutral" ? "Range" : data.bias === "bullish" ? "Higher" : "Lower"}`} />
            </div>
            <Section>
              <p>
                <strong>Key levels:</strong> Immediate resistance is {fmt(data.levels.resistance, digits)} with support at{" "}
                {fmt(data.levels.support, digits)}. A break of resistance targets further upside; losing support invalidates the
                near-term structure. ATR(14) at {data.indicators.atr14 != null ? data.indicators.atr14.toFixed(5) : "—"} reflects current volatility.
              </p>
            </Section>
          </div>
        </div>
      )}

      <Section title="How to read this analysis">
        <p>
          <strong>Support</strong> is a price level where buying interest tends to emerge; <strong>resistance</strong>
          is where selling pressure builds. The <strong>trend</strong> direction tells you whether to bias
          your trades long (↑), short (↓), or stay flat (↔). Always pair technical levels with sound risk
          management — never risk more than 1–2% of your account on a single trade.
        </p>
      </Section>
    </ArticleLayout>
  );
}

function Level({ label, value, highlight = false }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={`rounded-lg p-3 ${highlight ? "bg-brand-soft border border-brand/30" : "bg-panel border border-border"}`}>
      <div className="text-[11px] text-text-faint uppercase">{label}</div>
      <div className={`text-sm font-bold tnum mt-0.5 ${highlight ? "text-brand" : "text-text"}`}>{value}</div>
    </div>
  );
}
