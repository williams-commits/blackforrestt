"use client";

import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button, EmptyState } from "@/components/ui";
import { money, useDashboard } from "./useDashboard";

function StageBarSkeleton() {
  return (
    <div className="space-y-4 pt-2">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="space-y-1.5">
          <div className="flex justify-between">
            <Skeleton className="h-3.5 w-24" />
            <Skeleton className="h-3.5 w-8" />
          </div>
          <Skeleton className="h-1.5 w-full rounded-full" />
        </div>
      ))}
    </div>
  );
}

/** Operational layer — "how is the pipeline performing?". Stage distribution
 *  of open leads (real RecordStatus rows, admin colors), 30-day conversion,
 *  and the open opportunity book. Bars are tonal fills on a muted track, no
 *  chart chrome. */
export function PipelineHealth({ className }: { className?: string }) {
  const { data, isError, isPending, refetch } = useDashboard();

  return (
    <Card className={className}>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle className="text-sm font-semibold">Pipeline health</CardTitle>
        <Link href="/leads" className="text-xs font-medium text-muted-foreground transition-colors hover:text-foreground">
          Open pipeline
        </Link>
      </CardHeader>
      <CardContent className="space-y-5">
        {isPending ? (
          <>
            <div className="flex items-end gap-6">
              <div className="space-y-1.5">
                <Skeleton className="h-3 w-16" />
                <Skeleton className="h-7 w-28" />
              </div>
              <div className="space-y-1.5">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-7 w-16" />
              </div>
            </div>
            <StageBarSkeleton />
          </>
        ) : isError || !data ? (
          <EmptyState
            icon="alert"
            tone="error"
            title="Pipeline didn't load"
            description="We couldn't reach the metrics service."
            action={<Button variant="secondary" size="sm" icon="refresh" onClick={() => void refetch()}>Retry</Button>}
          />
        ) : (
          <>
            <div className="flex flex-wrap items-end gap-x-8 gap-y-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Open pipeline</p>
                <p className="mt-0.5 text-2xl font-semibold tracking-tight tabular-nums text-foreground">
                  {money(data.openPipelineValue)}
                </p>
                <p className="text-xs text-muted-foreground">
                  {data.openOpportunityCount} open {data.openOpportunityCount === 1 ? "opportunity" : "opportunities"}
                </p>
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Conversion · 30d</p>
                <p className="mt-0.5 text-2xl font-semibold tracking-tight tabular-nums text-foreground">
                  {data.newLeads30d > 0 ? `${Math.round((data.convertedLeads30d / data.newLeads30d) * 100)}%` : "—"}
                </p>
                <p className="text-xs text-muted-foreground">
                  {data.convertedLeads30d} of {data.newLeads30d} new leads
                </p>
              </div>
            </div>

            {data.pipelineStages.length === 0 ? (
              <EmptyState
                icon="users"
                title="No open leads yet"
                description="The pipeline fills in as leads arrive. Create the first one to see stage distribution here."
                action={<Button variant="primary" size="sm" icon="plus" href="/leads?new=1">New lead</Button>}
              />
            ) : (
              <ul className="space-y-3.5" aria-label="Open leads by stage">
                {(() => {
                  const max = Math.max(...data.pipelineStages.map((stage) => stage.count));
                  return data.pipelineStages.map((stage) => (
                    <li key={stage.id} className="group/stage">
                      <div className="flex items-baseline justify-between gap-3">
                        <span className="flex min-w-0 items-center gap-2 text-sm">
                          <span
                            aria-hidden
                            className="size-2 shrink-0 rounded-full"
                            style={{ background: stage.color ?? "var(--muted-foreground)" }}
                          />
                          <span className="truncate font-medium text-foreground">{stage.name}</span>
                        </span>
                        <span className="shrink-0 text-sm tabular-nums text-muted-foreground">{stage.count}</span>
                      </div>
                      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden>
                        <div
                          className="h-full rounded-full transition-[width] duration-500"
                          style={{
                            width: `${Math.max(4, (stage.count / max) * 100)}%`,
                            background: stage.color ?? "var(--muted-foreground)",
                            opacity: 0.75,
                          }}
                        />
                      </div>
                    </li>
                  ));
                })()}
              </ul>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
