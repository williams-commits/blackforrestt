"use client";

import { useCallback, useEffect, useState } from "react";
import { OpportunityForm } from "@/components/OpportunityFormDialog";
import { PipelineAdmin } from "@/components/PipelineAdminDialog";
import Link from "next/link";
import { WorkspaceHeader } from "@/components/WorkspaceHeader";
import { WorkspaceQuickNav } from "@/components/WorkspaceQuickNav";
import { SmartTips } from "@/components/SmartTips";
import { Button, EmptyState } from "@/components/ui";
import { Badge } from "@/components/ui/badge";
import { Card, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { SearchInput } from "@/components/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useTableSession, writeTableSession } from "@/components/useTableSession";
import { Initials } from "@/components/Initials";
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
        <Card key={`opp-board-skeleton-${columnIndex}`} className="w-64 shrink-0 gap-0 p-2">
          <div className="mb-3 flex items-center justify-between gap-3 px-1">
            <Skeleton style={{ height: 16, width: "46%" }} />
            <Skeleton style={{ height: 12, width: "30%" }} />
          </div>
          <div className="space-y-2">
            {[...Array(columnIndex === 0 ? 3 : 2)].map((__, cardIndex) => (
              <div key={`opp-card-skeleton-${columnIndex}-${cardIndex}`} className="rounded-md border border-(--border-hairline) bg-(--bg-surface) p-2">
                <Skeleton style={{ height: 15, width: `${78 - cardIndex * 8}%` }} />
                <Skeleton className="mt-2" style={{ height: 12, width: "52%" }} />
                <Skeleton className="mt-2" style={{ height: 11, width: "70%" }} />
              </div>
            ))}
          </div>
        </Card>
      ))}
    </div>
  );
}

