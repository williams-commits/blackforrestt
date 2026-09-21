"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Icon } from "@/components/Icon";
import { useTableSession, writeTableSession } from "@/components/useTableSession";
import { WorkspaceHeader } from "@/components/WorkspaceHeader";
import { WorkspaceQuickNav } from "@/components/WorkspaceQuickNav";
import { SmartTips } from "@/components/SmartTips";

interface CampaignRow {
  id: string;
  name: string;
  description: string | null;
  source: string | null;
  status: string;
  startsAt: string | null;
  endsAt: string | null;
  owner: { id: string; name: string } | null;
  memberCount: number;
}

interface CampaignsResponse {
  data?: CampaignRow[];
  meta?: { page: number; pageSize: number; total: number };
  error?: string;
}

const STATUS_OPTIONS = [
  { value: "", label: "Status: all" },
  { value: "DRAFT", label: "Draft" },
  { value: "ACTIVE", label: "Active" },
  { value: "PAUSED", label: "Paused" },
  { value: "COMPLETED", label: "Completed" },
];

export function CampaignsPage({ canCreate }: { canCreate: boolean }) {
  const [rows, setRows] = useState<CampaignRow[]>([]);
  const [meta, setMeta] = useState({ page: 1, pageSize: 25, total: 0 });
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [sort, setSort] = useState("");
  const [order, setOrder] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [hydrated, setHydrated] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [source, setSource] = useState("");
  const [status, setStatus] = useState("DRAFT");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  // Restore the saved table session once after mount (refresh-proof).
  const { session, ready } = useTableSession("campaigns");
  useEffect(() => {
    if (!ready) return;
    if (session) {
      if (typeof session.search === "string") {
        setSearch(session.search);
        setDebouncedSearch(session.search);
      }
      if (session.sort !== undefined) setSort(session.sort);
      if (session.order) setOrder(session.order);
      if (session.page !== undefined) setPage(session.page);
      if (session.pageSize !== undefined) setPageSize(session.pageSize);
      if (session.filters) {
        if (typeof session.filters.status === "string") setStatusFilter(session.filters.status);
      }
    }
    setHydrated(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, session]);

  useEffect(() => {
    if (!hydrated) return;
    writeTableSession("campaigns", {
      page,
      pageSize,
      search,
      sort,
      order,
      filters: { status: statusFilter },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, page, pageSize, search, sort, order, statusFilter]);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
      if (debouncedSearch) params.set("q", debouncedSearch);
      if (sort) {
        params.set("sort", sort);
        params.set("order", order);
      }
      if (statusFilter) params.set("status", statusFilter);
      const response = await fetch(`/api/campaigns?${params.toString()}`);
      const body = await response.json().catch(() => null) as CampaignsResponse | null;
      if (!response.ok) throw new Error(body?.error ?? `Request failed (${response.status})`);
      setRows(body?.data ?? []);
      if (body?.meta) setMeta(body.meta);
    } catch (cause) {
      setLoadError(cause instanceof Error ? cause.message : "Unable to load campaigns.");
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, debouncedSearch, sort, order, statusFilter]);

  useEffect(() => {
    if (!hydrated) return;
    void load();
  }, [load, hydrated]);

  const totalPages = Math.max(1, Math.ceil(meta.total / (meta.pageSize || 25)));
  useEffect(() => {
    if (!hydrated || loading) return;
    if (page > totalPages) setPage(totalPages);
  }, [hydrated, loading, page, totalPages]);

  async function createCampaign(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    const response = await fetch("/api/campaigns", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        description: description || null,
        source: source || null,
        status,
      }),
    });
    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      setError(body?.error ?? "Could not create campaign.");
      return;
    }
    setShowForm(false);
    setName("");
    setDescription("");
    setSource("");
    setStatus("DRAFT");
    void load();
  }

  const statusTone = (value: string) =>
    value === "ACTIVE" ? "badge-success" : value === "COMPLETED" ? "badge-info" : "badge-neutral";

  return (
    <div className="space-y-4">
      <WorkspaceHeader
        eyebrow="Reach & engagement"
        title="Campaigns"
        subtitle="Coordinate outreach and see which relationships move forward."
        actions={canCreate ? <button type="button" onClick={() => setShowForm((previous) => !previous)} className="btn btn-primary"><Icon name="plus" size={14} /> New campaign</button> : undefined}
        metrics={[{ label: "Campaigns", value: meta.total, tone: "brand" }, { label: "Active", value: rows.filter((row) => row.status === "ACTIVE").length, tone: "success" }, { label: "Members", value: rows.reduce((total, row) => total + row.memberCount, 0), tone: "info" }]}
      />
      <WorkspaceQuickNav />
      <SmartTips context="records" />

      {showForm ? (
        <form method="post" onSubmit={createCampaign} className="grid gap-4 rounded-xl border border-(--border-default) bg-(--bg-surface) p-5 shadow-(--shadow-subtle) sm:grid-cols-4">
          <div className="sm:col-span-4"><p className="form-dialog-eyebrow">Reach &amp; engagement</p><p className="form-section-title">Create a campaign</p><p className="form-section-help">Give the team a clear audience, source, and operating status.</p></div>
          {error ? (
            <p role="alert" className="sm:col-span-4 rounded-md bg-(--error-bg) px-3 py-2 text-sm text-(--error)">
              {error}
            </p>
          ) : null}
          <div>
            <label htmlFor="c-name" className="form-label">Name <span className="form-required">*</span></label>
            <input id="c-name" value={name} onChange={(e) => setName(e.target.value)} required minLength={2} className="input" />
          </div>
          <div>
            <label htmlFor="c-source" className="form-label">Source</label>
            <input id="c-source" value={source} onChange={(e) => setSource(e.target.value)} className="input" />
          </div>
          <div>
            <label htmlFor="c-status" className="form-label">Status</label>
            <select id="c-status" value={status} onChange={(e) => setStatus(e.target.value)} className="input">
              <option value="DRAFT">Draft</option>
              <option value="ACTIVE">Active</option>
              <option value="PAUSED">Paused</option>
              <option value="COMPLETED">Completed</option>
            </select>
          </div>
          <div>
            <label htmlFor="c-desc" className="form-label">Description</label>
            <input id="c-desc" value={description} onChange={(e) => setDescription(e.target.value)} className="input" />
          </div>
          <div className="form-actions sm:col-span-4">
            <button type="submit" className="btn btn-primary">
              <Icon name="plus" size={14} /> Create campaign
            </button>
          </div>
        </form>
      ) : null}

      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-(--border-default) bg-(--bg-surface) p-3">
        <form
          className="flex flex-1 items-center gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            setDebouncedSearch(search);
            setPage(1);
          }}
        >
          <input
            type="search"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
            placeholder="Search all fields — name, description, source, owner…"
            aria-label="Search campaigns"
            className="input input-sm"
            style={{ maxWidth: "320px" }}
          />
          <select
            aria-label="Status filter"
            value={statusFilter}
            onChange={(event) => { setStatusFilter(event.target.value); setPage(1); }}
            className="input input-sm"
            style={{ width: "auto" }}
          >
            {STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </form>
      </div>

      <div className="card overflow-hidden">
        <table className="table">
          <thead>
            <tr>
              <th>
                <button
                  type="button"
                  onClick={() => {
                    if (sort !== "name") { setSort("name"); setOrder("asc"); }
                    else if (order === "asc") { setOrder("desc"); }
                    else { setSort(""); setOrder("desc"); }
                    setPage(1);
                  }}
                  className="text-left hover:underline"
                  aria-label="Sort by campaign"
                >
                  Campaign {sort === "name" ? (order === "asc" ? " ▴" : " ▾") : ""}
                </button>
              </th>
              <th>Status</th>
              <th>Source</th>
              <th>Members</th>
              <th>Owner</th>
              <th>Window</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              [...Array(5)].map((_, index) => (
                <tr key={`sk-${index}`}><td colSpan={6}><div className="skeleton" style={{ height: "16px", width: `${75 - index * 10}%` }} /></td></tr>
              ))
            ) : loadError ? (
              <tr><td colSpan={6}><div className="empty-state"><p className="empty-state-title" style={{ color: "var(--error)" }}>{loadError}</p><button type="button" onClick={() => void load()} className="btn btn-secondary" style={{ marginTop: "var(--space-3)" }}>Retry</button></div></td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={6}><div className="empty-state"><p className="empty-state-title">No campaigns found</p><p className="empty-state-description">{search || statusFilter ? "Try adjusting your search or filters." : "Create a campaign to organize outreach and measure response."}</p></div></td></tr>
            ) : (
              rows.map((row) => (
                <tr key={row.id}>
                  <td>
                    <Link href={`/campaigns/${row.id}`} className="font-medium text-(--brand) hover:underline">
                      {row.name}
                    </Link>
                    {row.description ? <p className="text-xs text-(--text-tertiary)">{row.description}</p> : null}
                  </td>
                  <td>
                    <span className={`badge ${statusTone(row.status)}`}>{row.status.toLowerCase()}</span>
                  </td>
                  <td>{row.source ?? "—"}</td>
                  <td>{row.memberCount}</td>
                  <td>{row.owner?.name ?? "—"}</td>
                  <td className="text-xs text-(--text-secondary)">
                    {row.startsAt ? new Date(row.startsAt).toLocaleDateString() : "—"}
                    {row.endsAt ? ` → ${new Date(row.endsAt).toLocaleDateString()}` : ""}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2" style={{ fontSize: "var(--text-sm)", color: "var(--text-tertiary)" }}>
        <span>
          {meta.total > 0 ? (
            <>
              Showing <strong style={{ color: "var(--text-primary)" }}>{(meta.page - 1) * meta.pageSize + 1}–{Math.min(meta.page * meta.pageSize, meta.total)}</strong> of {meta.total}
              <span style={{ marginLeft: "8px" }}>· Page <strong style={{ color: "var(--text-primary)" }}>{meta.page}</strong> of {totalPages}</span>
            </>
          ) : (
            <>Page <strong style={{ color: "var(--text-primary)" }}>{meta.page}</strong> of {totalPages}</>
          )}
        </span>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-1">
            Rows
            <select
              aria-label="Rows per page"
              value={pageSize}
              onChange={(event) => { setPageSize(Number(event.target.value)); setPage(1); }}
              className="btn btn-secondary btn-sm"
              style={{ width: "auto" }}
            >
              {[10, 25, 50, 100].map((size) => (
                <option key={size} value={size}>{size}</option>
              ))}
            </select>
          </label>
          <button type="button" disabled={meta.page <= 1 || loading} onClick={() => setPage((value) => Math.max(1, value - 1))} className="btn btn-secondary btn-sm">← Prev</button>
          <button type="button" disabled={meta.page >= totalPages || loading} onClick={() => setPage((value) => value + 1)} className="btn btn-secondary btn-sm">Next →</button>
        </div>
      </div>
    </div>
  );
}
