"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Icon } from "@/components/Icon";

interface DashboardData {
  scope: string;
  openLeads: number;
  newLeads30d: number;
  convertedLeads30d: number;
  openOpportunityCount: number;
  openPipelineValue: string;
  wonThisMonthCount: number;
  wonThisMonthValue: string;
  myOpenTasks: number;
  activity7d: number;
}

function money(minor: string | number): string {
  return (Number(minor) / 100).toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
}

/** Scope-aware KPI strip for the home page. */
export function DashboardCards() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    void fetch("/api/dashboards")
      .then((response) => {
        if (!response.ok) throw new Error("Dashboard request failed");
        return response.json();
      })
      .then((body) => setData(body?.data ?? null))
      .catch(() => setError(true));
  }, []);

  if (!data) {
    return (
      <div className="space-y-3">
        {error ? <div role="alert" className="flex items-center justify-between rounded-md border border-(--error-border) bg-(--error-bg) px-3 py-2 text-sm text-(--error)"><span>Dashboard metrics are temporarily unavailable.</span><button type="button" onClick={() => window.location.reload()} className="font-semibold underline">Retry</button></div> : null}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {[0, 1, 2, 3, 4, 5, 6].map((index) => (
          <div key={index} className="skeleton h-24 rounded-lg" />
        ))}
        </div>
      </div>
    );
  }

  const cards = [
    { label: "Open leads", value: String(data.openLeads), href: "/leads" },
    { label: "New leads · 30d", value: String(data.newLeads30d), href: "/leads" },
    { label: "Converted · 30d", value: String(data.convertedLeads30d), href: "/leads" },
    {
      label: `Open pipeline (${data.scope === "OWN" ? "mine" : "scope"})`,
      value: money(data.openPipelineValue),
      sub: `${data.openOpportunityCount} deal(s)`,
      href: "/opportunities",
    },
    {
      label: "Won this month",
      value: money(data.wonThisMonthValue),
      sub: `${data.wonThisMonthCount} deal(s)`,
      href: "/opportunities",
    },
    { label: "My open tasks", value: String(data.myOpenTasks), href: "/tasks" },
    { label: "Activity · 7d", value: String(data.activity7d), href: "/reports" },
  ];

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
      {cards.map((card) => (
        <Link
          key={card.label}
          href={card.href}
          className="card card-interactive group flex min-w-0 flex-col gap-3 p-4"
        >
          <span className="card-title truncate">{card.label}</span>
          <span className="flex items-end justify-between gap-2">
            <span className="min-w-0">
              <span className="block truncate text-xl font-semibold tracking-tight tabular-nums text-(--text-primary)">
                {card.value}
              </span>
              {card.sub ? (
                <span className="mt-0.5 block truncate text-[10px] text-(--text-tertiary) tabular-nums">
                  {card.sub}
                </span>
              ) : null}
            </span>
            <Icon
              name="external"
              size={13}
              className="shrink-0 text-(--text-tertiary) opacity-0 transition-opacity group-hover:opacity-100"
            />
          </span>
        </Link>
      ))}
      {/* Ghost cell — keeps the final row at equal widths when the card
          count is not a multiple of the column count. */}
      <div aria-hidden className="hidden lg:block" />
    </div>
  );
}
