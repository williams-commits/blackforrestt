"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useQuery } from "@tanstack/react-query";
import { ArticleLayout, Section } from "@/components/landing/ArticleLayout";

type Impact = "high" | "medium" | "low";

interface CalendarItem {
  id: string;
  iso: string;
  currency: string;
  impact: Impact;
  title: string;
  actual: string | null;
  forecast: string | null;
  previous: string | null;
}

interface CalendarResponse {
  items: CalendarItem[];
  asOf?: string;
  cached?: boolean;
}

const CURRENCIES = ["ALL", "USD", "EUR", "GBP", "JPY", "AUD", "CAD", "NZD", "CHF"] as const;
const IMPACT_LABEL_KEY: Record<Impact, "impHigh" | "impMedium" | "impLow"> = {
  high: "impHigh",
  medium: "impMedium",
  low: "impLow",
};

export default function CalendarPage() {
  const t = useTranslations("calendars");
  const [filter, setFilter] = useState<(typeof CURRENCIES)[number]>("ALL");
  const [impactFilter, setImpactFilter] = useState<"all" | Impact>("all");

  const currenciesParam = filter === "ALL" ? "" : filter;
  const impactParam = impactFilter === "all" ? "" : impactFilter;

  const { data, error, isLoading } = useQuery<CalendarResponse>({
    queryKey: ["economic-calendar", filter, impactFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set("scope", "week");
      if (currenciesParam) params.set("currencies", currenciesParam);
      if (impactParam) params.set("impact", impactParam);
      const res = await fetch(`/api/economic-calendar?${params.toString()}`, { cache: "no-store" });
      if (!res.ok) throw new Error(t("errorThrow"));
      return (await res.json()) as CalendarResponse;
    },
    refetchInterval: 300_000,
    retry: 1,
  });

  const events = data?.items ?? [];

  return (
    <ArticleLayout
      eyebrow={t("eyebrow")}
      title={t("title")}
      description={t("description")}
    >
      {/* Filters */}
      <Section>
        <div className="flex flex-wrap items-center gap-2">
          {CURRENCIES.map((c) => (
            <button
              key={c}
              onClick={() => setFilter(c)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${filter === c ? "bg-brand text-white" : "bg-panel border border-border text-text-muted hover:text-text"}`}
            >
              {c}
            </button>
          ))}
          <div className="w-px h-6 bg-border mx-1" />
          {(["all", "high", "medium", "low"] as const).map((imp) => (
            <button
              key={imp}
              onClick={() => setImpactFilter(imp)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition ${impactFilter === imp ? "bg-text text-canvas" : "bg-panel border border-border text-text-muted hover:text-text"}`}
            >
              {imp === "all" ? t("filterImpactAll") : t(IMPACT_LABEL_KEY[imp])}
            </button>
          ))}
        </div>
      </Section>

      {/* Calendar table */}
      <Section>
        <div className="bg-canvas border border-border rounded-xl overflow-hidden overflow-x-auto">
          <table className="w-full">
            <thead className="bg-panel-2 border-b border-border">
              <tr>
                <th className="text-left text-[11px] uppercase text-text-faint font-medium px-4 py-2.5">{t("thDateTime")}</th>
                <th className="text-left text-[11px] uppercase text-text-faint font-medium px-4 py-2.5">{t("thCurrency")}</th>
                <th className="text-left text-[11px] uppercase text-text-faint font-medium px-4 py-2.5">{t("thImpact")}</th>
                <th className="text-left text-[11px] uppercase text-text-faint font-medium px-4 py-2.5">{t("thEvent")}</th>
                <th className="text-right text-[11px] uppercase text-text-faint font-medium px-4 py-2.5">{t("thActual")}</th>
                <th className="text-right text-[11px] uppercase text-text-faint font-medium px-4 py-2.5">{t("thForecast")}</th>
                <th className="text-right text-[11px] uppercase text-text-faint font-medium px-4 py-2.5">{t("thPrevious")}</th>
              </tr>
            </thead>
            <tbody>
              {error ? (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-down text-sm">
                    {error instanceof Error ? error.message : t("error")}
                  </td>
                </tr>
              ) : isLoading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-text-faint text-sm">{t("loading")}</td>
                </tr>
              ) : events.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-text-faint text-sm">{t("empty")}</td>
                </tr>
              ) : (
                events.map((e) => (
                  <tr key={e.id} className="border-t border-border hover:bg-panel transition-colors">
                    <td className="px-4 py-2.5 text-xs tnum text-text-muted whitespace-nowrap">
                      {e.iso ? new Date(e.iso).toLocaleString("en-GB", { weekday: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : ""}
                    </td>
                    <td className="px-4 py-2.5">
                      <span className="text-xs font-semibold px-2 py-0.5 rounded bg-panel-2 border border-border">{e.currency}</span>
                    </td>
                    <td className="px-4 py-2.5">
                      <ImpactDot impact={e.impact} label={t(IMPACT_LABEL_KEY[e.impact])} />
                    </td>
                    <td className="px-4 py-2.5 text-sm font-medium">{e.title}</td>
                    <td className="px-4 py-2.5 text-sm text-right tnum font-medium">{e.actual ?? "—"}</td>
                    <td className="px-4 py-2.5 text-sm text-right tnum text-text-muted">{e.forecast ?? "—"}</td>
                    <td className="px-4 py-2.5 text-sm text-right tnum text-text-muted">{e.previous ?? "—"}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {data?.cached && <p className="mt-2 text-[11px] text-text-faint">{t("cached")}</p>}
      </Section>

      <Section title={t("howTitle")}>
        <p>{t("howP1")}</p>
        <p>{t("howP2")}</p>
      </Section>
    </ArticleLayout>
  );
}

function ImpactDot({ impact, label }: { impact: Impact; label: string }) {
  const map = { high: "bg-down", medium: "bg-brand", low: "bg-up" } as const;
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`h-2 w-2 rounded-full ${map[impact]}`} />
      <span className="text-[11px] text-text-muted">{label}</span>
    </span>
  );
}
