"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button, EmptyState, Section } from "@/components/ui";
import { Skeleton } from "@/components/ui/skeleton";
import { apiGet } from "@/lib/apiClient";
import { cn } from "@/lib/utils";

/**
 * Unified report — customer conversion → trading activation. The only
 * cross-module report: CRM numbers are scoped server-side; trading numbers
 * arrive aggregated from the Trade bridge (one call per 500 linked
 * accounts). Every state is honest: skeletons, "trading data unavailable"
 * when the bridge is down, and explicit truncation beyond 1,000 linked
 * accounts — never a fabricated zero.
 */

interface ActivationData {
  days: number;
  crm: {
    leadsCreated: number;
    converted: number;
    linkedAccounts: number;
    linkedTruncated: boolean;
  };
  trade: {
    available: boolean;
    matchedAccounts?: number;
    deposited?: number;
    activeTraders?: number;
    volumeLots?: string;
    commissionRevenue?: string;
  };
  generatedAt: string;
}

const WINDOWS = [30, 90] as const;

function Step({
  label,
  value,
  hint,
  width,
  tone = "default",
}: {
  label: string;
  value: string | number;
  hint?: string;
  /** Bar width relative to the widest step (0–1). */
  width: number;
  tone?: "default" | "muted" | "unavailable";
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-xs font-medium text-foreground">{label}</span>
        <span
          className={cn(
            "text-sm font-semibold tabular-nums",
            tone === "unavailable" ? "text-muted-foreground" : "text-foreground",
          )}
        >
          {value}
        </span>
      </div>
      <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-muted" aria-hidden>
        <div
          className={cn(
            "h-full rounded-full transition-[width] duration-500",
            tone === "unavailable" ? "bg-muted-foreground/30" : "bg-primary/70",
          )}
          style={{ width: `${Math.max(3, width * 100)}%` }}
        />
      </div>
      {hint ? <p className="mt-1 text-[11px] text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

export function UnifiedActivationReport() {
  const [days, setDays] = useState<(typeof WINDOWS)[number]>(30);
  const { data, isPending, isError, refetch } = useQuery({
    queryKey: ["reports", "unified-activation", days],
    queryFn: () =>
      apiGet<{ data: ActivationData }>(`/api/reports/unified/activation?days=${days}`).then((body) => body.data),
    staleTime: 5 * 60_000,
  });

  const crm = data?.crm;
  const trade = data?.trade;
  const max = crm
    ? Math.max(crm.leadsCreated, crm.converted, crm.linkedAccounts, trade?.deposited ?? 0, trade?.activeTraders ?? 0, 1)
    : 1;

  return (
    <Section
      title="Conversion → trading activation"
      description="Leads you created, how many converted, and what those customers did on the trading platform."
      actions={
        <div className="flex items-center gap-1" role="group" aria-label="Reporting window">
          {WINDOWS.map((window) => (
            <button
              key={window}
              type="button"
              aria-pressed={days === window}
              onClick={() => setDays(window)}
              className={cn(
                "h-7 rounded-md px-2.5 text-xs font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring",
                days === window
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-accent hover:text-foreground",
              )}
            >
              {window}d
            </button>
          ))}
        </div>
      }
    >
      {isPending ? (
        <div className="space-y-5" aria-busy="true">
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="space-y-1.5">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-2 w-full rounded-full" />
            </div>
          ))}
        </div>
      ) : isError || !data ? (
        <EmptyState
          icon="alert"
          tone="error"
          title="Report didn't load"
          description="The reporting service didn't respond."
          action={<Button variant="secondary" size="sm" icon="refresh" onClick={() => void refetch()}>Retry</Button>}
        />
      ) : !crm ? null : crm.leadsCreated === 0 && crm.linkedAccounts === 0 ? (
        <EmptyState
          icon="chart"
          title="Nothing to report yet"
          description={`No leads created and no platform-linked customers in the last ${data.days} days. The funnel fills in as your pipeline and linked accounts grow.`}
        />
      ) : (
        <div className="space-y-5">
          <Step label="Leads created" value={crm.leadsCreated} hint={`Last ${data.days} days`} width={crm.leadsCreated / max} />
          <Step label="Converted to customers" value={crm.converted} hint={`${crm.leadsCreated > 0 ? Math.round((crm.converted / crm.leadsCreated) * 100) : 0}% of leads created`} width={crm.converted / max} />
          <Step
            label="Linked trading accounts"
            value={crm.linkedAccounts}
            hint={crm.linkedTruncated ? "First 1,000 linked accounts — report is truncated" : "Customers linked to a platform user"}
            width={crm.linkedAccounts / max}
          />
          {trade?.available ? (
            <>
              <Step label="Have deposited" value={trade.deposited ?? 0} hint="Approved deposits, all time" width={(trade.deposited ?? 0) / max} />
              <Step label="Active traders" value={trade.activeTraders ?? 0} hint={`Opened a position in the last ${data.days} days`} width={(trade.activeTraders ?? 0) / max} />
              <div className="flex flex-wrap gap-x-8 gap-y-2 pt-1">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Trading volume</p>
                  <p className="mt-0.5 text-lg font-semibold tabular-nums">{trade.volumeLots ?? "0"} lots</p>
                </div>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Commission revenue</p>
                  <p className="mt-0.5 text-lg font-semibold tabular-nums">${trade.commissionRevenue ?? "0"}</p>
                </div>
              </div>
            </>
          ) : (
            <div className="rounded-lg bg-muted/60 px-3 py-2.5 text-xs text-muted-foreground">
              Trading figures unavailable — the platform bridge is down or not configured. CRM numbers above remain accurate.
            </div>
          )}
          <p className="text-[11px] text-muted-foreground">
            Generated {new Date(data.generatedAt).toLocaleTimeString()} · CRM and trading metrics stay in their own databases; this report composes them through the integration bridge.
          </p>
        </div>
      )}
    </Section>
  );
}
