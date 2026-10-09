"use client";

import { Icon } from "@/components/Icon";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui";
import { cn } from "@/lib/utils";
import { money, useDashboard } from "./useDashboard";

function Delta({ current, previous, label }: { current: number; previous: number; label: string }) {
  const diff = current - previous;
  if (diff === 0) {
    return <span className="text-xs text-muted-foreground">Flat {label}</span>;
  }
  const up = diff > 0;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 text-xs font-medium",
        up ? "text-(--success)" : "text-(--error)",
      )}
    >
      {up ? "↑" : "↓"} {diff > 0 ? "+" : ""}
      {label === "vs last month" ? money(Math.abs(diff) * 100) : Math.abs(diff)} {label}
    </span>
  );
}

function KpiSkeleton() {
  return (
    <Card className="gap-3 p-4">
      <Skeleton className="h-3 w-20" />
      <Skeleton className="h-8 w-24" />
      <Skeleton className="h-3 w-28" />
    </Card>
  );
}

/** KPI layer — the four numbers an operator glances at first. One shared
 *  query; deltas compare real prior periods (last month, previous 30 days),
 *  never invented baselines. */
export function KpiRow() {
  const { data, isError, isPending, refetch } = useDashboard();

  if (isPending) {
    return (
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4" aria-busy="true" aria-label="Loading metrics">
        <KpiSkeleton />
        <KpiSkeleton />
        <KpiSkeleton />
        <KpiSkeleton />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <Card className="flex flex-col items-start gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-foreground">Metrics unavailable</p>
          <p className="mt-0.5 text-xs text-muted-foreground">The dashboard service didn’t respond. Your data is safe — retry when ready.</p>
        </div>
        <Button variant="secondary" size="sm" icon="refresh" onClick={() => void refetch()}>
          Retry
        </Button>
      </Card>
    );
  }

  const tiles = [
    {
      key: "pipeline",
      icon: "chart",
      label: "Open pipeline",
      value: money(data.openPipelineValue),
      sub: `${data.openOpportunityCount} open ${data.openOpportunityCount === 1 ? "opportunity" : "opportunities"}`,
      href: "/opportunities",
    },
    {
      key: "won",
      icon: "target",
      label: "Won this month",
      value: money(data.wonThisMonthValue),
      sub:
        data.wonThisMonthCount > 0
          ? `${data.wonThisMonthCount} ${data.wonThisMonthCount === 1 ? "deal" : "deals"} closed`
          : "No wins yet this month",
      href: "/opportunities",
      delta: <Delta current={Number(data.wonThisMonthValue) / 100} previous={Number(data.wonLastMonthValue) / 100} label="vs last month" />,
    },
    {
      key: "leads",
      icon: "users",
      label: "Open leads",
      value: String(data.openLeads),
      sub: `${data.newLeads30d} new in 30 days`,
      href: "/leads",
      delta: <Delta current={data.newLeads30d} previous={data.newLeadsPrev30d} label="vs prev 30 days" />,
    },
    {
      key: "tasks",
      icon: "square_check",
      label: "My tasks",
      value: String(data.myOpenTasks),
      sub:
        data.myOverdueTasks > 0
          ? `${data.myOverdueTasks} overdue · ${data.myTasksDueToday} due today`
          : data.myTasksDueToday > 0
            ? `${data.myTasksDueToday} due today`
            : "Nothing due today",
      href: "/tasks?mine=1",
      subTone: data.myOverdueTasks > 0 ? ("error" as const) : undefined,
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-4 xl:grid-cols-4" role="list" aria-label="Key metrics">
      {tiles.map((tile) => (
        <Card key={tile.key} role="listitem" className="group gap-2 p-4 transition-shadow hover:shadow-md">
          <div className="flex items-center gap-2">
            <span className="flex size-6 items-center justify-center rounded-md bg-muted text-muted-foreground" aria-hidden>
              <Icon name={tile.icon} size={13} />
            </span>
            <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">{tile.label}</p>
          </div>
          <p className="text-2xl font-semibold tracking-tight tabular-nums text-foreground">{tile.value}</p>
          <div className="flex min-h-5 flex-wrap items-center gap-x-2 gap-y-1">
            <p className={cn("text-xs", tile.subTone === "error" ? "font-medium text-(--error)" : "text-muted-foreground")}>{tile.sub}</p>
            {tile.delta}
          </div>
        </Card>
      ))}
    </div>
  );
}
