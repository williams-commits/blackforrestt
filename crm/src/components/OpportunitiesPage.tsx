"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

export interface Stage {
  id: string;
  pipelineId: string;
  name: string;
  sortOrder: number;
  probability: number;
  type: "OPEN" | "WON" | "LOST";
}

export interface Pipeline {
  id: string;
  name: string;
  isDefault: boolean;
  stages: Stage[];
}

export interface OpportunityRow {
  id: string;
  name: string;
  stageId: string;
  stage: { id: string; name: string; type: string; probability: number };
  pipeline: { id: string; name: string };
  account: { id: string; name: string } | null;
  contact: { id: string; firstName: string; lastName: string } | null;
  owner: { id: string; name: string } | null;
  value: string | null;
  currency: string;
  probability: number;
  expectedCloseAt: string | null;
  status: string;
}

interface BoardResponse {
  pipeline: { id: string; name: string } | null;
  stages: Stage[];
  opportunities: OpportunityRow[];
  aggregates: {
    openCount: number;
    openValue: number;
    weightedValue: number;
    wonCount: number;
    wonValue: number;
    winRate: number | null;
    byStage: Record<string, { count: number; value: number }>;
  } | null;
}

interface MeContext {
  userId: string;
  permissions: string[];
}

function money(minor: number): string {
  return (minor / 100).toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

export function OpportunitiesPage() {
  const [me, setMe] = useState<MeContext | null>(null);
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [pipelineId, setPipelineId] = useState<string>("");
  const [view, setView] = useState<"board" | "list">("board");
  const [includeClosed, setIncludeClosed] = useState(false);
  const [board, setBoard] = useState<BoardResponse | null>(null);
  const [rows, setRows] = useState<OpportunityRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editRow, setEditRow] = useState<OpportunityRow | null>(null);
  const [showAdmin, setShowAdmin] = useState(false);
  const [dragOver, setDragOver] = useState<string | null>(null);

  const can = {
    create: me?.permissions.includes("OPPORTUNITIES_CREATE") ?? false,
    edit: me?.permissions.includes("OPPORTUNITIES_EDIT") ?? false,
    settings: me?.permissions.includes("SETTINGS_MANAGE") ?? false,
  };

  const loadPipelines = useCallback(async () => {
    const response = await fetch("/api/pipelines");
    if (!response.ok) return;
    const body = (await response.json()) as { data: Pipeline[] };
    setPipelines(body.data);
    setPipelineId((current) => current || body.data.find((p) => p.isDefault)?.id || body.data[0]?.id || "");
  }, []);

  const load = useCallback(async () => {
    if (!pipelineId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      if (view === "board") {
        const response = await fetch(
          `/api/opportunities/board?pipelineId=${pipelineId}${includeClosed ? "&includeClosed=1" : ""}`,
        );
        if (!response.ok) throw new Error("Unable to load board.");
        setBoard((await response.json()).data);
      } else {
        const response = await fetch(`/api/opportunities?pipelineId=${pipelineId}&pageSize=100`);
        if (!response.ok) throw new Error("Unable to load opportunities.");
        setRows((await response.json()).data);
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to load.");
    } finally {
      setLoading(false);
    }
  }, [pipelineId, view, includeClosed]);

  useEffect(() => {
    void fetch("/api/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((body) => setMe(body?.data ?? null))
      .catch(() => setMe(null));
    void loadPipelines();
  }, [loadPipelines]);

  useEffect(() => {
    void load();
  }, [load]);

  async function moveStage(id: string, stageId: string) {
    const response = await fetch(`/api/opportunities/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stageId }),
    });
    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      setError(body?.error ?? "Stage change failed.");
      return;
    }
    setError(null);
    void load();
  }

  const stages = board?.stages ?? [];
  const byStage = new Map<string, OpportunityRow[]>();
  for (const stage of stages) byStage.set(stage.id, []);
  for (const row of board?.opportunities ?? []) {
    byStage.get(row.stageId)?.push(row);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="page-title">Opportunities</h1>
          {board?.aggregates ? (
            <p className="text-sm text-[var(--text-secondary)]">
              {board.aggregates.openCount} open · {money(board.aggregates.openValue)} · weighted{" "}
              {money(board.aggregates.weightedValue)}
              {board.aggregates.winRate !== null ? ` · win rate ${board.aggregates.winRate}%` : ""}
            </p>
          ) : (
            <p className="text-sm text-[var(--text-secondary)]">Pipeline management</p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            aria-label="Pipeline"
            value={pipelineId}
            onChange={(event) => setPipelineId(event.target.value)}
            className="input"
          >
            {pipelines.map((pipeline) => (
              <option key={pipeline.id} value={pipeline.id}>
                {pipeline.name}
                {pipeline.isDefault ? " ★" : ""}
              </option>
            ))}
          </select>
          <div className="flex overflow-hidden rounded-md border border-[var(--border-strong)] text-sm">
            <button
              type="button"
              onClick={() => setView("board")}
              className={`px-3 py-1.5 ${view === "board" ? "bg-[var(--brand)] text-white" : "bg-[var(--bg-surface)]"}`}
            >
              Board
            </button>
            <button
              type="button"
              onClick={() => setView("list")}
              className={`px-3 py-1.5 ${view === "list" ? "bg-[var(--brand)] text-white" : "bg-[var(--bg-surface)]"}`}
            >
              List
            </button>
          </div>
          {view === "board" ? (
            <label className="flex items-center gap-1 text-sm text-[var(--text-secondary)]">
              <input
                type="checkbox"
                checked={includeClosed}
                onChange={(event) => setIncludeClosed(event.target.checked)}
              />
              Show won/lost
            </label>
          ) : null}
          {can.settings ? (
            <button
              type="button"
              onClick={() => setShowAdmin(true)}
              className="btn btn-secondary"
            >
              Manage pipelines
            </button>
          ) : null}
          {can.create ? (
            <button
              type="button"
              onClick={() => {
                setEditRow(null);
                setShowForm(true);
              }}
              className="btn btn-primary"
              style={{ background: "var(--brand)" }}
            >
              New opportunity
            </button>
          ) : null}
        </div>
      </div>

      {error ? (
        <p role="alert" className="rounded-md bg-[var(--error-bg)] px-3 py-2 text-sm text-[var(--error)]">
          {error}
        </p>
      ) : null}

      {pipelines.length === 0 && !loading ? (
        <p className="card empty-state">
          No pipelines configured yet{can.settings ? " — create one under “Manage pipelines”" : ""}.
        </p>
      ) : null}

      {loading ? (
        <p className="p-8 text-center text-sm text-[var(--text-tertiary)]">Loading…</p>
      ) : view === "board" && stages.length > 0 ? (
        <div className="flex gap-3 overflow-x-auto pb-2">
          {stages.map((stage) => {
            const cards = byStage.get(stage.id) ?? [];
            const agg = board?.aggregates?.byStage[stage.id];
            return (
              <div
                key={stage.id}
                onDragOver={(event) => {
                  event.preventDefault();
                  setDragOver(stage.id);
                }}
                onDragLeave={() => setDragOver((current) => (current === stage.id ? null : current))}
                onDrop={(event) => {
                  event.preventDefault();
                  setDragOver(null);
                  const id = event.dataTransfer.getData("text/opportunity-id");
                  if (id && can.edit) void moveStage(id, stage.id);
                }}
                className={`w-64 shrink-0 rounded-lg border p-2 ${
                  dragOver === stage.id ? "border-[var(--brand)] bg-[var(--brand)]/5" : "border-[var(--border-default)] bg-[var(--bg-subtle)]"
                }`}
              >
                <div className="mb-2 flex items-baseline justify-between px-1">
                  <p className="text-sm font-semibold">
                    {stage.name}
                    {stage.type !== "OPEN" ? ` (${stage.type.toLowerCase()})` : ""}
                  </p>
                  <p className="text-xs text-[var(--text-secondary)]">
                    {agg?.count ?? 0} · {money(agg?.value ?? 0)}
                  </p>
                </div>
                <div className="space-y-2">
                  {cards.map((card) => (
                    <div
                      key={card.id}
                      draggable={can.edit}
                      onDragStart={(event) => event.dataTransfer.setData("text/opportunity-id", card.id)}
                      className="rounded-md border border-[var(--border-default)] bg-[var(--bg-surface)] p-2 shadow-sm"
                    >
                      <Link
                        href={`/opportunities/${card.id}`}
                        className="block text-sm font-medium hover:underline"
                      >
                        {card.name}
                      </Link>
                      <p className="mt-0.5 text-xs text-[var(--text-secondary)]">
                        {card.value ? money(Number(card.value)) : "—"} · {card.probability}%
                      </p>
                      <p className="text-xs text-[var(--text-tertiary)]">
                        {card.account?.name ?? card.contact?.lastName ?? "—"}
                        {card.expectedCloseAt
                          ? ` · closes ${new Date(card.expectedCloseAt).toLocaleDateString()}`
                          : ""}
                      </p>
                      {can.edit ? (
                        <select
                          aria-label={`Stage for ${card.name}`}
                          value={card.stageId}
                          onChange={(event) => void moveStage(card.id, event.target.value)}
                          className="mt-1 w-full rounded border border-[var(--border-default)] px-1 py-0.5 text-xs"
                        >
                          {stages.map((option) => (
                            <option key={option.id} value={option.id}>
                              {option.name}
                            </option>
                          ))}
                        </select>
                      ) : null}
                    </div>
                  ))}
                  {cards.length === 0 ? (
                    <p className="px-1 py-2 text-xs text-[var(--text-tertiary)]">Empty</p>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      ) : view === "list" ? (
        <div className="card overflow-hidden">
          <table className="table">
            <thead>
              <tr className="border-b border-[var(--border-default)] bg-[var(--bg-hover)] text-left text-xs uppercase tracking-wide text-[var(--text-secondary)]">
                <th className="px-3 py-2 font-medium">Opportunity</th>
                <th className="px-3 py-2 font-medium">Account</th>
                <th className="px-3 py-2 font-medium">Stage</th>
                <th className="px-3 py-2 font-medium">Value</th>
                <th className="px-3 py-2 font-medium">Prob.</th>
                <th className="px-3 py-2 font-medium">Close date</th>
                <th className="px-3 py-2 font-medium">Owner</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-3 py-8 text-center text-[var(--text-tertiary)]">
                    No opportunities in this pipeline.
                  </td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr key={row.id}>
                    <td className="px-3 py-2">
                      <Link href={`/opportunities/${row.id}`} className="font-medium text-[var(--brand)] hover:underline">
                        {row.name}
                      </Link>
                    </td>
                    <td className="px-3 py-2">{row.account?.name ?? "—"}</td>
                    <td className="px-3 py-2">
                      <span className="badge badge-neutral">
                        {row.stage.name}
                      </span>
                    </td>
                    <td className="px-3 py-2">{row.value ? money(Number(row.value)) : "—"}</td>
                    <td className="px-3 py-2">{row.probability}%</td>
                    <td className="px-3 py-2">
                      {row.expectedCloseAt ? new Date(row.expectedCloseAt).toLocaleDateString() : "—"}
                    </td>
                    <td className="px-3 py-2">{row.owner?.name ?? "—"}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      ) : null}

      {showForm && pipelineId ? (
        <OpportunityForm
          pipeline={pipelines.find((p) => p.id === pipelineId)!}
          initial={editRow}
          canEditFields
          onClose={() => setShowForm(false)}
          onSaved={() => {
            setShowForm(false);
            void load();
          }}
        />
      ) : null}

      {showAdmin ? (
        <PipelineAdmin
          pipelines={pipelines}
          onChanged={() => {
            void loadPipelines();
            void load();
          }}
          onClose={() => setShowAdmin(false)}
        />
      ) : null}
    </div>
  );
}

export function OpportunityForm({
  pipeline,
  initial,
  onClose,
  onSaved,
}: {
  pipeline: Pipeline;
  initial: OpportunityRow | null;
  canEditFields: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [stageId, setStageId] = useState(initial?.stageId ?? "");
  const [accountId, setAccountId] = useState("");
  const [contactId, setContactId] = useState("");
  const [accountOptions, setAccountOptions] = useState<Array<{ id: string; name: string }>>([]);
  const [contactOptions, setContactOptions] = useState<Array<{ id: string; firstName: string; lastName: string }>>([]);

  useEffect(() => {
    void fetch("/api/accounts?pageSize=100").then((r) => (r.ok ? r.json() : null)).then((b) => setAccountOptions(b?.data ?? []));
    void fetch("/api/contacts?pageSize=100").then((r) => (r.ok ? r.json() : null)).then((b) => setContactOptions(b?.data ?? []));
  }, []);
  const [value, setValue] = useState(initial?.value ? String(Number(initial.value) / 100) : "");
  const [probability, setProbability] = useState(initial ? String(initial.probability) : "");
  const [expectedCloseAt, setExpectedCloseAt] = useState(
    initial?.expectedCloseAt ? initial.expectedCloseAt.slice(0, 10) : "",
  );
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const inputClass =
    "w-full rounded-md border border-[var(--border-strong)] px-3 py-2 text-sm focus:border-[var(--brand)] focus:outline-none";

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const payload: Record<string, unknown> = {
        name,
        pipelineId: pipeline.id,
        ...(stageId ? { stageId } : {}),
        ...(accountId ? { accountId } : {}),
        ...(contactId ? { contactId } : {}),
        ...(value ? { value: Math.round(parseFloat(value) * 100) } : {}),
        ...(probability ? { probability: parseInt(probability, 10) } : {}),
        ...(expectedCloseAt ? { expectedCloseAt } : {}),
      };
      const response = await fetch(
        initial ? `/api/opportunities/${initial.id}` : "/api/opportunities",
        {
          method: initial ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        setError(body?.error ?? "Save failed.");
        return;
      }
      onSaved();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/30 p-4 sm:p-8" role="dialog" aria-modal="true">
      <form method="post" onSubmit={submit} className="w-full max-w-md space-y-4 rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] p-6 shadow-xl">
        <h2 className="text-base font-semibold">
          {initial ? "Edit opportunity" : `New opportunity — ${pipeline.name}`}
        </h2>
        {error ? (
          <p role="alert" className="rounded-md bg-[var(--error-bg)] px-3 py-2 text-sm text-[var(--error)]">
            {error}
          </p>
        ) : null}
        <div>
          <label htmlFor="o-name" className="mb-1 block text-sm font-medium">Name *</label>
          <input id="o-name" value={name} onChange={(e) => setName(e.target.value)} required minLength={2} className={inputClass} />
        </div>
        <div>
          <label htmlFor="o-stage" className="mb-1 block text-sm font-medium">Stage</label>
          <select id="o-stage" value={stageId} onChange={(e) => setStageId(e.target.value)} className={inputClass}>
            <option value="">First open stage</option>
            {pipeline.stages.map((stage) => (
              <option key={stage.id} value={stage.id}>
                {stage.name}
              </option>
            ))}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="o-account" className="mb-1 block text-sm font-medium">Account</label>
            <select id="o-account" value={accountId} onChange={(e) => setAccountId(e.target.value)} className={inputClass}>
              <option value="">— none —</option>
              {accountOptions.map((account) => (
                <option key={account.id} value={account.id}>{account.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="o-contact" className="mb-1 block text-sm font-medium">Contact</label>
            <select id="o-contact" value={contactId} onChange={(e) => setContactId(e.target.value)} className={inputClass}>
              <option value="">— none —</option>
              {contactOptions.map((contact) => (
                <option key={contact.id} value={contact.id}>{contact.firstName} {contact.lastName}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="o-value" className="mb-1 block text-sm font-medium">Value (USD)</label>
            <input id="o-value" type="number" step="0.01" min="0" value={value} onChange={(e) => setValue(e.target.value)} className={inputClass} />
          </div>
          <div>
            <label htmlFor="o-prob" className="mb-1 block text-sm font-medium">Probability %</label>
            <input id="o-prob" type="number" min="0" max="100" value={probability} onChange={(e) => setProbability(e.target.value)} className={inputClass} />
          </div>
        </div>
        <div>
          <label htmlFor="o-close" className="mb-1 block text-sm font-medium">Expected close</label>
          <input id="o-close" type="date" value={expectedCloseAt} onChange={(e) => setExpectedCloseAt(e.target.value)} className={inputClass} />
        </div>
        <div className="flex justify-end gap-2 border-t border-[var(--border-default)] pt-4">
          <button type="button" onClick={onClose} className="btn btn-secondary">
            Cancel
          </button>
          <button type="submit" disabled={busy} className="btn btn-primary" style={{ background: "var(--brand)" }}>
            {busy ? "Saving…" : "Save"}
          </button>
        </div>
      </form>
    </div>
  );
}

function PipelineAdmin({
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
