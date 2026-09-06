"use client";

import { useCallback, useEffect, useState } from "react";
import { OpportunityForm } from "@/components/OpportunityFormDialog";
import { PipelineAdmin } from "@/components/PipelineAdminDialog";
import Link from "next/link";
import { WorkspaceHeader } from "@/components/WorkspaceHeader";

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
  truncated: boolean;
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

function OpportunityBoardSkeleton() {
  return (
    <div className="flex gap-3 overflow-x-auto pb-2">
      {[...Array(4)].map((_, columnIndex) => (
        <div key={`opp-board-skeleton-${columnIndex}`} className="w-64 shrink-0 rounded-lg border border-(--border-default) bg-(--bg-subtle) p-2">
          <div className="mb-3 flex items-center justify-between gap-3 px-1">
            <div className="skeleton" style={{ height: 16, width: "46%" }} />
            <div className="skeleton" style={{ height: 12, width: "30%" }} />
          </div>
          <div className="space-y-2">
            {[...Array(columnIndex === 0 ? 3 : 2)].map((__, cardIndex) => (
              <div key={`opp-card-skeleton-${columnIndex}-${cardIndex}`} className="rounded-md border border-(--border-default) bg-(--bg-surface) p-2 shadow-sm">
                <div className="skeleton" style={{ height: 15, width: `${78 - cardIndex * 8}%` }} />
                <div className="skeleton mt-2" style={{ height: 12, width: "52%" }} />
                <div className="skeleton mt-2" style={{ height: 11, width: "70%" }} />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function OpportunityListSkeleton() {
  return (
    <div className="card overflow-hidden">
      <table className="table">
        <thead>
          <tr className="border-b border-(--border-default) bg-(--bg-hover) text-left text-xs uppercase tracking-wide text-(--text-secondary)">
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
          {[...Array(7)].map((_, rowIndex) => (
            <tr key={`opp-list-skeleton-${rowIndex}`}>
              {[...Array(7)].map((__, columnIndex) => (
                <td key={`opp-list-skeleton-${rowIndex}-${columnIndex}`} className="px-3 py-3">
                  <div
                    className="skeleton"
                    style={{ height: columnIndex === 0 ? 16 : 13, width: `${columnIndex === 0 ? 78 : 55 - (columnIndex % 3) * 8}%` }}
                  />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
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
      <WorkspaceHeader
        eyebrow="Revenue workspace"
        title="Opportunities"
        subtitle="See what is moving, what is at risk, and where to focus next."
        metrics={board?.aggregates ? [
          { label: "Open", value: board.aggregates.openCount, tone: "brand" },
          { label: "Pipeline", value: money(board.aggregates.openValue), tone: "info" },
          { label: "Weighted", value: money(board.aggregates.weightedValue), tone: "success" },
          ...(board.aggregates.winRate !== null ? [{ label: "Win rate", value: `${board.aggregates.winRate}%`, tone: "warning" as const }] : []),
        ] : undefined}
        actions={<>
          <select aria-label="Pipeline" value={pipelineId} onChange={(event) => setPipelineId(event.target.value)} className="input">
            {pipelines.map((pipeline) => <option key={pipeline.id} value={pipeline.id}>{pipeline.name}{pipeline.isDefault ? " ★" : ""}</option>)}
          </select>
          {can.create ? <button type="button" onClick={() => { setEditRow(null); setShowForm(true); }} className="btn btn-primary"><span aria-hidden>+</span> New opportunity</button> : null}
        </>}
      />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex overflow-hidden rounded-md border border-(--border-strong) text-sm">
            <button
              type="button"
              onClick={() => setView("board")}
              className={`px-3 py-1.5 ${view === "board" ? "bg-(--brand) text-white" : "bg-(--bg-surface)"}`}
            >
              Board
            </button>
            <button
              type="button"
              onClick={() => setView("list")}
              className={`px-3 py-1.5 ${view === "list" ? "bg-(--brand) text-white" : "bg-(--bg-surface)"}`}
            >
              List
            </button>
          </div>
          {view === "board" ? (
            <label className="flex items-center gap-1 text-sm text-(--text-secondary)">
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
        </div>
      </div>

      {view === "board" && board?.truncated ? (
        <p className="text-xs text-(--text-tertiary)">
          Showing the 500 highest-value cards; column totals and headline metrics include every opportunity. Use the list view to find the rest.
        </p>
      ) : null}

      {error ? (
        <p role="alert" className="rounded-md bg-(--error-bg) px-3 py-2 text-sm text-(--error)">
          {error}
        </p>
      ) : null}

      {pipelines.length === 0 && !loading ? (
        <p className="card empty-state">
          No pipelines configured yet{can.settings ? " — create one under “Manage pipelines”" : ""}.
        </p>
      ) : null}

      {loading ? (
        view === "board" ? <OpportunityBoardSkeleton /> : <OpportunityListSkeleton />
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
                  dragOver === stage.id ? "border-(--brand) bg-(--brand)/5" : "border-(--border-default) bg-(--bg-subtle)"
                }`}
              >
                <div className="mb-2 flex items-baseline justify-between px-1">
                  <p className="text-sm font-semibold">
                    {stage.name}
                    {stage.type !== "OPEN" ? ` (${stage.type.toLowerCase()})` : ""}
                  </p>
                  <p className="text-xs text-(--text-secondary)">
                    {agg?.count ?? 0} · {money(agg?.value ?? 0)}
                  </p>
                </div>
                <div className="space-y-2">
                  {cards.map((card) => (
                    <div
                      key={card.id}
                      draggable={can.edit}
                      onDragStart={(event) => event.dataTransfer.setData("text/opportunity-id", card.id)}
                      className="rounded-md border border-(--border-default) bg-(--bg-surface) p-2 shadow-sm"
                    >
                      <Link
                        href={`/opportunities/${card.id}`}
                        className="block text-sm font-medium hover:underline"
                      >
                        {card.name}
                      </Link>
                      <p className="mt-0.5 text-xs text-(--text-secondary)">
                        {card.value ? money(Number(card.value)) : "—"} · {card.probability}%
                      </p>
                      <p className="text-xs text-(--text-tertiary)">
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
                          className="mt-1 w-full rounded border border-(--border-default) px-1 py-0.5 text-xs"
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
                    <p className="px-1 py-2 text-xs text-(--text-tertiary)">Empty</p>
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
              <tr className="border-b border-(--border-default) bg-(--bg-hover) text-left text-xs uppercase tracking-wide text-(--text-secondary)">
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
                  <td colSpan={7} className="px-3 py-8 text-center text-(--text-tertiary)">
                    No opportunities in this pipeline.
                  </td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr key={row.id}>
                    <td className="px-3 py-2">
                      <Link href={`/opportunities/${row.id}`} className="font-medium text-(--brand) hover:underline">
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
