"use client";

import { useCallback, useEffect, useState } from "react";

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

const OBJECTS = ["LEAD", "CONTACT", "ACCOUNT", "CUSTOMER", "OPPORTUNITY", "TASK"] as const;
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

export function ReportsPage() {
  const [builderOpen, setBuilderOpen] = useState(false);
  const [bObject, setBObject] = useState<string>("LEAD");
  const [bDateField, setBDateField] = useState("createdAt");
  const [bGroup, setBGroup] = useState("source");
  const [bTimeUnit, setBTimeUnit] = useState<"" | "day" | "week" | "month">("");
  const [library, setLibrary] = useState<ReportMeta[]>([]);
  const [selected, setSelected] = useState<string>("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [result, setResult] = useState<RunResponse | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void fetch("/api/reports")
      .then((r) => (r.ok ? r.json() : null))
      .then((body) => {
        if (body?.data) {
          setLibrary(body.data);
          setSelected((current) => current || body.data[0]?.id || "");
        }
      })
      .catch(() => setLibrary([]));
  }, []);

  const run = useCallback(async () => {
    if (!selected) return;
    setRunning(true);
    setError(null);
    try {
      const response = await fetch("/api/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reportId: selected, dateFrom: from || undefined, dateTo: to || undefined }),
      });
      const body = (await response.json().catch(() => null)) as { data?: RunResponse; error?: string } | null;
      if (!response.ok || !body?.data) {
        setError(body?.error ?? "Report failed.");
        setResult(null);
        return;
      }
      setResult(body.data);
    } finally {
      setRunning(false);
    }
  }, [selected, from, to]);

  useEffect(() => {
    if (selected) void run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected]);

  const maxCount = Math.max(1, ...(result?.rows.map((row) => row.count) ?? [1]));
  const meta = library.find((report) => report.id === selected);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">Reports</h1>
          <p className="text-sm text-[var(--text-secondary)]">Results always reflect your data scope.</p>
        </div>
        <button
          type="button"
          onClick={() => setBuilderOpen((previous) => !previous)}
          className="btn btn-secondary"
        >
          {builderOpen ? "Back to library" : "Build a report"}
        </button>
      </div>

      {builderOpen ? (
        <div className="card" style={{ padding: "var(--space-4)" }}>
          <div>
            <label htmlFor="b-object" className="mb-1 block text-xs font-medium">Object</label>
            <select id="b-object" value={bObject} onChange={(e) => { setBObject(e.target.value); setBDateField(DATE_FIELDS[e.target.value][0]); setBGroup(GROUP_KEYS[e.target.value][0]); }} className="input">
              {OBJECTS.map((object) => <option key={object} value={object}>{object.toLowerCase()}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="b-date" className="mb-1 block text-xs font-medium">Date field</label>
            <select id="b-date" value={bDateField} onChange={(e) => setBDateField(e.target.value)} className="input">
              {DATE_FIELDS[bObject].map((field) => <option key={field} value={field}>{field}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="b-group" className="mb-1 block text-xs font-medium">Group by</label>
            <select id="b-group" value={bGroup} onChange={(e) => setBGroup(e.target.value)} className="input">
              {GROUP_KEYS[bObject].map((key) => <option key={key} value={key}>{key}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="b-unit" className="mb-1 block text-xs font-medium">Bucket</label>
            <select id="b-unit" value={bTimeUnit} onChange={(e) => setBTimeUnit(e.target.value as never)} className="input">
              <option value="">field value</option>
              <option value="day">by day</option>
              <option value="week">by week</option>
              <option value="month">by month</option>
            </select>
          </div>
          <button
            type="button"
            onClick={() => void run()}
            disabled={running}
            className="btn btn-primary"
            style={{ background: "var(--brand)" }}
          >
            {running ? "Running…" : "Run report"}
          </button>
        </div>
      ) : null}

      <div className={`grid gap-4 ${builderOpen ? "" : "lg:grid-cols-[16rem_1fr]"}`}>
        <nav className={`card space-y-1 ${builderOpen ? "hidden" : ""}`} aria-label="Report library">
          {library.length === 0 ? (
            <div style={{ padding: "var(--space-3)" }}>
              {[...Array(5)].map((_, i) => (<div key={i} className="skeleton" style={{ height: "14px", width: `${80 - i * 10}%`, marginBottom: "10px" }} />))}
            </div>
          ) : (
            library.map((report) => (
              <button
                key={report.id}
                type="button"
                onClick={() => setSelected(report.id)}
                className={`block w-full rounded-md px-3 py-2 text-left text-sm ${
                  selected === report.id ? "bg-[var(--brand)]/10 font-medium text-[var(--brand)]" : "hover:bg-[var(--bg-hover)]"
                }`}
              >
                {report.name}
                <span className="block text-xs font-normal text-[var(--text-tertiary)]">{report.object.toLowerCase()}</span>
              </button>
            ))
          )}
        </nav>

        <div className="space-y-4">
          {meta ? (
            <div className="card" style={{ padding: "var(--space-4)" }}>
              <div className="flex-1">
                <p className="font-medium">{meta.name}</p>
                <p className="text-sm text-[var(--text-secondary)]">{meta.description}</p>
              </div>
              <div>
                <label htmlFor="r-from" className="mb-1 block text-xs font-medium">From</label>
                <input
                  id="r-from"
                  type="date"
                  value={from}
                  onChange={(event) => setFrom(event.target.value)}
                  className="input"
                />
              </div>
              <div>
                <label htmlFor="r-to" className="mb-1 block text-xs font-medium">To</label>
                <input
                  id="r-to"
                  type="date"
                  value={to}
                  onChange={(event) => setTo(event.target.value)}
                  className="input"
                />
              </div>
              <button
                type="button"
                onClick={() => void run()}
                disabled={running}
                className="btn btn-primary"
                style={{ background: "var(--brand)" }}
              >
                {running ? "Running…" : "Run"}
              </button>
              <a
                href={`/api/reports/${selected}/export?${new URLSearchParams({
                  ...(from ? { from } : {}),
                  ...(to ? { to } : {}),
                }).toString()}`}
                className="btn btn-secondary"
              >
                Export CSV
              </a>
            </div>
          ) : null}

          {error ? (
            <p role="alert" className="rounded-md bg-[var(--error-bg)] px-3 py-2 text-sm text-[var(--error)]">
              {error}
            </p>
          ) : null}

          <div className="card">
            {!result ? (
              <div className="empty-state"><p className="empty-state-title">Pick a report to run</p><p className="empty-state-description">Select a report from the library or build a custom one.</p></div>
            ) : result.rows.length === 0 ? (
              <p className="p-6 text-center text-sm text-[var(--text-tertiary)]">No rows in range (within your scope).</p>
            ) : (
              <ul className="space-y-2">
                {result.rows.map((row, index) => (
                  <li key={`${row.key ?? "none"}-${index}`} className="text-sm">
                    <div className="mb-0.5 flex items-baseline justify-between gap-2">
                      <span className="truncate font-medium">{row.key ?? "(none)"}</span>
                      <span className="whitespace-nowrap text-[var(--text-secondary)]">
                        {row.count}
                        {result.report.sums.includes("value")
                          ? ` · ${money(row.sums.value ?? 0)}`
                          : result.report.sums.map((field) => ` · ${field}: ${row.sums[field] ?? 0}`).join("")}
                      </span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded bg-[var(--bg-subtle)]">
                      <div
                        className="h-full"
                        style={{
                          width: `${Math.max(2, Math.round((row.count / maxCount) * 100))}%`,
                          background: "var(--brand)",
                        }}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
