"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { RECORD_UI, type ObjectKey } from "@/lib/recordUi";
import { RecordForm, type OptionSource } from "@/components/RecordForm";
import { ViewTabs, type ViewOption } from "@/components/ViewTabs";
import { RowActions } from "@/components/RowActions";
import { InlineEdit } from "@/components/InlineEdit";

interface MeContext {
  userId: string;
  roleKey: string;
  permissions: string[];
}

interface ListResponse {
  data: Array<Record<string, unknown> & { id: string }>;
  meta: { page: number; pageSize: number; total: number };
}

const EMPTY_OPTIONS: OptionSource = {
  leadStatuses: [],
  contactStatuses: [],
  customerStatuses: [],
  users: [],
  accounts: [],
  contacts: [],
  campaigns: [],
};

/**
 * Fresh option buckets per fetch. NEVER spread EMPTY_OPTIONS here: a shallow
 * copy would share its arrays and pushing statuses would mutate the
 * module-level state — React StrictMode's double-mounted effects then
 * accumulate duplicates (duplicate <option> keys) on every remount.
 */
function freshOptions(): OptionSource {
  return {
    leadStatuses: [],
    contactStatuses: [],
    customerStatuses: [],
    users: [],
    accounts: [],
    contacts: [],
    campaigns: [],
  };
}

/** Resolve a column key ("a.b" or "firstName lastName") against a row. */
function cellValue(row: Record<string, unknown>, key: string): string {
  if (key.includes(" ")) {
    return key
      .split(" ")
      .map((part) => cellValue(row, part))
      .filter(Boolean)
      .join(" ");
  }
  let current: unknown = row;
  for (const segment of key.split(".")) {
    if (current === null || current === undefined) return "";
    current = (current as Record<string, unknown>)[segment];
  }
  if (current === null || current === undefined) return "";
  if (typeof current === "object") {
    const record = current as Record<string, unknown>;
    return String(record.name ?? record.label ?? "");
  }
  return String(current);
}

function formatDate(value: string, withTime: boolean): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return withTime
    ? date.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })
    : date.toLocaleDateString(undefined, { dateStyle: "medium" });
}

