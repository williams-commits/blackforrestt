"use client";

import { useCallback, useEffect, useState } from "react";
import { OpportunityForm } from "@/components/OpportunityFormDialog";
import { PipelineAdmin } from "@/components/PipelineAdminDialog";
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

