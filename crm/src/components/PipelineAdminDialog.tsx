"use client";

import { useState } from "react";
import type { Pipeline } from "@/components/OpportunitiesPage";

export function PipelineAdmin({
  pipelines,
  onChanged,
  onClose,
}: {
  pipelines: Pipeline[];
  onChanged: () => void;
  onClose: () => void;
}) {
  const [pipelineName, setPipelineName] = useState("");
  const [stageDraft, setStageDraft] = useState<Record<string, { name: string; type: string }>>({});
  const [error, setError] = useState<string | null>(null);

  async function call(input: RequestInfo, init: RequestInit) {
    const response = await fetch(input, init);
    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      setError(body?.error ?? "Action failed.");
      return false;
    }
    setError(null);
    onChanged();
    return true;
  }

  const inputClass = "rounded-md border border-[var(--border-strong)] px-2 py-1 text-sm";

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/30 p-4 sm:p-8" role="dialog" aria-modal="true">
      <div className="w-full max-w-2xl space-y-4 rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] p-6 shadow-xl">
        <h2 className="text-base font-semibold">Manage pipelines</h2>
        {error ? (
          <p role="alert" className="rounded-md bg-[var(--error-bg)] px-3 py-2 text-sm text-[var(--error)]">
            {error}
          </p>
        ) : null}

        {pipelines.map((pipeline) => (
          <div key={pipeline.id} className="card" style={{ padding: "var(--space-3)" }}>
            <div className="mb-2 flex items-center justify-between">
              <p className="text-sm font-semibold">
                {pipeline.name}
                {pipeline.isDefault ? " ★ default" : ""}
              </p>
              <div className="flex gap-2 text-xs">
                {!pipeline.isDefault ? (
                  <button
                    type="button"
                    onClick={() => void call(`/api/pipelines/${pipeline.id}`, {
                      method: "PATCH",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ isDefault: true }),
                    })}
                    className="text-[var(--brand)] hover:underline"
                  >
                    Make default
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() => {
                    if (window.confirm(`Delete pipeline “${pipeline.name}” and its stages?`)) {
                      void call(`/api/pipelines/${pipeline.id}`, { method: "DELETE" });
                    }
                  }}
                  className="text-[var(--error)] hover:underline"
                >
                  Delete
                </button>
              </div>
            </div>
            <ul className="mb-2 space-y-1">
              {pipeline.stages.map((stage) => (
                <li key={stage.id} className="flex items-center justify-between text-sm">
                  <span>
                    {stage.name}{" "}
                    <span className="text-xs text-[var(--text-tertiary)]">
                      {stage.probability}% · {stage.type.toLowerCase()}
                    </span>
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      if (window.confirm(`Delete stage “${stage.name}”?`)) {
                        void call(`/api/pipelines/${pipeline.id}/stages/${stage.id}`, { method: "DELETE" });
                      }
                    }}
                    className="text-xs text-[var(--error)] hover:underline"
                  >
                    remove
                  </button>
                </li>
              ))}
            </ul>
            <form
              className="flex items-center gap-2"
              onSubmit={async (event) => {
                event.preventDefault();
                const draft = stageDraft[pipeline.id];
                if (!draft?.name) return;
                const ok = await call(`/api/pipelines/${pipeline.id}/stages`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ name: draft.name, type: draft.type ?? "OPEN", probability: 50 }),
                });
                if (ok) setStageDraft((prev) => ({ ...prev, [pipeline.id]: { name: "", type: "OPEN" } }));
              }}
            >
              <input
                aria-label={`New stage for ${pipeline.name}`}
                placeholder="New stage name"
                value={stageDraft[pipeline.id]?.name ?? ""}
                onChange={(event) =>
                  setStageDraft((prev) => ({
                    ...prev,
                    [pipeline.id]: { name: event.target.value, type: prev[pipeline.id]?.type ?? "OPEN" },
                  }))
                }
                className={`${inputClass} flex-1`}
              />
              <select
                aria-label="Stage type"
                value={stageDraft[pipeline.id]?.type ?? "OPEN"}
                onChange={(event) =>
                  setStageDraft((prev) => ({
                    ...prev,
                    [pipeline.id]: { name: prev[pipeline.id]?.name ?? "", type: event.target.value },
                  }))
                }
                className={inputClass}
              >
                <option value="OPEN">Open</option>
                <option value="WON">Won</option>
                <option value="LOST">Lost</option>
              </select>
              <button type="submit" className="rounded-md border border-[var(--border-strong)] px-2 py-1 text-xs font-medium hover:bg-[var(--bg-hover)]">
                Add stage
              </button>
            </form>
          </div>
        ))}

        <form
          className="flex items-center gap-2 border-t border-[var(--border-default)] pt-4"
          onSubmit={async (event) => {
            event.preventDefault();
            if (!pipelineName) return;
            const ok = await call("/api/pipelines", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ name: pipelineName }),
            });
            if (ok) setPipelineName("");
          }}
        >
          <input
            aria-label="New pipeline name"
            placeholder="New pipeline name"
            value={pipelineName}
            onChange={(event) => setPipelineName(event.target.value)}
            className={`${inputClass} flex-1`}
          />
          <button type="submit" className="btn btn-primary" style={{ background: "var(--brand)" }}>
            Add pipeline
          </button>
        </form>

        <div className="flex justify-end border-t border-[var(--border-default)] pt-4">
          <button type="button" onClick={onClose} className="btn btn-secondary">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
