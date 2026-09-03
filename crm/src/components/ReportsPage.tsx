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

export function ReportsPage() {
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
      <div>
        <h1 className="text-lg font-semibold">Reports</h1>
        <p className="text-sm text-stone-500">Results always reflect your data scope.</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[16rem_1fr]">
        <nav className="space-y-1 rounded-lg border border-stone-200 bg-white p-2" aria-label="Report library">
          {library.length === 0 ? (
            <p className="px-2 py-4 text-sm text-stone-400">Loading…</p>
          ) : (
            library.map((report) => (
              <button
                key={report.id}
                type="button"
                onClick={() => setSelected(report.id)}
                className={`block w-full rounded-md px-3 py-2 text-left text-sm ${
                  selected === report.id ? "bg-[var(--brand)]/10 font-medium text-[var(--brand)]" : "hover:bg-stone-50"
                }`}
              >
                {report.name}
                <span className="block text-xs font-normal text-stone-400">{report.object.toLowerCase()}</span>
              </button>
            ))
          )}
        </nav>

        <div className="space-y-4">
          {meta ? (
            <div className="flex flex-wrap items-end gap-3 rounded-lg border border-stone-200 bg-white p-4">
              <div className="flex-1">
                <p className="font-medium">{meta.name}</p>
                <p className="text-sm text-stone-500">{meta.description}</p>
              </div>
              <div>
                <label htmlFor="r-from" className="mb-1 block text-xs font-medium">From</label>
                <input
                  id="r-from"
                  type="date"
                  value={from}
                  onChange={(event) => setFrom(event.target.value)}
                  className="rounded-md border border-stone-300 px-2 py-1.5 text-sm"
                />
              </div>
              <div>
                <label htmlFor="r-to" className="mb-1 block text-xs font-medium">To</label>
                <input
                  id="r-to"
                  type="date"
                  value={to}
                  onChange={(event) => setTo(event.target.value)}
                  className="rounded-md border border-stone-300 px-2 py-1.5 text-sm"
                />
              </div>
              <button
                type="button"
                onClick={() => void run()}
                disabled={running}
                className="rounded-md px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-60"
                style={{ background: "var(--brand)" }}
              >
                {running ? "Running…" : "Run"}
              </button>
              <a
                href={`/api/reports/${selected}/export?${new URLSearchParams({
                  ...(from ? { from } : {}),
                  ...(to ? { to } : {}),
                }).toString()}`}
                className="rounded-md border border-stone-300 px-3 py-1.5 text-sm font-medium hover:bg-stone-50"
              >
                Export CSV
              </a>
            </div>
          ) : null}

          {error ? (
            <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          ) : null}

          <div className="rounded-lg border border-stone-200 bg-white p-4">
            {!result ? (
              <p className="p-6 text-center text-sm text-stone-400">Pick a report to run.</p>
            ) : result.rows.length === 0 ? (
              <p className="p-6 text-center text-sm text-stone-400">No rows in range (within your scope).</p>
            ) : (
              <ul className="space-y-2">
                {result.rows.map((row, index) => (
                  <li key={`${row.key ?? "none"}-${index}`} className="text-sm">
                    <div className="mb-0.5 flex items-baseline justify-between gap-2">
                      <span className="truncate font-medium">{row.key ?? "(none)"}</span>
                      <span className="whitespace-nowrap text-stone-500">
                        {row.count}
                        {result.report.sums.includes("value")
                          ? ` · ${money(row.sums.value ?? 0)}`
                          : result.report.sums.map((field) => ` · ${field}: ${row.sums[field] ?? 0}`).join("")}
                      </span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded bg-stone-100">
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
