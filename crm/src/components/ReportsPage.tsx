"use client";

import { useCallback, useEffect, useState } from "react";
import { WorkspaceHeader } from "@/components/WorkspaceHeader";
import { Modal } from "@/components/Modal";
import { WorkspaceQuickNav } from "@/components/WorkspaceQuickNav";
import { SmartTips } from "@/components/SmartTips";
import { Button, EmptyState, Section } from "@/components/ui";
import { Card, CardContent } from "@/components/ui/card";
import { Field, FormActions, IconInput, IconSelectTrigger } from "@/components/form";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import Link from "next/link";

interface ReportMeta {
  id: string;
  name: string;
  description: string;
  object: string;
  hasSums: boolean;
}

interface RunResponse {
  report: { id: string; name: string; sums: string[] };
  rows: Array<{ key: string | null; count: number; sums: Record<string, number | null> }>;
}

function money(minor: number | null): string {
  return ((minor ?? 0) / 100).toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
}

/* Neutral categorical ramp for the donut + legend: the theme's chart tokens
   (grays from light to dark) keep every slice legible on light and dark
   surfaces without module accent hues. */
const PIE_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
];

const OBJECTS = ["LEAD", "CONTACT", "ACCOUNT", "CUSTOMER", "OPPORTUNITY", "TASK"] as const;
const OBJECT_PATH: Record<string, string> = {
  LEAD: "leads",
  CONTACT: "contacts",
  ACCOUNT: "accounts",
  CUSTOMER: "customers",
  OPPORTUNITY: "opportunities",
  TASK: "tasks",
};
const DATE_FIELDS: Record<string, string[]> = {
  LEAD: ["createdAt", "updatedAt", "convertedAt"],
  CONTACT: ["createdAt", "updatedAt"],
  ACCOUNT: ["createdAt", "updatedAt"],
  CUSTOMER: ["createdAt", "updatedAt"],
  OPPORTUNITY: ["createdAt", "updatedAt", "closedAt", "expectedCloseAt"],
  TASK: ["createdAt", "dueAt", "completedAt"],
};
const GROUP_KEYS: Record<string, string[]> = {
  LEAD: ["source", "priority", "country", "statusName", "assignee", "campaignName", "createdAt", "convertedAt"],
  CONTACT: ["leadSource", "owner", "account"],
  ACCOUNT: ["industry", "country", "owner"],
  CUSTOMER: ["source", "statusName", "owner"],
  OPPORTUNITY: ["stageName", "pipelineName", "owner", "status", "createdAt", "closedAt", "expectedCloseAt"],
  TASK: ["owner", "status", "priority", "createdAt", "dueAt", "completedAt"],
};

/** shadcn Select items cannot carry an empty string value — sentinel for
 *  "no time bucket" (group by the raw field value instead). */
const NO_BUCKET = "__all__";

