"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Icon } from "@/components/Icon";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

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
        {error ? <div role="alert" className="flex items-center justify-between rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"><span>Dashboard metrics are temporarily unavailable.</span><button type="button" onClick={() => window.location.reload()} className="font-semibold underline">Retry</button></div> : null}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {[0, 1, 2, 3, 4, 5, 6].map((index) => (
          <Skeleton key={index} className="h-24 rounded-xl" />
        ))}
        </div>
      </div>
    );
  }

  const cards = [
    { label: "Open leads", value: String(data.openLeads), href: "/leads", icon: "target" },
    { label: "New leads · 30d", value: String(data.newLeads30d), href: "/leads", icon: "plus" },
    { label: "Converted · 30d", value: String(data.convertedLeads30d), href: "/leads", icon: "check_circle" },
    {
      label: `Open pipeline (${data.scope === "OWN" ? "mine" : "scope"})`,
      value: money(data.openPipelineValue),
      sub: `${data.openOpportunityCount} deal(s)`,
      href: "/opportunities",
      icon: "trending",
    },
    {
      label: "Won this month",
      value: money(data.wonThisMonthValue),
      sub: `${data.wonThisMonthCount} deal(s)`,
      href: "/opportunities",
      icon: "chart",
    },
    { label: "My open tasks", value: String(data.myOpenTasks), href: "/tasks", icon: "square_check" },
    { label: "Activity · 7d", value: String(data.activity7d), href: "/reports", icon: "clock" },
  ];

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
      {cards.map((card) => (
        <Link
          key={card.label}
          href={card.href}
          className="group min-w-0"
        >
          <Card className="h-full gap-3 p-4 transition-all group-hover:-translate-y-0.5 group-hover:bg-muted/50 group-hover:shadow-md">
            <span className="flex items-center justify-between gap-2">
              <span className="flex min-w-0 items-center gap-2">
                <span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground transition-colors group-hover:bg-background group-hover:text-foreground">
                  <Icon name={card.icon} size={13} />
                </span>
                <span className="truncate text-xs font-medium text-muted-foreground">{card.label}</span>
              </span>
              <Icon
                name="external"
                size={13}
                className="shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100"
              />
            </span>
            <span className="block truncate text-xl font-semibold tracking-tight tabular-nums text-foreground">
              {card.value}
            </span>
            {card.sub ? (
              <span className="block truncate text-[10px] tabular-nums text-muted-foreground">
                {card.sub}
              </span>
            ) : null}
          </Card>
        </Link>
      ))}
      {/* Ghost cell — keeps the final row at equal widths when the card
          count is not a multiple of the column count. */}
      <div aria-hidden className="hidden lg:block" />
    </div>
  );
}
