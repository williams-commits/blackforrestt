"use client";

import { useCallback, useEffect, useState } from "react";
import { OpportunityForm } from "@/components/OpportunityFormDialog";
import { PipelineAdmin } from "@/components/PipelineAdminDialog";
import Link from "next/link";
import { WorkspaceHeader } from "@/components/WorkspaceHeader";
import { WorkspaceQuickNav } from "@/components/WorkspaceQuickNav";
import { SmartTips } from "@/components/SmartTips";
import { Button, EmptyState } from "@/components/ui";
import { useTableSession, writeTableSession } from "@/components/useTableSession";
import { Table, THead, TBody, TR, TH, TD } from "@/components/table";

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
        <div key={`opp-board-skeleton-${columnIndex}`} className="card w-64 shrink-0 p-2">
          <div className="mb-3 flex items-center justify-between gap-3 px-1">
            <div className="skeleton" style={{ height: 16, width: "46%" }} />
            <div className="skeleton" style={{ height: 12, width: "30%" }} />
          </div>
          <div className="space-y-2">
            {[...Array(columnIndex === 0 ? 3 : 2)].map((__, cardIndex) => (
              <div key={`opp-card-skeleton-${columnIndex}-${cardIndex}`} className="rounded-md border border-(--border-hairline) bg-(--bg-surface) p-2">
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
      <Table>
        <THead>
          <TR>
            <TH>Opportunity</TH>
            <TH>Account</TH>
            <TH>Stage</TH>
            <TH>Value</TH>
            <TH>Prob.</TH>
            <TH>Close date</TH>
            <TH>Owner</TH>
          </TR>
        </THead>
        <TBody>
          {[...Array(7)].map((_, rowIndex) => (
            <TR key={`opp-list-skeleton-${rowIndex}`}>
              {[...Array(7)].map((__, columnIndex) => (
                <TD key={`opp-list-skeleton-${rowIndex}-${columnIndex}`}>
                  <div
                    className="skeleton"
                    style={{ height: columnIndex === 0 ? 16 : 13, width: `${columnIndex === 0 ? 78 : 55 - (columnIndex % 3) * 8}%` }}
                  />
                </TD>
              ))}
            </TR>
          ))}
        </TBody>
      </Table>
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
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  // Refresh-proof workspace state: view, pipeline, closed toggle, search.
  const { session, ready } = useTableSession("opportunities");
  useEffect(() => {
    if (!ready) return;
    if (session) {
      if (session.search !== undefined) {
        setSearch(session.search);
        setDebouncedSearch(session.search);
      }
      if (session.activeView === "board" || session.activeView === "list") setView(session.activeView);
      if (typeof session.filters?.pipelineId === "string") setPipelineId(session.filters.pipelineId);
      if (typeof session.filters?.status === "string") setStatusFilter(session.filters.status);
      if (typeof session.filters?.includeClosed === "string") setIncludeClosed(session.filters.includeClosed === "1");
    }
    setHydrated(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, session]);

  useEffect(() => {
    if (!hydrated) return;
    writeTableSession("opportunities", {
      activeView: view,
      search,
      filters: { pipelineId, status: statusFilter, includeClosed: includeClosed ? "1" : "0" },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, view, search, pipelineId, statusFilter, includeClosed]);

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
        const listParams = new URLSearchParams({ pipelineId, pageSize: "100" });
        if (debouncedSearch) listParams.set("q", debouncedSearch);
        if (statusFilter) listParams.set("status", statusFilter);
        const response = await fetch(`/api/opportunities?${listParams.toString()}`);
        if (!response.ok) throw new Error("Unable to load opportunities.");
        setRows((await response.json()).data);
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to load.");
    } finally {
      setLoading(false);
    }
  }, [pipelineId, view, includeClosed, debouncedSearch, statusFilter]);

  useEffect(() => {
    void fetch("/api/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((body) => setMe(body?.data ?? null))
      .catch(() => setMe(null));
    void loadPipelines();
  }, [loadPipelines]);

  useEffect(() => {
    if (!hydrated) return;
    void load();
  }, [load, hydrated]);

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
    <div className="space-y-4" data-module="opportunities">
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
        actions={can.create ? (
          <Button variant="primary" icon="plus" onClick={() => { setEditRow(null); setShowForm(true); }}>New opportunity</Button>
        ) : null}
      />
      <WorkspaceQuickNav />
      <SmartTips context="records" />
      <div className="flex flex-wrap items-center gap-2">
        <select
          aria-label="Pipeline"
          value={pipelineId}
          onChange={(event) => setPipelineId(event.target.value)}
          className="input input-sm"
          style={{ width: "auto" }}
        >
          {pipelines.map((pipeline) => <option key={pipeline.id} value={pipeline.id}>{pipeline.name}{pipeline.isDefault ? " ★" : ""}</option>)}
        </select>
        <div className="tab-strip" role="group" aria-label="Opportunities view">
          <button
            type="button"
            onClick={() => setView("board")}
            aria-pressed={view === "board"}
            className={`tab-strip-button ${view === "board" ? "active" : ""}`}
          >
            Board
          </button>
          <button
            type="button"
            onClick={() => setView("list")}
            aria-pressed={view === "list"}
            className={`tab-strip-button ${view === "list" ? "active" : ""}`}
          >
            List
          </button>
        </div>
        {view === "list" ? (
          <>
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search all fields — name, owner, account, stage…"
              aria-label="Search opportunities"
              className="input input-sm"
              style={{ maxWidth: "300px" }}
            />
            <select
              aria-label="Status filter"
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              className="input input-sm"
              style={{ width: "auto" }}
            >
              <option value="">Status: all</option>
              <option value="OPEN">Open</option>
              <option value="WON">Won</option>
              <option value="LOST">Lost</option>
            </select>
          </>
        ) : null}
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
          <Button variant="secondary" size="sm" onClick={() => setShowAdmin(true)}>
            Manage pipelines
          </Button>
        ) : null}
      </div>

      {view === "board" && board?.truncated ? (
        <p className="text-xs text-(--text-tertiary)">
          Showing the 500 highest-value cards; column totals and headline metrics include every opportunity. Use the list view to find the rest.
        </p>
      ) : null}

      {error ? (
        <div role="alert" className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-(--error-bg) px-3 py-2 text-sm text-(--error)">
          <span>{error}</span>
          <button type="button" onClick={() => void load()} className="font-semibold underline">Retry</button>
        </div>
      ) : null}

      {pipelines.length === 0 && !loading ? (
        <div className="card">
          <EmptyState
            illustration="opportunities"
            title="No pipelines configured yet"
            description={can.settings ? "Create one under “Manage pipelines”." : undefined}
          />
        </div>
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
                className="card w-64 shrink-0 transition-colors"
                style={dragOver === stage.id ? { background: "var(--accent-soft)", borderColor: "var(--accent-border)" } : undefined}
              >
                <div className="card-header">
                  <div className="min-w-0">
                    <p className="card-title truncate">
                      {stage.name}
                      {stage.type !== "OPEN" ? ` (${stage.type.toLowerCase()})` : ""}
                    </p>
                    <p className="text-xs tabular-nums text-(--text-secondary)">
                      {money(agg?.value ?? 0)}
                    </p>
                  </div>
                  <span className="badge badge-neutral tabular-nums">{agg?.count ?? 0}</span>
                </div>
                <div className="space-y-2 p-2">
                  {cards.map((card) => (
                    <div
                      key={card.id}
                      draggable={can.edit}
                      onDragStart={(event) => event.dataTransfer.setData("text/opportunity-id", card.id)}
                      className="rounded-md border border-(--border-hairline) bg-(--bg-surface) p-2"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <Link
                          href={`/opportunities/${card.id}`}
                          className="min-w-0 text-sm font-medium hover:underline"
                        >
                          {card.name}
                        </Link>
                        {card.stage.type === "WON" ? (
                          <span className="badge badge-success">won</span>
                        ) : card.stage.type === "LOST" ? (
                          <span className="badge badge-error">lost</span>
                        ) : null}
                      </div>
                      <p className="mt-0.5 text-xs tabular-nums text-(--text-secondary)">
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
                          className="mt-1 w-full rounded-md border border-(--border-strong) bg-(--bg-surface) px-2 py-1 text-xs"
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
          <Table>
            <THead>
              <TR>
                <TH>Opportunity</TH>
                <TH>Account</TH>
                <TH>Stage</TH>
                <TH>Value</TH>
                <TH>Prob.</TH>
                <TH>Close date</TH>
                <TH>Owner</TH>
              </TR>
            </THead>
            <TBody>
              {rows.length === 0 ? (
                <TR>
                  <TD colSpan={7}>
                    <EmptyState
                      illustration="opportunities"
                      title="No opportunities in this pipeline"
                      description="Try a different pipeline or adjust the filters."
                    />
                  </TD>
                </TR>
              ) : (
                rows.map((row) => (
                  <TR key={row.id}>
                    <TD>
                      <Link href={`/opportunities/${row.id}`} className="font-medium text-(--brand) hover:underline">
                        {row.name}
                      </Link>
                    </TD>
                    <TD>{row.account?.name ?? "—"}</TD>
                    <TD>
                      <span className="badge badge-neutral">
                        {row.stage.name}
                      </span>
                    </TD>
                    <TD className="tabular-nums">{row.value ? money(Number(row.value)) : "—"}</TD>
                    <TD className="tabular-nums">{row.probability}%</TD>
                    <TD>
                      {row.expectedCloseAt ? new Date(row.expectedCloseAt).toLocaleDateString() : "—"}
                    </TD>
                    <TD>{row.owner?.name ?? "—"}</TD>
                  </TR>
                ))
              )}
            </TBody>
          </Table>
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
