"use client";

import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { ArticleLayout, Section } from "@/components/landing/ArticleLayout";

interface Signal {
  symbol: string;
  name: string;
  side: "BUY" | "SELL";
  confidence: "high" | "medium" | "low";
  reason: string;
  price: number;
  entry: number;
  stop: number;
  target: number;
  changePct: number;
}

interface SignalsResponse {
  signals: Signal[];
  asOf: string;
}

export default function SignalsPage() {
  const t = useTranslations("signals");
  const { data, error, isLoading } = useQuery<SignalsResponse>({
    queryKey: ["signals"],
    queryFn: async () => {
      const res = await fetch("/api/analysis/signals", { cache: "no-store" });
      if (!res.ok) throw new Error(t("errorThrow"));
      return (await res.json()) as SignalsResponse;
    },
    refetchInterval: 10_000,
    retry: 1,
  });

  const signals = data?.signals ?? [];

  return (
    <ArticleLayout
      eyebrow={t("eyebrow")}
      title={t("title")}
      description={t("description")}
    >
      {error ? (
        <div className="bg-canvas border border-border rounded-xl p-5 text-sm text-text-muted" role="alert">
          {error instanceof Error ? error.message : t("error")}
        </div>
      ) : isLoading ? (
        <div className="bg-canvas border border-border rounded-xl p-5 text-sm text-text-faint">{t("loading")}</div>
      ) : signals.length === 0 ? (
        <div className="bg-canvas border border-border rounded-xl p-5 text-sm text-text-faint">
          {t("empty")}
        </div>
      ) : (
        <div className="space-y-4">
          {signals.map((s) => <SignalCard key={s.symbol} signal={s} />)}
        </div>
      )}

      <Section title={t("disclaimerTitle")}>
        <p>{t("disclaimerBody")}</p>
      </Section>
    </ArticleLayout>
  );
}

function SignalCard({ signal: s }: { signal: Signal }) {
  const t = useTranslations("signals");
  const buy = s.side === "BUY";
  const rr = Math.abs(s.target - s.entry) / Math.abs(s.entry - s.stop);
  const digits = s.symbol.includes("JPY") ? 3 : /^(BTC|ETH|US30|NAS100|SPX500|AAPL|MSFT|NVDA|TSLA)/.test(s.symbol) ? 2 : 5;
  const confidenceMap = {
    high: { label: t("highConf"), cls: "bg-up/15 text-up" },
    medium: { label: t("medConf"), cls: "bg-brand-soft text-brand" },
    low: { label: t("lowConf"), cls: "bg-panel-2 text-text-muted" },
  } as const;
  const conf = confidenceMap[s.confidence];

  return (
    <div className="bg-canvas border border-border rounded-xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-border bg-panel-2">
        <div className="flex items-center gap-3">
          <span className="text-base font-bold">{s.symbol}</span>
          <span className={`px-2.5 py-0.5 rounded text-xs font-bold text-white ${buy ? "bg-up" : "bg-down"}`}>
            {buy ? t("buy") : t("sell")}
          </span>
          <span className={`text-[11px] px-2 py-0.5 rounded font-medium ${conf.cls}`}>{conf.label}</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[11px] text-text-faint">{s.changePct >= 0 ? "+" : ""}{s.changePct.toFixed(2)}{t("today")}</span>
        </div>
      </div>

      {/* Levels */}
      <div className="grid grid-cols-3 divide-x divide-border">
        <Level label={t("entry")} value={s.entry.toFixed(digits)} />
        <Level label={t("stopLoss")} value={s.stop.toFixed(digits)} cls="text-down" />
        <Level label={t("takeProfit")} value={s.target.toFixed(digits)} cls="text-up" />
      </div>

      {/* Body */}
      <div className="px-5 py-4">
        <p className="text-sm text-text-muted leading-relaxed">{s.reason}</p>
        <div className="mt-3 flex items-center gap-4 text-[11px] text-text-faint">
          <span>{t("riskReward")} <span className="text-text font-medium tnum">1 : {rr.toFixed(1)}</span></span>
          <span>{t("pipsAtRisk")} <span className="text-text font-medium tnum">{Math.abs((s.entry - s.stop) / (digits === 3 ? 0.01 : 0.0001)).toFixed(0)}</span></span>
          <span>{t("pipsToTarget")} <span className="text-text font-medium tnum">{Math.abs((s.target - s.entry) / (digits === 3 ? 0.01 : 0.0001)).toFixed(0)}</span></span>
        </div>
      </div>
    </div>
  );
}

function Level({ label, value, cls = "" }: { label: string; value: string; cls?: string }) {
  return (
    <div className="px-5 py-3 text-center">
      <div className="text-[11px] text-text-faint uppercase">{label}</div>
      <div className={`text-lg font-bold tnum mt-0.5 ${cls}`}>{value}</div>
    </div>
  );
}
