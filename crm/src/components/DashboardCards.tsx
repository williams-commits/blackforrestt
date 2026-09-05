"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

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

  useEffect(() => {
    void fetch("/api/dashboards")
      .then((r) => (r.ok ? r.json() : null))
      .then((body) => setData(body?.data ?? null))
      .catch(() => setData(null));
  }, []);

  if (!data) {
    return (
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[0, 1, 2, 3].map((index) => (
          <div key={index} className="h-20 animate-pulse rounded-lg border border-(--border-default) bg-(--bg-surface)" />
        ))}
      </div>
    );
  }

  const cards = [
    { label: "Open leads", value: String(data.openLeads), href: "/leads", tone: "brand" },
    { label: "New leads · 30d", value: String(data.newLeads30d), href: "/leads", tone: "blue" },
    { label: "Converted · 30d", value: String(data.convertedLeads30d), href: "/leads", tone: "amber" },
    {
      label: `Open pipeline (${data.scope === "OWN" ? "mine" : "scope"})`,
      value: money(data.openPipelineValue),
      sub: `${data.openOpportunityCount} deal(s)`,
      href: "/opportunities",
      tone: "brand",
    },
    {
      label: "Won this month",
      value: money(data.wonThisMonthValue),
      sub: `${data.wonThisMonthCount} deal(s)`,
      href: "/opportunities",
      tone: "success",
    },
    { label: "My open tasks", value: String(data.myOpenTasks), href: "/tasks", tone: "blue" },
    { label: "Activity · 7d", value: String(data.activity7d), href: "/", tone: "slate" },
  ];

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-7">
      {cards.map((card) => (
        <Link
          key={card.label}
          href={card.href}
          className="card card-interactive group min-w-0 p-4"
        >
          <div className="mb-4 flex items-center justify-between">
            <span className={`h-2 w-2 rounded-full ${card.tone === "brand" ? "bg-(--brand-500)" : card.tone === "blue" ? "bg-blue-500" : card.tone === "amber" ? "bg-amber-500" : card.tone === "success" ? "bg-emerald-500" : "bg-slate-400"}`} />
            <span className="text-(--text-tertiary) transition-transform group-hover:translate-x-0.5">↗</span>
          </div>
          <p className="truncate text-xl font-semibold tracking-tight">{card.value}</p>
          <p className="mt-1 truncate text-xs text-(--text-secondary)">{card.label}</p>
          {card.sub ? <p className="mt-0.5 truncate text-[10px] text-(--text-tertiary)">{card.sub}</p> : null}
        </Link>
      ))}
    </div>
  );
}