function OpportunityListSkeleton() {
  return (
    <Card className="gap-0 overflow-hidden py-0">
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
                  <Skeleton
                    style={{ height: columnIndex === 0 ? 16 : 13, width: `${columnIndex === 0 ? 78 : 55 - (columnIndex % 3) * 8}%` }}
                  />
                </TD>
              ))}
            </TR>
          ))}
        </TBody>
      </Table>
    </Card>
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
        title="Opportunities" titleIcon="trending"
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
        <Select value={pipelineId} onValueChange={setPipelineId}>
          <SelectTrigger aria-label="Pipeline" size="sm" className="h-7 w-fit text-xs">
            <SelectValue placeholder="Pipeline" />
          </SelectTrigger>
          <SelectContent>
            {pipelines.map((pipeline) => (
              <SelectItem key={pipeline.id} value={pipeline.id}>
                {pipeline.name}{pipeline.isDefault ? " ★" : ""}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
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
            <SearchInput
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search all fields — name, owner, account, stage…"
              aria-label="Search opportunities"
              className="h-7 text-xs"
              wrapperClassName="w-full max-w-[300px]"
            />
            <Select
              value={statusFilter || "__all__"}
              onValueChange={(value) => setStatusFilter(value === "__all__" ? "" : value)}
            >
              <SelectTrigger aria-label="Status filter" size="sm" className="h-7 w-fit text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">Status: all</SelectItem>
                <SelectItem value="OPEN">Open</SelectItem>
                <SelectItem value="WON">Won</SelectItem>
                <SelectItem value="LOST">Lost</SelectItem>
              </SelectContent>
            </Select>
          </>
        ) : null}
        {view === "board" ? (
          <label htmlFor="opp-include-closed" className="flex items-center gap-1.5 text-sm text-(--text-secondary)">
            <Checkbox
              id="opp-include-closed"
              checked={includeClosed}
              onCheckedChange={(checked) => setIncludeClosed(checked === true)}
            />
            Show won/lost
          </label>
        ) : null}
        {can.settings ? (
          <Button variant="secondary" size="sm" icon="settings" onClick={() => setShowAdmin(true)}>
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
        <Card className="gap-0 py-0">
          <EmptyState
            illustration="opportunities"
            title="No pipelines configured yet"
            description={can.settings ? "Create one under “Manage pipelines”." : undefined}
          />
        </Card>
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
                className="w-64 shrink-0 rounded-xl bg-card ring-1 ring-foreground/10 transition-colors"
                style={dragOver === stage.id ? { background: "var(--accent-soft)", borderColor: "var(--accent-border)" } : undefined}
              >
                <div className="flex items-start justify-between gap-2 px-4 pb-3 pt-4">
                  <div className="min-w-0">
                    <CardTitle className="truncate text-sm font-semibold">
                      {stage.name}
                      {stage.type !== "OPEN" ? ` (${stage.type.toLowerCase()})` : ""}
                    </CardTitle>
                    <p className="mt-0.5 text-xs tabular-nums text-(--text-secondary)">
                      {money(agg?.value ?? 0)}
                    </p>
                  </div>
                  <Badge variant="outline" className="tabular-nums">{agg?.count ?? 0}</Badge>
                </div>
                <div className="space-y-2 p-2">
                  {cards.map((card) => (
                    <div
                      key={card.id}
                      draggable={can.edit}
                      onDragStart={(event) => event.dataTransfer.setData("text/opportunity-id", card.id)}
                      className="rounded-lg border bg-card p-2"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <Link
                          href={`/opportunities/${card.id}`}
                          className="min-w-0 text-sm font-medium hover:underline"
                        >
                          {card.name}
                        </Link>
                        {card.stage.type === "WON" ? (
                          <Badge variant="outline" className="border-(--success-border) bg-(--success-bg) text-(--success)">won</Badge>
                        ) : card.stage.type === "LOST" ? (
                          <Badge variant="destructive">lost</Badge>
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
                        <Select
                          value={card.stageId}
                          onValueChange={(value) => void moveStage(card.id, value)}
                        >
                          {/* stopPropagation keeps clicks on the select from
                              starting the card drag (native selects got this
                              for free). */}
                          <SelectTrigger
                            aria-label={`Stage for ${card.name}`}
                            size="sm"
                            className="mt-1 h-7 w-full text-xs"
                            onMouseDown={(event) => event.stopPropagation()}
                          >
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {stages.map((option) => (
                              <SelectItem key={option.id} value={option.id}>
                                {option.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
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
        <div className="card table-responsive overflow-x-auto p-2 lg:p-0">
          <Table>
            <THead>
              <TR>
                <TH className="px-3 py-2 font-medium">Opportunity</TH>
                <TH className="px-3 py-2 font-medium">Account</TH>
                <TH className="px-3 py-2 font-medium">Stage</TH>
                <TH className="px-3 py-2 font-medium">Value</TH>
                <TH className="px-3 py-2 font-medium">Prob.</TH>
                <TH className="px-3 py-2 font-medium">Close date</TH>
                <TH className="px-3 py-2 font-medium">Owner</TH>
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
                    <TD className="px-3 py-2">
                      <Link href={`/opportunities/${row.id}`} className="font-medium text-(--brand) hover:underline">
                        {row.name}
                      </Link>
                    </TD>
                    <TD className="px-3 py-2 whitespace-nowrap">{row.account?.name ? <span className="flex items-center gap-1.5"><Initials name={row.account.name} size="xs" />{row.account.name}</span> : "—"}</TD>
                    <TD className="px-3 py-2">
                      <Badge className="badge badge-neutral">
                        {row.stage.name}
                      </Badge>
                    </TD>
                    <TD className="px-3 py-2 tabular-nums">{row.value ? money(Number(row.value)) : "—"}</TD>
                    <TD className="px-3 py-2 tabular-nums">{row.probability}%</TD>
                    <TD className="px-3 py-2 whitespace-nowrap">
                      {row.expectedCloseAt ? new Date(row.expectedCloseAt).toLocaleDateString() : "—"}
                    </TD>
                    <TD className="px-3 py-2 whitespace-nowrap">{row.owner?.name ? <span className="flex items-center gap-1.5"><Initials name={row.owner.name} size="xs" />{row.owner.name}</span> : "—"}</TD>
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
