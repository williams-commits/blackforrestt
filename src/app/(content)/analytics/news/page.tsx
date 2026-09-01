"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useQuery } from "@tanstack/react-query";
import { ArticleLayout } from "@/landing/composition";

interface NewsItem {
  id: number;
  headline: string;
  source: string;
  url: string;
  summary: string;
  related: string;
  time: number;
  image: string;
}

interface NewsResponse {
  items: NewsItem[];
  asOf?: string;
  cached?: boolean;
}

const FILTERS = ["general", "forex", "crypto", "merger"] as const;
const FILTER_KEY: Record<(typeof FILTERS)[number], "catGeneral" | "catForex" | "catCrypto" | "catMerger"> = {
  general: "catGeneral",
  forex: "catForex",
  crypto: "catCrypto",
  merger: "catMerger",
};

export default function NewsPage() {
  const t = useTranslations("news");
  const [category, setCategory] = useState<(typeof FILTERS)[number]>("general");

  const { data, error, isLoading } = useQuery<NewsResponse>({
    queryKey: ["market-news", category],
    queryFn: async () => {
      const res = await fetch(`/api/market-news?category=${category}`, { cache: "no-store" });
      if (!res.ok) throw new Error(t("errorThrow"));
      return (await res.json()) as NewsResponse;
    },
    refetchInterval: 60_000,
    retry: 1,
  });

  const items = data?.items ?? [];

  return (
    <ArticleLayout
      eyebrow={t("eyebrow")}
      title={t("title")}
      description={t("description")}
      sidebar={
        <div className="bg-panel border border-border rounded-xl p-5">
          <h3 className="text-sm font-semibold mb-3">{t("category")}</h3>
          <div className="flex flex-wrap gap-1.5">
            {FILTERS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setCategory(c)}
                className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${c === category ? "bg-brand text-white border-brand" : "bg-canvas border-border text-text-muted hover:border-brand"}`}
              >
                {t(FILTER_KEY[c])}
              </button>
            ))}
          </div>
          <p className="mt-4 text-[11px] text-text-faint">
            {data?.cached ? t("noteCached") : t("noteDefault")}
          </p>
        </div>
      }
    >
      {error ? (
        <div className="bg-canvas border border-border rounded-xl p-5 text-sm text-text-muted" role="alert">
          {error instanceof Error ? error.message : t("error")}
        </div>
      ) : isLoading ? (
        <div className="bg-canvas border border-border rounded-xl p-5 text-sm text-text-faint">{t("loading")}</div>
      ) : items.length === 0 ? (
        <div className="bg-canvas border border-border rounded-xl p-5 text-sm text-text-faint">{t("empty")}</div>
      ) : (
        <div className="space-y-3">
          {items.map((n) => (
            <article key={n.id} className="bg-canvas border border-border rounded-xl p-5 hover:shadow-card transition">
              <div className="flex items-center gap-3 mb-2">
                <span className="text-[11px] tnum text-text-faint">
                  {n.time ? new Date(n.time * 1000).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" }) : ""}
                </span>
                <span className="text-[11px] px-2 py-0.5 rounded bg-panel-2 border border-border font-medium">{n.source}</span>
                {n.related && <span className="text-[11px] px-2 py-0.5 rounded bg-brand-soft text-brand font-medium">{n.related}</span>}
              </div>
              <h3 className="font-semibold text-[15px]">
                <a href={n.url} target="_blank" rel="noopener noreferrer" className="hover:text-brand hover:underline">
                  {n.headline}
                </a>
              </h3>
              {n.summary && <p className="mt-1.5 text-sm text-text-muted leading-relaxed line-clamp-3">{n.summary}</p>}
            </article>
          ))}
        </div>
      )}
    </ArticleLayout>
  );
}