export function ReportsPage() {
  const [builderOpen, setBuilderOpen] = useState(false);
  const [bObject, setBObject] = useState<string>("LEAD");
  const [bDateField, setBDateField] = useState("createdAt");
  const [bGroup, setBGroup] = useState("source");
  const [bTimeUnit, setBTimeUnit] = useState<"" | "day" | "week" | "month">("");
  const [library, setLibrary] = useState<ReportMeta[]>([]);
  const [libraryLoading, setLibraryLoading] = useState(true);
  const [libraryError, setLibraryError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string>("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [result, setResult] = useState<RunResponse | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLibraryLoading(true);
    setLibraryError(null);
    void fetch("/api/reports")
      .then((response) => {
        if (!response.ok) throw new Error(`Request failed (${response.status})`);
        return response.json();
      })
      .then((body) => {
        const reports = body?.data ?? [];
        setLibrary(reports);
        setSelected((current) => current || reports[0]?.id || "");
      })
      .catch((cause: unknown) => setLibraryError(cause instanceof Error ? cause.message : "Unable to load reports."))
      .finally(() => setLibraryLoading(false));
  }, []);

  const run = useCallback(async (definition?: { object: string; dateField: string; groupBy: { key: string; timeUnit?: "day" | "week" | "month" } }) => {
    if (!definition && !selected) return;
    setRunning(true);
    setError(null);
    try {
      const response = await fetch("/api/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          definition
            ? { definition, dateFrom: from || undefined, dateTo: to || undefined }
            : { reportId: selected, dateFrom: from || undefined, dateTo: to || undefined },
        ),
      });
      const body = (await response.json().catch(() => null)) as { data?: RunResponse; error?: string } | null;
      if (!response.ok || !body?.data) {
        setError(body?.error ?? "Report failed.");
        setResult(null);
        return;
      }
      setResult(body.data);
    } catch (cause) {
      setResult(null);
      setError(cause instanceof Error ? cause.message : "Unable to run report.");
    } finally {
      setRunning(false);
    }
  }, [selected, from, to]);

  const runCustomReport = useCallback(async () => {
    // A custom definition has no stable report id, so it cannot safely use
    // the prebuilt export URL or inherit the previous report's heading.
    setSelected("");
    await run({
      object: bObject,
      dateField: bDateField,
      groupBy: { key: bGroup, ...(bTimeUnit ? { timeUnit: bTimeUnit } : {}) },
    });
    setBuilderOpen(false);
  }, [bDateField, bGroup, bObject, bTimeUnit, run]);

  useEffect(() => {
    if (selected) void run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected]);

  const maxCount = Math.max(1, ...(result?.rows.map((row) => row.count) ?? [1]));
  const totalCount = result?.rows.reduce((sum, row) => sum + row.count, 0) ?? 0;
  const pieRows = (() => {
    if (!result || result.rows.length === 0) return [];
    const ordered = [...result.rows].sort((a, b) => b.count - a.count);
    const visible = ordered.slice(0, 7).map((row) => ({ ...row, label: row.key ?? "(none)" }));
    const rest = ordered.slice(7);
    if (rest.length === 0) return visible;
    return [
      ...visible,
      {
        key: "__other__",
        label: "Other",
        count: rest.reduce((sum, row) => sum + row.count, 0),
        sums: {},
      },
    ];
  })();
  const pieGradient = (() => {
    if (totalCount <= 0 || pieRows.length === 0) return "conic-gradient(var(--muted) 0deg 360deg)";
    let cursor = 0;
    return `conic-gradient(${pieRows
      .map((row, index) => {
        const start = cursor;
        const degrees = (row.count / totalCount) * 360;
        cursor += degrees;
        const color = PIE_COLORS[index % PIE_COLORS.length];
        return `${color} ${start.toFixed(2)}deg ${cursor.toFixed(2)}deg`;
      })
      .join(", ")})`;
  })();
  const meta = library.find((report) => report.id === selected);

  return (
    <div className="space-y-4" data-module="reports">
      <WorkspaceHeader
        eyebrow="Insights"
        title="Reports" titleIcon="chart"
        subtitle="Turn your scoped CRM data into a decision you can act on."
        actions={<Button variant="primary" icon="plus" onClick={() => setBuilderOpen((previous) => !previous)}>{builderOpen ? "Back to library" : "Build a report"}</Button>}
        metrics={[{ label: "Saved reports", value: library.length, tone: "brand" }, { label: "Scope", value: "Your access", tone: "success" }]}
      />
      <WorkspaceQuickNav />
      <SmartTips context="records" />

      {builderOpen ? (
        <Modal title="Build a report" onClose={() => setBuilderOpen(false)} size="lg">
        <div className="space-y-4">
          <div><p className="form-section-title">Report definition</p><p className="form-section-help">Choose the object, time field, grouping, and bucket for your analysis.</p></div>
          <Field label="Object" id="b-object" help="The record type counted in every row.">
            <Select value={bObject} onValueChange={(value) => { setBObject(value); setBDateField(DATE_FIELDS[value][0]); setBGroup(GROUP_KEYS[value][0]); }}>
              <IconSelectTrigger id="b-object" icon="box" className="w-full">
                <SelectValue />
              </IconSelectTrigger>
              <SelectContent>
                {OBJECTS.map((object) => <SelectItem key={object} value={object}>{object.toLowerCase()}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Date field" id="b-date" help="Rows fall inside the From/To range you set after building.">
            <Select value={bDateField} onValueChange={setBDateField}>
              <IconSelectTrigger id="b-date" icon="calendar" className="w-full">
                <SelectValue />
              </IconSelectTrigger>
              <SelectContent>
                {DATE_FIELDS[bObject].map((field) => <SelectItem key={field} value={field}>{field}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Group by" id="b-group" help="One row per value of this field.">
            <Select value={bGroup} onValueChange={setBGroup}>
              <IconSelectTrigger id="b-group" icon="users" className="w-full">
                <SelectValue />
              </IconSelectTrigger>
              <SelectContent>
                {GROUP_KEYS[bObject].map((key) => <SelectItem key={key} value={key}>{key}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Bucket" id="b-unit" help="Bin dates into periods, or keep raw field values.">
            <Select value={bTimeUnit || NO_BUCKET} onValueChange={(value) => setBTimeUnit(value === NO_BUCKET ? "" : (value as "day" | "week" | "month"))}>
              <IconSelectTrigger id="b-unit" icon="chart" className="w-full">
                <SelectValue />
              </IconSelectTrigger>
              <SelectContent>
                <SelectItem value={NO_BUCKET}>field value</SelectItem>
                <SelectItem value="day">by day</SelectItem>
                <SelectItem value="week">by week</SelectItem>
                <SelectItem value="month">by month</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <FormActions><Button variant="secondary" onClick={() => setBuilderOpen(false)}>Cancel</Button><Button
            variant="primary"
            icon="chart"
            loading={running}
            onClick={() => void runCustomReport()}
          >
            Run report
          </Button></FormActions>
        </div>
        </Modal>
      ) : null}

      <div className={cn("grid gap-4", !builderOpen && "lg:grid-cols-[16rem_1fr]")}>
        <Card className={cn("gap-0 p-2", builderOpen && "hidden")}>
          <nav className="space-y-1" aria-label="Report library">
            {libraryLoading ? (
              <div className="p-3">
                {[...Array(5)].map((_, i) => (<Skeleton key={i} className="mb-2.5 h-3.5" style={{ width: `${80 - i * 10}%` }} />))}
              </div>
            ) : libraryError ? (
              <div className="space-y-2 p-3"><p className="text-sm text-destructive">{libraryError}</p><button type="button" onClick={() => window.location.reload()} className="text-xs font-semibold text-foreground underline">Retry</button></div>
            ) : library.length === 0 ? (
              <div className="p-3"><p className="text-sm font-medium">No saved reports yet</p><p className="mt-1 text-xs text-muted-foreground">Build a report to create your first analysis.</p></div>
            ) : (
              library.map((report) => (
                <button
                  key={report.id}
                  type="button"
                  onClick={() => setSelected(report.id)}
                  className={cn(
                    "block w-full rounded-md px-3 py-2 text-left text-sm transition-colors",
                    selected === report.id
                      ? "bg-muted font-semibold text-foreground"
                      : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                  )}
                >
                  {report.name}
                  <span className="block text-xs font-normal text-muted-foreground">{report.object.toLowerCase()}</span>
                </button>
              ))
            )}
          </nav>
        </Card>

        <div className="space-y-4">
          {meta ? (
            <Card className="gap-0">
              <CardContent>
                <Section title={meta.name} description={meta.description}>
                  {OBJECT_PATH[meta.object] ? <Link href={`/${OBJECT_PATH[meta.object]}`} className="text-xs font-semibold text-foreground hover:underline">Open {meta.object.toLowerCase()} records →</Link> : null}
                </Section>
                <div className="mt-4 flex flex-wrap items-center justify-between gap-4 border-t border-border pt-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <Label htmlFor="r-from" className="text-xs font-medium text-muted-foreground">From</Label>
                    <IconInput
                      id="r-from"
                      icon="calendar"
                      type="date"
                      value={from}
                      onChange={(event) => setFrom(event.target.value)}
                      className="h-7 w-auto text-xs"
                    />
                    <Label htmlFor="r-to" className="text-xs font-medium text-muted-foreground">To</Label>
                    <IconInput
                      id="r-to"
                      icon="calendar"
                      type="date"
                      value={to}
                      onChange={(event) => setTo(event.target.value)}
                      className="h-7 w-auto text-xs"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="primary"
                      size="sm"
                      icon="chart"
                      loading={running}
                      onClick={() => void run()}
                    >
                      Run
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      icon="download"
                      href={`/api/reports/${selected}/export?${new URLSearchParams({
                        ...(from ? { from } : {}),
                        ...(to ? { to } : {}),
                      }).toString()}`}
                    >
                      Export CSV
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : null}

          {error ? (
            <p role="alert" className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          ) : null}

          <Card className="gap-0">
            <CardContent>
            {!result ? (
              <EmptyState illustration="reports" title="Pick a report to run" description="Select a report from the library or build a custom one." />
            ) : result.rows.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">No rows in range (within your scope).</p>
            ) : (
              <div className="grid gap-6 xl:grid-cols-[22rem_1fr]">
                <div className="rounded-xl bg-muted p-5">
                  <div className="mx-auto flex h-56 w-56 items-center justify-center rounded-full" style={{ background: pieGradient }}>
                    <div className="flex h-28 w-28 flex-col items-center justify-center rounded-full border border-border bg-background text-center">
                      <span className="text-3xl font-semibold text-foreground">{totalCount}</span>
                      <span className="text-xs uppercase tracking-wide text-muted-foreground">records</span>
                    </div>
                  </div>
                  <div className="mt-5 space-y-2">
                    {pieRows.map((row, index) => {
                      const percentage = totalCount === 0 ? 0 : Math.round((row.count / totalCount) * 100);
                      return (
                        <div key={`${row.key ?? "none"}-${index}`} className="flex items-center justify-between gap-3 text-sm">
                          <span className="flex min-w-0 items-center gap-2">
                            <span
                              className="h-2.5 w-2.5 shrink-0 rounded-full"
                              style={{ background: PIE_COLORS[index % PIE_COLORS.length] }}
                            />
                            <span className="truncate text-muted-foreground">{row.label}</span>
                          </span>
                          <span className="whitespace-nowrap font-medium text-foreground">{percentage}%</span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <ul className="divide-y divide-border">
                  {result.rows.map((row, index) => (
                    <li key={`${row.key ?? "none"}-${index}`} className="py-2.5 text-sm first:pt-0 last:pb-0">
                      <div className="mb-1 flex items-baseline justify-between gap-2">
                        <span className="truncate font-medium">{row.key ?? "(none)"}</span>
                        <span className="whitespace-nowrap text-muted-foreground">
                          {row.count}
                          {result.report.sums.includes("value")
                            ? ` · ${money(row.sums.value ?? 0)}`
                            : result.report.sums.map((field) => ` · ${field}: ${row.sums[field] ?? 0}`).join("")}
                        </span>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full bg-foreground/50"
                          style={{
                            width: `${Math.max(2, Math.round((row.count / maxCount) * 100))}%`,
                          }}
                        />
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