export function RecordListPage({ object }: { object: ObjectKey }) {
  const config = RECORD_UI[object];
  const [me, setMe] = useState<MeContext | null>(null);
  const [rows, setRows] = useState<ListResponse["data"]>([]);
  const [meta, setMeta] = useState<ListResponse["meta"]>({ page: 1, pageSize: 25, total: 0 });
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("");
  const [hiddenColumns, setHiddenColumns] = useState<string[]>([]);
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [formMode, setFormMode] = useState<"closed" | "create" | "edit">("closed");
  const [editRow, setEditRow] = useState<Record<string, unknown> | null>(null);
  const [options, setOptions] = useState<OptionSource>(EMPTY_OPTIONS);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkError, setBulkError] = useState<string | null>(null);
  const [mergeOpen, setMergeOpen] = useState(false);
  const [mergePrimary, setMergePrimary] = useState<string>("");
  const [mergeBusy, setMergeBusy] = useState(false);
  const [mergeError, setMergeError] = useState<string | null>(null);
  const [allTags, setAllTags] = useState<Array<{ id: string; name: string }>>([]);
  const [views, setViews] = useState<
    Array<{
      id: string;
      name: string;
      shared: boolean;
      config: { q?: string; filters?: Record<string, string> };
      user?: { name: string };
    }>
  >([]);
  const [viewName, setViewName] = useState("");
  const [activeView, setActiveView] = useState("all");
  const [density, setDensity] = useState<"comfortable" | "compact">("comfortable");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const can = useMemo(() => {
    const permissions = me?.permissions ?? [];
    const objectUpper = object.toUpperCase().slice(0, -1);
    const edit = permissions.includes(config.can.edit);
    return {
      create: permissions.includes(config.can.create),
      edit,
      delete: permissions.includes(config.can.delete),
      // Leads gate reassignment on a dedicated ASSIGN permission; the
      // owner-keyed objects reassign the owner, which is an EDIT.
      assign: config.can.assign ? permissions.includes(config.can.assign) : edit,
      bulk: true,
      export: permissions.includes(`${objectUpper}S_EXPORT`),
    };
  }, [me, config, object]);

  const bulkStatusOptions =
    object === "leads"
      ? options.leadStatuses
      : object === "contacts"
        ? options.contactStatuses
        : object === "customers"
          ? options.customerStatuses
          : [];

  const presetViews: ViewOption[] = [
    { key: "all", label: `All ${config.title}` },
    { key: "mine", label: `My ${config.title}` },
    { key: "recent", label: "Recently Added" },
    ...(object === "leads" ? [{ key: "unassigned", label: "Unassigned" }] : []),
    ...views.map((v) => ({ key: `saved:${v.id}`, label: v.name, isSaved: true })),
  ];

  function handleViewChange(key: string) {
    setActiveView(key);
    setPage(1);
    setSelected(new Set());
    if (key === "all") {
      setFilters({});
      setSearch("");
      setSort("");
    } else if (key === "mine") {
      setFilters(object === "leads" ? { assignment: "mine" } : {});
      setSearch("");
    } else if (key === "recent") {
      setFilters({});
      setSearch("");
      setSort("createdAt");
    } else if (key === "unassigned") {
      setFilters(object === "leads" ? { assignment: "unassigned" } : {});
      setSearch("");
    } else if (key.startsWith("saved:")) {
      const view = views.find((v) => `saved:${v.id}` === key);
      if (view) {
        setSearch(view.config.q ?? "");
        setFilters(view.config.filters ?? {});
      }
    }
  }

  const fetchOptions = useCallback(async () => {
    try {
      const [statuses, users] = await Promise.all([
        fetch("/api/record-statuses").then((r) => (r.ok ? r.json() : { data: [] })),
        fetch("/api/users").then((r) => (r.ok ? r.json() : { data: [] })),
      ]);
      const next: OptionSource = freshOptions();
      for (const status of statuses.data as Array<{ id: string; name: string; appliesTo: string }>) {
        const key =
          status.appliesTo === "LEAD"
            ? "leadStatuses"
            : status.appliesTo === "CONTACT"
              ? "contactStatuses"
              : "customerStatuses";
        next[key].push({ value: status.id, label: status.name });
      }
      for (const user of users.data as Array<{ id: string; name: string }>) {
        next.users.push({ value: user.id, label: user.name });
      }
      if (object === "contacts" || object === "customers") {
        const accounts = await fetch("/api/accounts?pageSize=100").then((r) =>
          r.ok ? r.json() : { data: [] },
        );
        for (const account of accounts.data as Array<{ id: string; name: string }>) {
          next.accounts.push({ value: account.id, label: account.name });
        }
      }
      if (object === "leads" || object === "contacts" || object === "customers") {
        const campaigns = await fetch("/api/campaigns").then((r) => (r.ok ? r.json() : { data: [] }));
        for (const campaign of campaigns.data as Array<{ id: string; name: string }>) {
          next.campaigns.push({ value: campaign.id, label: campaign.name });
        }
      }
      if (object === "customers") {
        const contacts = await fetch("/api/contacts?pageSize=100").then((r) =>
          r.ok ? r.json() : { data: [] },
        );
        for (const contact of contacts.data as Array<{ id: string; firstName: string; lastName: string }>) {
          next.contacts.push({ value: contact.id, label: `${contact.firstName} ${contact.lastName}` });
        }
      }
      setOptions(next);
    } catch {
      // Options are enhancement-only; the form still works without them.
    }
  }, [object]);

  const fetchRows = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: "25" });
      if (search) params.set("q", search);
      if (sort) params.set("sort", sort);
      for (const [key, value] of Object.entries(filters)) {
        if (value) params.set(key, value);
      }
      const response = await fetch(`/api/${object}?${params.toString()}`);
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? `Request failed (${response.status})`);
      }
      const body = (await response.json()) as ListResponse;
      setRows(body.data);
      setMeta(body.meta);
      setSelected(new Set());
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Unable to load records.");
    } finally {
      setLoading(false);
    }
  }, [object, page, search, filters, sort]);

  useEffect(() => {
    void fetch("/api/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((body) => setMe(body?.data ?? null))
      .catch(() => setMe(null));
    void fetchOptions();
    void fetch("/api/tags")
      .then((r) => (r.ok ? r.json() : null))
      .then((body) => setAllTags(body?.data ?? []))
      .catch(() => setAllTags([]));
    void fetch(`/api/views?objectType=${object.toUpperCase().slice(0, -1)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((body) => setViews(body?.data ?? []))
      .catch(() => setViews([]));
  }, [fetchOptions, object]);

  useEffect(() => {
    void fetchRows();
  }, [fetchRows]);

  const totalPages = Math.max(1, Math.ceil(meta.total / meta.pageSize));
  const allSelected = rows.length > 0 && rows.every((row) => selected.has(row.id));

  function toggleRow(id: string) {
    setSelected((previous) => {
      const next = new Set(previous);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function runBulk(action: string, extra: Record<string, unknown>) {
    setBulkBusy(true);
    setBulkError(null);
    try {
      const response = await fetch(`/api/${object}/bulk`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ids: [...selected], ...extra }),
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? "Bulk action failed.");
      }
      await fetchRows();
    } catch (error) {
      setBulkError(error instanceof Error ? error.message : "Bulk action failed.");
    } finally {
      setBulkBusy(false);
    }
  }

  async function deleteRow(row: Record<string, unknown>) {
    if (!window.confirm(`Delete this ${config.singular.toLowerCase()}? This can be undone only by an administrator.`)) {
      return;
    }
    await fetch(`/api/${object}/${row.id}`, { method: "DELETE" });
    void fetchRows();
  }

  const mergeCandidates = rows.filter((row) => selected.has(row.id));

  async function runMerge() {
    if (!mergePrimary) return;
    setMergeBusy(true);
    setMergeError(null);
    try {
      const mergedId = mergeCandidates.find((row) => row.id !== mergePrimary)?.id;
      if (!mergedId) return;
      const response = await fetch("/api/leads/merge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ primaryId: mergePrimary, mergedId }),
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? "Merge failed.");
      }
      setMergeOpen(false);
      await fetchRows();
    } catch (error) {
      setMergeError(error instanceof Error ? error.message : "Merge failed.");
    } finally {
      setMergeBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      {mounted ? (
        <ViewTabs
          views={presetViews}
          activeView={activeView}
          onViewChange={handleViewChange}
          onNewClick={can.create ? () => { setEditRow(null); setFormMode("create"); } : undefined}
          onExportClick={can.export ? () => {
            window.location.href = `/api/export?object=${object}${search ? `&q=${encodeURIComponent(search)}` : ""}${filters.statusId ? `&statusId=${filters.statusId}` : ""}`;
          } : undefined}
          canCreate={can.create}
          canExport={can.export}
          totalCount={meta.total}
        />
      ) : (
        <div className="page-header">
          <div>
            <h1 className="page-title">{config.title}</h1>
            <p className="page-subtitle">{meta.total} record{meta.total === 1 ? "" : "s"}</p>
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] p-3">
        <form
          className="flex flex-1 flex-wrap items-center gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            setPage(1);
            void fetchRows();
          }}
        >
          <button
            type="button"
            onClick={() => setDensity(density === "comfortable" ? "compact" : "comfortable")}
            className="btn btn-ghost"
            style={{ height: "32px", padding: "0 6px" }}
            title={density === "comfortable" ? "Compact rows" : "Comfortable rows"}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              {density === "comfortable" ? (
                <><line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" /></>
              ) : (
                <><line x1="3" y1="8" x2="21" y2="8" /><line x1="3" y1="16" x2="21" y2="16" /></>
              )}
            </svg>
          </button>
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={config.searchPlaceholder}
            aria-label="Search"
            className="input" style={{ height: "32px" }}
          />
          {config.filters.map((filter) => {
            const filterOptions = filter.optionsFrom ? options[filter.optionsFrom] : (filter.options ?? []);
            return (
              <select
                key={filter.name}
                aria-label={filter.label}
                value={filters[filter.name] ?? ""}
                onChange={(event) => {
                  setFilters((previous) => ({ ...previous, [filter.name]: event.target.value }));
                  setPage(1);
                }}
                className="input" style={{ height: "32px", width: "auto", display: "inline-block" }}
              >
                <option value="">{filter.label}: all</option>
                {filterOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            );
          })}
        </form>
        <div className="flex items-center gap-2 border-l border-[var(--border-default)] pl-2">
          {views.length > 0 ? (
            <select
              aria-label="Saved views"
              defaultValue=""
              onChange={(event) => {
                const view = views.find((entry) => entry.id === event.target.value);
                if (!view) return;
                setSearch(view.config.q ?? "");
                setFilters(view.config.filters ?? {});
                setPage(1);
              }}
              className="input" style={{ height: "32px", width: "auto", display: "inline-block" }}
            >
              <option value="">Saved views…</option>
              {views.map((view) => (
                <option key={view.id} value={view.id}>
                  {view.name}
                  {view.shared ? " (shared)" : ""}
                </option>
              ))}
            </select>
          ) : null}
          <select
            aria-label="Columns"
            multiple
            value={config.columns.filter((c) => !hiddenColumns.includes(c.key)).map((c) => c.key)}
            onChange={(event) =>
              setHiddenColumns(
                config.columns
                  .map((c) => c.key)
                  .filter((key) => !Array.from(event.target.selectedOptions).some((o) => o.value === key)),
              )
            }
            className="hidden rounded-md border border-[var(--border-strong)] px-2 py-1.5 text-xs sm:block"
            size={2}
            title="Hold Cmd/Ctrl to change visible columns"
          >
            {config.columns.map((column) => (
              <option key={column.key} value={column.key}>
                {column.label}
              </option>
            ))}
          </select>
          <input
            aria-label="View name"
            placeholder="Name this view"
            value={viewName}
            onChange={(event) => setViewName(event.target.value)}
            className="w-32 rounded-md border border-[var(--border-strong)] px-2 py-1.5 text-sm"
          />
          <button
            type="button"
            disabled={!viewName}
            onClick={async () => {
              const response = await fetch("/api/views", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  objectType: object.toUpperCase().slice(0, -1),
                  name: viewName,
                  config: { q: search, filters },
                  shared: false,
                }),
              });
              if (response.ok) {
                setViewName("");
                const refreshed = await fetch(
                  `/api/views?objectType=${object.toUpperCase().slice(0, -1)}`,
                ).then((r) => (r.ok ? r.json() : { data: [] }));
                setViews(refreshed.data);
              }
            }}
            className="rounded-md border border-[var(--border-strong)] px-2 py-1.5 text-sm font-medium hover:bg-[var(--bg-hover)] disabled:opacity-50"
          >
            Save view
          </button>
        </div>
      </div>

      {selected.size > 0 && can.bulk ? (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border p-3" style={{ borderColor: "var(--brand-200)", background: "var(--brand-50)", fontSize: "var(--text-sm)" }}>
          <span className="font-medium">{selected.size} selected</span>
          {can.assign ? (
            <select
              aria-label="Assign to"
              defaultValue=""
              disabled={bulkBusy}
              onChange={(event) => {
                if (event.target.value) void runBulk("assign", { assignedUserId: event.target.value });
              }}
              className="rounded-md border border-[var(--border-strong)] bg-[var(--bg-surface)] px-2 py-1.5"
            >
              <option value="">Assign to…</option>
              {options.users.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          ) : null}
          {bulkStatusOptions.length > 0 ? (
            <select
              aria-label="Change status"
              defaultValue=""
              disabled={bulkBusy}
              onChange={(event) => {
                if (event.target.value) void runBulk("status", { statusId: event.target.value });
              }}
              className="rounded-md border border-[var(--border-strong)] bg-[var(--bg-surface)] px-2 py-1.5"
            >
              <option value="">Change status…</option>
              {bulkStatusOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          ) : null}
          {can.delete ? (
            <button
              type="button"
              disabled={bulkBusy}
              onClick={() => {
                if (window.confirm(`Delete ${selected.size} record(s)?`)) void runBulk("delete", {});
              }}
              className="btn btn-destructive" style={{ height: "28px", fontSize: "12px" }}
            >
              Delete
            </button>
          ) : null}
          {can.assign ? (
            <select
              aria-label="Bulk tag"
              defaultValue=""
              disabled={bulkBusy}
              onChange={(event) => {
                if (event.target.value) void runBulk("tag", { tagId: event.target.value });
              }}
              className="rounded-md border border-[var(--border-strong)] bg-[var(--bg-surface)] px-2 py-1.5"
            >
              <option value="">Add tag…</option>
              {allTags.map((tag) => (
                <option key={tag.id} value={tag.id}>
                  {tag.name}
                </option>
              ))}
            </select>
          ) : null}
          {can.edit ? (
            <button
              type="button"
              disabled={bulkBusy}
              onClick={() => {
                const title = window.prompt(`Create a follow-up task for ${selected.size} ${config.singular.toLowerCase()}(s) — task title:`);
                if (title && title.trim().length >= 2) void runBulk("task", { title: title.trim() });
              }}
              className="rounded-md border border-[var(--border-strong)] bg-[var(--bg-surface)] px-2 py-1.5 font-medium"
            >
              Create task…
            </button>
          ) : null}
          {can.delete && selected.size === 2 ? (
            <button
              type="button"
              onClick={() => {
                setMergePrimary(mergeCandidates[0]?.id ?? "");
                setMergeOpen(true);
              }}
              className="rounded-md border border-[var(--border-strong)] bg-[var(--bg-surface)] px-2 py-1.5 font-medium"
            >
              Merge selected…
            </button>
          ) : null}
          {bulkError ? <span className="text-[var(--error)]">{bulkError}</span> : null}
        </div>
      ) : null}

      {mergeOpen && mergeCandidates.length === 2 ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-md space-y-4 rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] p-6 shadow-xl">
            <h2 className="text-base font-semibold">Merge leads</h2>
            <p className="text-sm text-[var(--text-secondary)]">
              Choose the surviving record. The other lead is deleted; its timeline, notes, and
              open tasks move to the survivor.
            </p>
            {mergeError ? (
              <p role="alert" className="rounded-md bg-[var(--error-bg)] px-3 py-2 text-sm text-[var(--error)]">
                {mergeError}
              </p>
            ) : null}
            <div className="space-y-2">
              {mergeCandidates.map((row) => (
                <label key={row.id} className="flex items-center gap-2 rounded-md border border-[var(--border-default)] p-3 text-sm">
                  <input
                    type="radio"
                    name="merge-primary"
                    checked={mergePrimary === row.id}
                    onChange={() => setMergePrimary(row.id)}
                  />
                  Keep <strong>{cellValue(row, "firstName lastName")}</strong>
                  {cellValue(row, "email") ? ` (${cellValue(row, "email")})` : ""}
                </label>
              ))}
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setMergeOpen(false)}
                className="btn btn-secondary"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void runMerge()}
                disabled={mergeBusy || !mergePrimary}
                className="rounded-md px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-60"
                style={{ background: "var(--brand)" }}
              >
                {mergeBusy ? "Merging…" : "Merge"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      
      {Object.entries(filters).filter(([, value]) => value).length > 0 || search ? (
        <div className="flex flex-wrap items-center gap-2" style={{ marginBottom: "var(--space-2)" }}>
          {search ? (
            <span className="chip">
              Search: {search}
              <span className="chip-close" onClick={() => { setSearch(""); setPage(1); }}>×</span>
            </span>
          ) : null}
          {Object.entries(filters).filter(([, value]) => value).map(([key, value]) => {
            const filterConfig = config.filters.find((f) => f.name === key);
            const label = filterConfig?.label ?? key;
            const optionList = filterConfig?.optionsFrom ? options[filterConfig.optionsFrom] : (filterConfig?.options ?? []);
            const optionLabel = optionList.find((o) => o.value === value)?.label ?? value;
            return (
              <span key={key} className="chip">
                {label}: {optionLabel}
                <span className="chip-close" onClick={() => { setFilters((prev) => ({ ...prev, [key]: "" })); setPage(1); }}>×</span>
              </span>
            );
          })}
          <button
            type="button"
            className="btn btn-ghost"
            style={{ height: "24px", fontSize: "11px" }}
            onClick={() => { setSearch(""); setFilters({}); setPage(1); }}
          >
            Clear all
          </button>
        </div>
      ) : null}

<div className="card table-responsive overflow-hidden">
        <table className={`table ${density === "compact" ? "table-compact" : ""}`}>
          <thead>
            <tr className="border-b border-[var(--border-default)] bg-[var(--bg-hover)] text-left text-xs uppercase tracking-wide text-[var(--text-secondary)]">
              {can.bulk ? (
                <th className="w-8 px-3 py-2">
                  <input
                    type="checkbox"
                    aria-label="Select all on page"
                    checked={allSelected}
                    onChange={() =>
                      setSelected(allSelected ? new Set() : new Set(rows.map((row) => row.id)))
                    }
                  />
                </th>
              ) : null}
              {config.columns.map((column) => (
                <th key={column.key} className="px-3 py-2 font-medium">
                  {hiddenColumns.includes(column.key) ? null : (
                    <button
                      type="button"
                      onClick={() => {
                        const key = column.key === "firstName lastName" ? "name" : column.key.split(".")[0];
                        setSort(sort === key ? "" : key);
                        setPage(1);
                      }}
                      className="text-left hover:underline"
                    >
                      {column.label}
                      {sort === (column.key === "firstName lastName" ? "name" : column.key.split(".")[0]) ? " ▾" : ""}
                    </button>
                  )}
                </th>
              ))}
              <th className="px-3 py-2 text-right font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              [...Array(6)].map((_, index) => (
                <tr key={`skeleton-${index}`}>
                  <td colSpan={config.columns.length + 2} style={{ padding: "10px 12px" }}>
                    <div className="skeleton" style={{ height: "16px", width: `${70 - index * 8}%` }} />
                  </td>
                </tr>
              ))
            ) : loadError ? (
              <tr>
                <td colSpan={config.columns.length + 2}>
                  <div className="empty-state" style={{ padding: "var(--space-8)" }}>
                    <p className="empty-state-title" style={{ color: "var(--error)" }}>{loadError}</p>
                  </div>
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={config.columns.length + 2}>
                  <div className="empty-state">
                    <svg className="empty-state-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <path d="M21 15V6a2 2 0 00-2-2H5a2 2 0 00-2 2v9m18 0a2 2 0 01-2 2H5a2 2 0 01-2-2m18 0v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
                    </svg>
                    <p className="empty-state-title">No {config.title.toLowerCase()} found</p>
                    <p className="empty-state-description">
                      {search || Object.values(filters).some(Boolean)
                        ? "Try adjusting your search or filters."
                        : `Get started by creating your first ${config.singular.toLowerCase()}.`}
                    </p>
                    {can.create && !search && !Object.values(filters).some(Boolean) ? (
                      <button type="button" className="btn btn-primary" onClick={() => { setEditRow(null); setFormMode("create"); }}>
                        New {config.singular}
                      </button>
                    ) : null}
                  </div>
                </td>
              </tr>
            ) : (
              rows.map((row) => {
                const isSelected = selected.has(row.id);
                return (
                  <tr
                  key={row.id}
                  className={isSelected ? "bg-[var(--brand)]/5" : ""}
                  tabIndex={0}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      const firstLink = event.currentTarget.querySelector("a[href]");
                      if (firstLink) (firstLink as HTMLElement).click();
                    }
                  }}
                  style={{ cursor: "pointer" }}
                >
                    {can.bulk ? (
                      <td className="px-3 py-2">
                        <input
                          type="checkbox"
                          aria-label="Select row"
                          checked={isSelected}
                          onChange={() => toggleRow(row.id)}
                        />
                      </td>
                    ) : null}
                    {config.columns.map((column, index) => {
                      if (hiddenColumns.includes(column.key)) return null;
                      const raw = cellValue(row, column.key);
                      const content = (() => {
                        if (!raw) return <span className="text-[var(--text-tertiary)]">—</span>;
                        if (column.type === "record" && index === 0) {
                          return (
                            <Link
                              href={`/${column.object}/${row.id}`}
                              className="font-medium text-[var(--brand)] hover:underline"
                            >
                              {raw}
                            </Link>
                          );
                        }
                        if (column.type === "record") {
                          const linked = column.key.split(".").slice(0, -1).join(".");
                          const linkedId = cellValue(row, `${linked}.id`);
                          return linkedId ? (
                            <Link href={`/${column.object}/${linkedId}`} className="hover:underline">
                              {raw}
                            </Link>
                          ) : (
                            raw
                          );
                        }
                        if (column.type === "badge") {
                          // Inline-editable status for leads (most common use case)
                          const isStatusCol = column.key.includes("status");
                          if (isStatusCol && can.edit && object === "leads") {
                            const currentStatusId = row.statusId as string;
                            return (
                              <InlineEdit
                                value={currentStatusId ?? ""}
                                options={options.leadStatuses}
                                onSave={async (newStatusId) => {
                                  await fetch(`/api/leads/${row.id}`, {
                                    method: "PATCH",
                                    headers: { "Content-Type": "application/json" },
                                    body: JSON.stringify({ statusId: newStatusId }),
                                  });
                                  void fetchRows();
                                }}
                                render={(val, onClick) => (
                                  <span className="badge badge-neutral" onClick={onClick}>
                                    {raw}
                                  </span>
                                )}
                              />
                            );
                          }
                          return (
                            <span className="badge badge-neutral">
                              {raw}
                            </span>
                          );
                        }
                        if (column.type === "date") return formatDate(raw, false);
                        if (column.type === "datetime") return formatDate(raw, true);
                        if (column.type === "email") {
                          return (
                            <a href={`mailto:${raw}`} className="hover:underline">
                              {raw}
                            </a>
                          );
                        }
                        return raw;
                      })();
                      return (
                        <td key={column.key} className="px-3 py-2 whitespace-nowrap">
                          {content}
                        </td>
                      );
                    })}
                    <td className="px-3 py-2 text-right whitespace-nowrap">
                      <RowActions
                        actions={[
                          ...(can.edit
                            ? [{
                                label: "Edit",
                                icon: "edit",
                                onClick: () => {
                                  setEditRow(row);
                                  setFormMode("edit");
                                },
                              }]
                            : []),
                          ...(object === "leads" && can.edit
                            ? [{
                                label: "Add task",
                                icon: "check",
                                onClick: () => {
                                  const title = window.prompt(`Task title for this ${config.singular.toLowerCase()}:`);
                                  if (title) void runBulk("task", { ids: [row.id], title });
                                },
                              }]
                            : []),
                          ...(can.delete
                            ? [{
                                label: "Delete",
                                icon: "trash",
                                destructive: true,
                                onClick: () => void deleteRow(row),
                              }]
                            : []),
                        ]}
                      />
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between" style={{ fontSize: "var(--text-sm)", color: "var(--text-tertiary)" }}>
        <span>
          Page <strong style={{ color: "var(--text-primary)" }}>{meta.page}</strong> of {totalPages}
          {meta.total > 0 ? <span style={{ marginLeft: "8px" }}>({meta.total} total)</span> : null}
        </span>
        <div className="flex gap-2">
          <button
            type="button"
            disabled={meta.page <= 1 || loading}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            className="btn btn-secondary"
            style={{ height: "28px" }}
          >
            ← Prev
          </button>
          <button
            type="button"
            disabled={meta.page >= totalPages || loading}
            onClick={() => setPage((p) => p + 1)}
            className="btn btn-secondary"
            style={{ height: "28px" }}
          >
            Next →
          </button>
        </div>
      </div>

      {formMode !== "closed" ? (
        <RecordForm
          object={object}
          fields={config.fields}
          options={options}
          initial={editRow}
          duplicateCheck={object === "leads"}
          onSaved={() => void fetchRows()}
          onClose={() => setFormMode("closed")}
        />
      ) : null}
    </div>
  );
}
