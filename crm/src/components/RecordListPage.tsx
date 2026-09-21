"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { RECORD_UI, type ObjectKey, type RecordObjectKey } from "@/lib/recordUi";
import { getRecordCapabilities } from "@/lib/recordCapabilities";
import { RecordForm, type OptionSource } from "@/components/RecordForm";
import { ViewTabs, type ViewOption } from "@/components/ViewTabs";
import { WorkspaceHeader } from "@/components/WorkspaceHeader";
import { WorkspaceQuickNav } from "@/components/WorkspaceQuickNav";
import { SmartTips } from "@/components/SmartTips";
import { rememberRecentRecord } from "@/components/RecentRecords";
import { Icon } from "@/components/Icon";
import { EmptyState } from "@/components/ui";
import { RowActions } from "@/components/RowActions";
import { InlineEdit } from "@/components/InlineEdit";
import { useTableSession, writeTableSession } from "@/components/useTableSession";
import { useConfirmDialog, usePromptDialog } from "@/components/Dialogs";
import { Table, THead, TBody, TR, TH, TD } from "@/components/table";

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
  accountStatuses: [],
  potentialStatuses: [],
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
    accountStatuses: [],
    potentialStatuses: [],
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

function nestedRecordId(row: Record<string, unknown>, key: string): string {
  const relationPath = key.split(".").slice(0, -1);
  if (relationPath.length === 0) return typeof row.id === "string" ? row.id : "";
  let current: unknown = row;
  for (const segment of relationPath) {
    if (current === null || current === undefined || typeof current !== "object") return "";
    current = (current as Record<string, unknown>)[segment];
  }
  if (current === null || current === undefined || typeof current !== "object") return "";
  const id = (current as Record<string, unknown>).id;
  return typeof id === "string" ? id : "";
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
  const [order, setOrder] = useState<"asc" | "desc">("desc");
  const [pageSize, setPageSize] = useState(25);
  const [hydrated, setHydrated] = useState(false);
  const [mounted, setMounted] = useState(false);
  const { confirm, dialog: confirmDialog } = useConfirmDialog();
  const { prompt, dialog: promptDialog } = usePromptDialog();

  useEffect(() => {
    setMounted(true);
  }, []);

  // The four RECORD objects share the record-capability resolver (the same
  // one the detail pages use). Campaigns and tasks run the same table
  // experience with their own permission mapping and without the
  // record-only surfaces (bulk, saved views, export, merge, inline status).
  const isRecordObject = object === "leads" || object === "contacts" || object === "accounts" || object === "customers";

  const can = useMemo(() => {
    const permissions = me?.permissions ?? [];
    if (object === "campaigns") {
      const create = permissions.includes("CAMPAIGNS_CREATE");
      const edit = permissions.includes("CAMPAIGNS_EDIT");
      const remove = permissions.includes("CAMPAIGNS_DELETE");
      return { create, edit, delete: remove, assign: false, classify: false, potential: false, tags: false, task: false, export: false, bulk: edit || remove };
    }
    if (object === "tasks") {
      const create = permissions.includes("TASKS_CREATE");
      const edit = permissions.includes("TASKS_EDIT");
      return { create, edit, delete: false, assign: false, classify: false, potential: false, tags: false, task: false, export: false, bulk: edit };
    }
    const subjectType: Record<RecordObjectKey, "LEAD" | "CONTACT" | "ACCOUNT" | "CUSTOMER"> = {
      leads: "LEAD",
      contacts: "CONTACT",
      accounts: "ACCOUNT",
      customers: "CUSTOMER",
    };
    const caps = getRecordCapabilities(subjectType[object as RecordObjectKey], permissions);
    return {
      create: caps.canCreate,
      edit: caps.canEdit,
      delete: caps.canDelete,
      assign: caps.canAssign,
      classify: caps.canChangeStatus,
      potential: caps.canChangePotentialStatus,
      tags: caps.canManageTags,
      task: caps.canCreateTask,
      export: caps.canExport,
      bulk: caps.canEdit || caps.canDelete || caps.canAssign || caps.canChangeStatus || caps.canManageTags || caps.canCreateTask,
    };
  }, [me, object]);

  const bulkStatusOptions =
    object === "leads"
      ? options.leadStatuses
      : object === "accounts"
        ? options.accountStatuses
      : object === "contacts"
        ? options.contactStatuses
        : object === "customers"
          ? options.customerStatuses
          : [];

  const visibleColumnCount = config.columns.filter((column) => !hiddenColumns.includes(column.key)).length;
  const hasRowActions = can.edit || can.delete || can.task;
  const tableColumnCount = visibleColumnCount + (can.bulk ? 1 : 0) + (hasRowActions ? 1 : 0);

  const presetViews: ViewOption[] = [
    { key: "all", label: `All ${config.title}` },
    ...(isRecordObject ? [{ key: "mine", label: `My ${config.title}` }] : []),
    { key: "recent", label: "Recently Added" },
    ...(object === "leads" ? [{ key: "unassigned", label: "Unassigned" }] : []),
    ...views.map((v) => ({ key: `saved:${v.id}`, label: v.name, isSaved: true })),
  ];

  /** Set the search AND flush the debounce — for view switches, chips, and
   * Enter, where waiting 300ms for a value the user already committed feels
   * sluggish. Live typing keeps the debounced path. */
  function applySearch(value: string) {
    setSearch(value);
    setDebouncedSearch(value);
  }

  function handleViewChange(key: string) {
    setActiveView(key);
    setPage(1);
    setSelected(new Set());
    if (key === "all") {
      setFilters({});
      applySearch("");
      setSort("");
    } else if (key === "mine") {
      setFilters(object === "leads" ? { assignment: "mine" } : { mine: "1" });
      applySearch("");
    } else if (key === "recent") {
      setFilters({});
      applySearch("");
      setSort("createdAt");
      setOrder("desc");
    } else if (key === "unassigned") {
      setFilters(object === "leads" ? { assignment: "unassigned" } : {});
      applySearch("");
    } else if (key.startsWith("saved:")) {
      const view = views.find((v) => `saved:${v.id}` === key);
      if (view) {
        applySearch(view.config.q ?? "");
        setFilters(view.config.filters ?? {});
      }
    }
  }

  const fetchOptions = useCallback(async () => {
    try {
      const subjectTypeMap: Record<RecordObjectKey, string> = {
        leads: "LEAD",
        contacts: "CONTACT",
        accounts: "ACCOUNT",
        customers: "CUSTOMER",
      };
      const subjectType = isRecordObject ? subjectTypeMap[object as RecordObjectKey] : undefined;
      const [me, statuses, users] = await Promise.all([
        fetch("/api/me").then((r) => (r.ok ? r.json() : { data: { permissions: [] } })),
        subjectType
          ? fetch(`/api/record-statuses?subjectType=${subjectType}`).then((r) => (r.ok ? r.json() : { data: [] }))
          : Promise.resolve({ data: [] }),
        fetch("/api/users").then((r) => (r.ok ? r.json() : { data: [] })),
      ]);
      const potentialStatuses = object === "leads"
        ? await fetch("/api/potential-statuses?subjectType=LEAD").then((r) => (r.ok ? r.json() : { data: [] }))
        : { data: [] as Array<{ id: string; name: string }> };
      const next: OptionSource = freshOptions();
      for (const status of potentialStatuses.data as Array<{ id: string; name: string }>) {
        next.potentialStatuses.push({ value: status.id, label: status.name });
      }
      for (const status of statuses.data as Array<{ id: string; name: string; appliesTo: string }>) {
        const key =
          status.appliesTo === "LEAD"
            ? "leadStatuses"
            : status.appliesTo === "ACCOUNT"
              ? "accountStatuses"
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
      if ((object === "leads" || object === "contacts" || object === "customers") && (me.data?.permissions as string[] | undefined)?.includes("CAMPAIGNS_VIEW")) {
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
}, [object, isRecordObject]);

  // Debounce the search box (300ms, mirrors MailboxPage) — typing a
  // 10-char query fired one API request per keystroke otherwise.
  const [debouncedSearch, setDebouncedSearch] = useState(search);
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  // ---- subject deep-links (?subjectType=…&subjectId=…&label=…, ?edit=…, ?mine=1) ----
  // Read once from the URL (not useSearchParams — this component renders on
  // dynamic pages without a Suspense boundary). A deep-linked context wins
  // over the restored session.
  const [subjectFilter, setSubjectFilter] = useState<{ type: string; id: string; label: string } | null>(null);
  const pendingEditIdRef = useRef<string | null>(null);
  const deepLinkedRef = useRef(false);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const type = params.get("subjectType");
    const id = params.get("subjectId");
    if (type && id) {
      deepLinkedRef.current = true;
      setSubjectFilter({ type, id, label: params.get("label") ?? "" });
    }
    if (params.get("edit")) {
      deepLinkedRef.current = true;
      pendingEditIdRef.current = params.get("edit");
    }
    if (params.get("mine") === "1") {
      setFilters((previous) => (object === "tasks" ? { ...previous, mine: "1" } : previous));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- table session (refresh-proof page/search/sort/filters/selection) ----
  // Restore once after mount (post-hydration: these pages are
  // server-rendered, so state can't be initialized from sessionStorage
  // without mismatching the server markup). `hydrated` gates the first
  // fetch and all writes so the snapshot is applied before anything else.
  const { session, ready } = useTableSession(`records:${object}`);
  useEffect(() => {
    if (!ready) return;
    if (session && !deepLinkedRef.current) {
      if (typeof session.search === "string") {
        setSearch(session.search);
        setDebouncedSearch(session.search);
      }
      if (session.sort !== undefined) setSort(session.sort);
      if (session.order) setOrder(session.order);
      if (session.page !== undefined) setPage(session.page);
      if (session.pageSize !== undefined) setPageSize(session.pageSize);
      if (session.filters) setFilters(session.filters);
      if (session.hiddenColumns) {
        const known = session.hiddenColumns.filter((key) =>
          config.columns.some((column) => column.key === key),
        );
        // Never restore a snapshot that would hide every column.
        setHiddenColumns(known.length < config.columns.length ? known : []);
      }
      if (session.density) setDensity(session.density);
      if (session.activeView) setActiveView(session.activeView);
      if (session.selected) setSelected(new Set(session.selected));
    }
    setHydrated(true);
  }, [ready, session, config]);

  useEffect(() => {
    if (!hydrated) return;
    writeTableSession(`records:${object}`, {
      page,
      pageSize,
      search,
      sort,
      order,
      filters,
      hiddenColumns,
      density,
      activeView,
      selected: [...selected],
    });
  }, [hydrated, object, page, pageSize, search, sort, order, filters, hiddenColumns, density, activeView, selected]);

  const fetchRows = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
      if (debouncedSearch) params.set("q", debouncedSearch);
      if (sort) {
        params.set("sort", sort);
        params.set("order", order);
      }
      for (const [key, value] of Object.entries(filters)) {
        if (value) params.set(key, value);
      }
      if (subjectFilter) {
        params.set("subjectType", subjectFilter.type);
        params.set("subjectId", subjectFilter.id);
      }
      const response = await fetch(`/api/${object}?${params.toString()}`);
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? `Request failed (${response.status})`);
      }
      const body = (await response.json()) as ListResponse;
      setRows(body.data);
      setMeta(body.meta);
      // Selection deliberately survives fetches (it's a Set of ids, valid
      // across pages) — bulk actions clear it once they complete.
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Unable to load records.");
    } finally {
      setLoading(false);
    }
  }, [object, page, pageSize, debouncedSearch, filters, sort, order, subjectFilter]);

  useEffect(() => {
    void fetch("/api/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((body) => setMe(body?.data ?? null))
      .catch(() => setMe(null));
    void fetchOptions();
    if (isRecordObject) {
      void fetch(`/api/views?objectType=${object.toUpperCase().slice(0, -1)}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((body) => setViews(body?.data ?? []))
        .catch(() => setViews([]));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchOptions, object]);

  // Tags are fetched only for users who may act on them — the tag catalog is
  // invisible (and unretrieved) when MANAGE_TAGS is off for this object.
  useEffect(() => {
    if (!can.tags) {
      setAllTags([]);
      return;
    }
    void fetch("/api/tags")
      .then((r) => (r.ok ? r.json() : null))
      .then((body) => setAllTags(body?.data ?? []))
      .catch(() => setAllTags([]));
  }, [can.tags]);

  useEffect(() => {
    if (!hydrated) return;
    void fetchRows();
  }, [fetchRows, hydrated]);

  useEffect(() => {
    const refresh = () => void fetchRows();
    window.addEventListener("crm:realtime-refresh", refresh);
    return () => window.removeEventListener("crm:realtime-refresh", refresh);
  }, [fetchRows]);

  // One-shot: a ?edit=<id> deep link opens the edit drawer once its row loads.
  useEffect(() => {
    if (!pendingEditIdRef.current || formMode !== "closed" || rows.length === 0) return;
    const target = rows.find((row) => row.id === pendingEditIdRef.current);
    pendingEditIdRef.current = null;
    if (target) {
      setEditRow(target);
      setFormMode("edit");
    }
  }, [rows, formMode]);

  const totalPages = Math.max(1, Math.ceil(meta.total / meta.pageSize));
  const allSelected = rows.length > 0 && rows.every((row) => selected.has(row.id));

  // A restored page can outrun the result set (data changed since the last
  // visit) — clamp to the last real page instead of showing an empty one.
  useEffect(() => {
    if (!hydrated || loading) return;
    if (page > totalPages) setPage(totalPages);
  }, [hydrated, loading, meta, page, totalPages]);

  const selectAllRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const element = selectAllRef.current;
    if (element) {
      element.indeterminate = !allSelected && rows.some((row) => selected.has(row.id));
    }
  }, [allSelected, rows, selected]);

  function toggleRow(id: string) {
    setSelected((previous) => {
      const next = new Set(previous);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  /** Header checkbox toggles THIS page's rows on/off the persistent
   * selection — rows picked on other pages stay selected. */
  function toggleAllOnPage() {
    setSelected((previous) => {
      const next = new Set(previous);
      for (const row of rows) {
        if (allSelected) next.delete(row.id);
        else next.add(row.id);
      }
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
      setSelected(new Set());
      await fetchRows();
    } catch (error) {
      setBulkError(error instanceof Error ? error.message : "Bulk action failed.");
    } finally {
      setBulkBusy(false);
    }
  }

  async function deleteRow(row: Record<string, unknown>) {
    const ok = await confirm({
      title: `Delete ${config.singular.toLowerCase()}?`,
      message: `This ${config.singular.toLowerCase()} will be soft-deleted. This can be undone only by an administrator.`,
      confirmLabel: "Delete",
      destructive: true,
    });
    if (!ok) return;
    const response = await fetch(`/api/${object}/${row.id}`, { method: "DELETE" }).catch(() => null);
    if (!response?.ok) {
      setLoadError(
        response?.status === 403 ? `You do not have permission to delete this ${config.singular.toLowerCase()}.`
          : response?.status === 409 ? `This ${config.singular.toLowerCase()} cannot be deleted (it has related history).`
          : `Deleting this ${config.singular.toLowerCase()} failed — try again.`,
      );
      return;
    }
    void fetchRows();
  }

  const mergeCandidates = rows.filter((row) => selected.has(row.id));
  // N-way merge is wired for every merge-capable module (leads via the lead
  // flow; contacts/accounts/customers via the generic records merge). Pick
  // 2..10 rows, choose the survivor, everything else folds in.
  const MERGEABLE = new Set(["leads", "contacts", "accounts", "customers"]);
  const mergeableObject = MERGEABLE.has(object);
  const mergeEndpoint = object === "leads" ? "/api/leads/merge" : "/api/records/merge";
  const mergeObjectType = object === "leads" ? null : object.slice(0, -1).toUpperCase();

  async function runMerge() {
    if (!mergePrimary) return;
    setMergeBusy(true);
    setMergeError(null);
    try {
      const mergedIds = mergeCandidates.filter((row) => row.id !== mergePrimary).map((row) => row.id);
      if (mergedIds.length === 0) return;
      const response = await fetch(mergeEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          mergeObjectType
            ? { objectType: mergeObjectType, primaryId: mergePrimary, mergedIds }
            : { primaryId: mergePrimary, mergedIds },
        ),
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? "Merge failed.");
      }
      setMergeOpen(false);
      setSelected(new Set());
      await fetchRows();
    } catch (error) {
      setMergeError(error instanceof Error ? error.message : "Merge failed.");
    } finally {
      setMergeBusy(false);
    }
  }

  return (
    <div className="space-y-4" data-module={object}>
      <WorkspaceHeader
        eyebrow="Record workspace"
        title={config.title}
        subtitle={`${meta.total} record${meta.total === 1 ? "" : "s"} in your current view.`}
        metrics={[
          { label: "Records", value: meta.total, tone: "brand" },
          { label: "View", value: presetViews.find((view) => view.key === activeView)?.label ?? "Custom", tone: "info" },
          { label: "Columns", value: `${visibleColumnCount}/${config.columns.length}`, tone: "success" },
        ]}
        actions={<>
          {can.create ? (
            <button type="button" className="btn btn-primary" onClick={() => { setEditRow(null); setFormMode("create"); }}>
              <Icon name="plus" size={12} />
              New {config.singular}
            </button>
          ) : null}
          {can.export ? (
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => {
                window.location.href = `/api/export?object=${object}${search ? `&q=${encodeURIComponent(search)}` : ""}${filters.statusId ? `&statusId=${filters.statusId}` : ""}`;
              }}
            >
              Export
            </button>
          ) : null}
        </>}
      />
      <WorkspaceQuickNav />
      <SmartTips context="records" />
      {mounted ? (
        <ViewTabs
          title={config.title}
          views={presetViews}
          activeView={activeView}
          onViewChange={handleViewChange}
          totalCount={meta.total}
          showHeader={false}
        />
      ) : (
        <div className="h-9 border-b border-(--border-default)" />
      )}

      <div className="flex flex-wrap items-center gap-2">
        <form
          className="flex flex-1 items-center gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            // Enter commits the query immediately (no 300ms wait) and
            // resets to page 1; the fetch effect picks up the change.
            setDebouncedSearch(search);
            setPage(1);
          }}
        >
          <button
            type="button"
            onClick={() => setDensity(density === "comfortable" ? "compact" : "comfortable")}
            className="icon-button"
            title={density === "comfortable" ? "Compact rows" : "Comfortable rows"}
            aria-label={density === "comfortable" ? "Compact rows" : "Comfortable rows"}
          >
            <Icon name={density === "comfortable" ? "sliders" : "grid"} size={14} />
          </button>
          <input
            type="search"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              // New query → the old page number is meaningless; drop to
              // page 1 immediately (the fetch still waits for the debounce).
              setPage(1);
            }}
            placeholder={config.searchPlaceholder}
            aria-label="Search"
            className="input input-sm"
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
                className="input input-sm" style={{ width: "auto", display: "inline-block" }}
              >
                <option value="">{filter.label}: {filter.emptyLabel ?? "all"}</option>
                {filterOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            );
          })}
        </form>
        <div className="flex items-center gap-2 border-l border-(--border-default) pl-2">
          {isRecordObject && views.length > 0 ? (
            <select
              aria-label="Saved views"
              defaultValue=""
              onChange={(event) => {
                const view = views.find((entry) => entry.id === event.target.value);
                if (!view) return;
                applySearch(view.config.q ?? "");
                setFilters(view.config.filters ?? {});
                setPage(1);
              }}
              className="input input-sm" style={{ width: "auto", display: "inline-block" }}
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
          <details className="group relative hidden sm:block">
            <summary className="flex h-8 cursor-pointer list-none items-center gap-2 rounded-md border border-(--border-strong) bg-(--bg-surface) px-2 text-xs font-medium hover:bg-(--bg-hover)">
              Columns
              <span className="text-(--text-tertiary)">{visibleColumnCount}/{config.columns.length}</span>
            </summary>
            <div
              className="absolute right-0 z-40 mt-2 w-56 rounded-lg border border-(--border-default) bg-(--bg-surface) p-2 shadow-lg"
              role="menu"
            >
              <p className="px-2 pb-2 text-xs font-medium text-(--text-secondary)">Visible columns</p>
              <div className="max-h-72 space-y-1 overflow-auto">
                {config.columns.map((column) => {
                  const checked = !hiddenColumns.includes(column.key);
                  return (
                    <label
                      key={column.key}
                      className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-(--bg-hover)"
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        disabled={checked && visibleColumnCount <= 1}
                        onChange={(event) => {
                          setHiddenColumns((prev) =>
                            event.target.checked
                              ? prev.filter((key) => key !== column.key)
                              : [...prev, column.key],
                          );
                        }}
                      />
                      <span>{column.label}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          </details>
          {isRecordObject ? (
            <>
              <input
                aria-label="View name"
                placeholder="Name this view"
                value={viewName}
                onChange={(event) => setViewName(event.target.value)}
                className="w-32 rounded-md border border-(--border-strong) px-2 py-1.5 text-sm"
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
                className="rounded-md border border-(--border-strong) px-2 py-1.5 text-sm font-medium hover:bg-(--bg-hover) disabled:opacity-50"
              >
                Save view
              </button>
            </>
          ) : null}
        </div>
      </div>

      {selected.size > 0 && can.bulk ? (
        <div className="flex flex-wrap items-center gap-2 rounded-lg p-3" style={{ background: "var(--accent-soft)", fontSize: "var(--text-sm)" }}>
          <span className="font-medium">{selected.size} selected</span>
          {object === "tasks" && can.edit ? (
            <>
              <button type="button" disabled={bulkBusy} onClick={() => void runBulk("complete", {})} className="btn btn-secondary btn-sm">
                <Icon name="check" size={13} /> Complete
              </button>
              <button type="button" disabled={bulkBusy} onClick={() => void runBulk("cancel", {})} className="btn btn-secondary btn-sm">
                <Icon name="close" size={13} /> Cancel
              </button>
            </>
          ) : null}
          {object === "campaigns" && can.edit ? (
            <select
              aria-label="Change status"
              defaultValue=""
              disabled={bulkBusy}
              onChange={(event) => {
                if (event.target.value) void runBulk("status", { status: event.target.value });
              }}
              className="input input-sm"
              style={{ width: "auto" }}
            >
              <option value="">Change status…</option>
              <option value="DRAFT">Draft</option>
              <option value="ACTIVE">Active</option>
              <option value="PAUSED">Paused</option>
              <option value="COMPLETED">Completed</option>
            </select>
          ) : null}
          {can.assign ? (
            <select
              aria-label="Assign to"
              defaultValue=""
              disabled={bulkBusy}
              onChange={(event) => {
                if (event.target.value) void runBulk("assign", { assignedUserId: event.target.value });
              }}
              className="rounded-md border border-(--border-strong) bg-(--bg-surface) px-2 py-1.5"
            >
              <option value="">Assign to…</option>
              {options.users.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          ) : null}
          {can.classify && bulkStatusOptions.length > 0 ? (
            <select
              aria-label="Change status"
              defaultValue=""
              disabled={bulkBusy}
              onChange={(event) => {
                if (event.target.value) void runBulk("status", { statusId: event.target.value });
              }}
              className="rounded-md border border-(--border-strong) bg-(--bg-surface) px-2 py-1.5"
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
              onClick={async () => {
                const ok = await confirm({
                  title: `Delete ${selected.size} record(s)?`,
                  message: `The selected ${config.singular.toLowerCase()}(s) will be soft-deleted. This can be undone only by an administrator.`,
                  confirmLabel: "Delete",
                  destructive: true,
                });
                if (ok) void runBulk("delete", {});
              }}
              className="btn btn-destructive btn-sm"
            >
              Delete
            </button>
          ) : null}
          {can.tags && allTags.length > 0 ? (
            <select
              aria-label="Bulk tag"
              defaultValue=""
              disabled={bulkBusy}
              onChange={(event) => {
                if (event.target.value) void runBulk("tag", { tagId: event.target.value });
              }}
              className="rounded-md border border-(--border-strong) bg-(--bg-surface) px-2 py-1.5"
            >
              <option value="">Add tag…</option>
              {allTags.map((tag) => (
                <option key={tag.id} value={tag.id}>
                  {tag.name}
                </option>
              ))}
            </select>
          ) : null}
          {can.task ? (
            <button
              type="button"
              disabled={bulkBusy}
              onClick={async () => {
                const title = await prompt({
                  title: "Create follow-up tasks",
                  message: `A task will be created for each of the ${selected.size} selected ${config.singular.toLowerCase()}(s).`,
                  placeholder: "Task title",
                  confirmLabel: "Create tasks",
                });
                if (title && title.trim().length >= 2) void runBulk("task", { title: title.trim() });
              }}
              className="rounded-md border border-(--border-strong) bg-(--bg-surface) px-2 py-1.5 font-medium"
            >
              Create task…
            </button>
          ) : null}
          {mergeableObject && can.delete && selected.size >= 2 && selected.size <= 10 ? (
            <button
              type="button"
              onClick={() => {
                setMergePrimary(mergeCandidates[0]?.id ?? "");
                setMergeOpen(true);
              }}
              className="rounded-md border border-(--border-strong) bg-(--bg-surface) px-2 py-1.5 font-medium"
            >
              Merge selected…
            </button>
          ) : null}
          <button
            type="button"
            disabled={bulkBusy}
            onClick={() => setSelected(new Set())}
            className="btn btn-secondary btn-sm"
          >
            Clear selection
          </button>
          {bulkError ? <span className="text-(--error)">{bulkError}</span> : null}
        </div>
      ) : null}

      {mergeOpen && mergeCandidates.length >= 2 ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-md space-y-4 rounded-lg border border-(--border-default) bg-(--bg-surface) text-(--text-primary) p-6 shadow-xl">
            <h2 className="text-base font-semibold">Merge {config.title.toLowerCase()}</h2>
            <p className="text-sm text-(--text-secondary)">
              Choose the surviving record. The other {mergeCandidates.length - 1}{" "}
              {mergeCandidates.length - 1 === 1 ? "record is" : "records are"} deleted; their timelines, notes,
              emails, and open tasks move to the survivor.
            </p>
            {mergeError ? (
              <p role="alert" className="rounded-md bg-(--error-bg) px-3 py-2 text-sm text-(--error)">
                {mergeError}
              </p>
            ) : null}
            <div className="space-y-2">
              {mergeCandidates.map((row) => (
                <label key={row.id} className="flex items-center gap-2 rounded-md border border-(--border-default) p-3 text-sm">
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
              >
                {mergeBusy ? "Merging…" : "Merge"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      
      {subjectFilter ? (
        <div className="flex flex-wrap items-center gap-2" style={{ marginBottom: "var(--space-2)" }}>
          <span className="chip">
            Linked to {subjectFilter.label || subjectFilter.type.toLowerCase()} …{subjectFilter.id.slice(-6)}
            <span className="chip-close" onClick={() => { setSubjectFilter(null); setPage(1); }}>×</span>
          </span>
        </div>
      ) : null}
      {Object.entries(filters).filter(([, value]) => value).length > 0 || search ? (
        <div className="flex flex-wrap items-center gap-2" style={{ marginBottom: "var(--space-2)" }}>
          {search ? (
            <span className="chip">
              Search: {search}
              <span className="chip-close" onClick={() => { applySearch(""); setPage(1); }}>×</span>
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
            onClick={() => { applySearch(""); setFilters({}); setPage(1); }}
          >
            Clear all
          </button>
        </div>
      ) : null}

      <div className="card table-responsive overflow-x-auto p-2 lg:p-0">
        <Table compact={density === "compact"}>
          <THead>
            <TR className="border-b border-(--border-default) bg-(--bg-hover) text-left text-xs uppercase tracking-wide text-(--text-secondary)">
              {can.bulk ? (
                <TH className="w-8 px-3 py-2">
                  <input
                    ref={selectAllRef}
                    type="checkbox"
                    aria-label="Select all on page"
                    checked={allSelected}
                    onChange={toggleAllOnPage}
                  />
                </TH>
              ) : null}
              {config.columns.filter((column) => !hiddenColumns.includes(column.key)).map((column) => {
                const sortKey = column.key === "firstName lastName" ? "name" : column.key.split(".")[0];
                const isSorted = sort === sortKey;
                return (
                  <TH key={column.key} className="px-3 py-2 font-medium">
                    {column.sortable ? (
                      <button
                        type="button"
                        onClick={() => {
                          // Cycle: default direction → opposite → off. Dates
                          // and numbers start descending; text starts ascending.
                          const nextDefault = column.type === "date" || column.type === "datetime" || column.type === "number"
                            ? "desc" as const
                            : "asc" as const;
                          if (!isSorted) {
                            setSort(sortKey);
                            setOrder(nextDefault);
                          } else if (order === nextDefault) {
                            setOrder(nextDefault === "asc" ? "desc" : "asc");
                          } else {
                            setSort("");
                            setOrder("desc");
                          }
                          setPage(1);
                        }}
                        className="text-left hover:underline"
                        aria-label={`Sort by ${column.label}`}
                      >
                        {column.label}
                        {isSorted ? (order === "asc" ? " ▴" : " ▾") : ""}
                      </button>
                    ) : (
                      column.label
                    )}
                  </TH>
                );
              })}
              {hasRowActions ? (
                <TH className="px-3 py-2 text-right font-medium">Actions</TH>
              ) : null}
            </TR>
          </THead>
          <TBody>
            {loading ? (
              [...Array(6)].map((_, index) => (
                <TR key={`skeleton-${index}`}>
                  <TD colSpan={tableColumnCount} style={{ padding: "10px 12px" }}>
                    <div className="skeleton" style={{ height: "16px", width: `${70 - index * 8}%` }} />
                  </TD>
                </TR>
              ))
            ) : loadError ? (
              <TR>
                <TD colSpan={tableColumnCount}>
                  <div className="empty-state" style={{ padding: "var(--space-8)" }}>
                    <p className="empty-state-title" style={{ color: "var(--error)" }}>{loadError}</p>
                    <button type="button" onClick={() => void fetchRows()} className="btn btn-secondary" style={{ marginTop: "var(--space-3)" }}>
                      Retry
                    </button>
                  </div>
                </TD>
              </TR>
            ) : rows.length === 0 ? (
              <TR>
                <TD colSpan={tableColumnCount}>
                  <EmptyState
                    illustration={object}
                    title={`No ${config.title.toLowerCase()} found`}
                    description={
                      search || Object.values(filters).some(Boolean)
                        ? "Try adjusting your search or filters."
                        : `Get started by creating your first ${config.singular.toLowerCase()}.`
                    }
                    action={can.create && !search && !Object.values(filters).some(Boolean) ? (
                      <button type="button" className="btn btn-primary" onClick={() => { setEditRow(null); setFormMode("create"); }}>
                        <Icon name="plus" size={12} />
                        New {config.singular}
                      </button>
                    ) : undefined}
                  />
                </TD>
              </TR>
            ) : (
              rows.map((row) => {
                const isSelected = selected.has(row.id);
                return (
                  <TR
                  key={row.id}
                  className={isSelected ? "selected" : ""}
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
                      <TD className="px-3 py-2">
                        <input
                          type="checkbox"
                          aria-label="Select row"
                          checked={isSelected}
                          onChange={() => toggleRow(row.id)}
                        />
                      </TD>
                    ) : null}
                    {config.columns.map((column, index) => {
                      if (hiddenColumns.includes(column.key)) return null;
                      const raw = cellValue(row, column.key);
                      const content = (() => {
                        if (!raw) return <span className="text-(--text-tertiary)">—</span>;
                        if (column.type === "record" && index === 0) {
                          return (
                            <Link
                              href={`/${config.object}/${row.id}`}
                              onClick={() => rememberRecentRecord({ href: `/${config.object}/${row.id}`, label: raw, module: config.title })}
                              className="font-medium text-(--brand) hover:underline"
                            >
                              {raw}
                            </Link>
                          );
                        }
                        if (column.type === "record") {
                          const linkedId = nestedRecordId(row, column.key);
                          return linkedId ? (
                            <Link href={`/${column.object}/${linkedId}`} className="hover:underline">
                              {raw}
                            </Link>
                          ) : (
                            raw
                          );
                        }
                        if (column.type === "badge") {
                          // Inline status editing for every core object (same
                          // CHANGE_STATUS capability the bulk bar uses), and a
                          // separate potential-status editor for leads. Exact
                          // key match: a substring test also caught
                          // "potentialStatus.name" and wired it to the STATUS
                          // editor — clicking Potential changed Status.
                          if (column.key === "status.name" && can.classify) {
                            const currentStatusId = row.statusId as string;
                            return (
                              <InlineEdit
                                value={currentStatusId ?? ""}
                                options={bulkStatusOptions}
                                onSave={async (newStatusId) => {
                                  const response = await fetch(`/api/${object}/${row.id}`, {
                                    method: "PATCH",
                                    headers: { "Content-Type": "application/json" },
                                    body: JSON.stringify({ statusId: newStatusId }),
                                  });
                                  if (!response.ok) throw new Error(`Status change failed (${response.status}).`);
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
                          if (column.key === "potentialStatus.name" && can.potential) {
                            const currentStatusId = row.potentialStatusId as string;
                            return (
                              <InlineEdit
                                value={currentStatusId ?? ""}
                                options={options.potentialStatuses}
                                onSave={async (newStatusId) => {
                                  await fetch(`/api/leads/${row.id}`, {
                                    method: "PATCH",
                                    headers: { "Content-Type": "application/json" },
                                    body: JSON.stringify({ potentialStatusId: newStatusId }),
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
                        <TD key={column.key} className="px-3 py-2 whitespace-nowrap">
                          {content}
                        </TD>
                      );
                    })}
                    {hasRowActions ? (
                      <TD className="px-3 py-2 text-right whitespace-nowrap">
                        <RowActions
                          actions={[
                            ...(object === "tasks" && can.edit
                              ? (() => {
                                  const status = String(row.status ?? "OPEN");
                                  const setTaskStatus = async (next: string) => {
                                    const response = await fetch(`/api/tasks/${row.id}`, {
                                      method: "PATCH",
                                      headers: { "Content-Type": "application/json" },
                                      body: JSON.stringify({ status: next }),
                                    });
                                    if (!response.ok) setLoadError("Could not update the task.");
                                    void fetchRows();
                                  };
                                  return status === "COMPLETED" || status === "CANCELLED"
                                    ? [{ label: "Reopen", icon: "refresh", onClick: () => void setTaskStatus("OPEN") }]
                                    : [
                                        { label: "Complete", icon: "check", onClick: () => void setTaskStatus("COMPLETED") },
                                        { label: "Cancel", icon: "close", onClick: () => void setTaskStatus("CANCELLED") },
                                      ];
                                })()
                              : []),
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
                            ...(can.task
                              ? [{
                                  label: "Add task",
                                  icon: "check",
                                  onClick: async () => {
                                    const title = await prompt({
                                      title: "Add task",
                                      message: `Create a task for this ${config.singular.toLowerCase()}.`,
                                      placeholder: "Task title",
                                      confirmLabel: "Add task",
                                    });
                                    if (title && title.trim().length >= 2) {
                                      void runBulk("task", { ids: [row.id], title: title.trim() });
                                    }
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
                      </TD>
                    ) : null}
                  </TR>
                );
              })
            )}
          </TBody>
        </Table>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2" style={{ fontSize: "var(--text-sm)", color: "var(--text-tertiary)" }}>
        <span>
          {meta.total > 0 ? (
            <>
              Showing{" "}
              <strong style={{ color: "var(--text-primary)" }}>
                {(meta.page - 1) * meta.pageSize + 1}–{Math.min(meta.page * meta.pageSize, meta.total)}
              </strong>{" "}
              of {meta.total}
              <span style={{ marginLeft: "8px" }}>
                · Page <strong style={{ color: "var(--text-primary)" }}>{meta.page}</strong> of {totalPages}
              </span>
            </>
          ) : (
            <>
              Page <strong style={{ color: "var(--text-primary)" }}>{meta.page}</strong> of {totalPages}
            </>
          )}
        </span>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-1">
            Rows
            <select
              aria-label="Rows per page"
              value={pageSize}
              onChange={(event) => {
                setPageSize(Number(event.target.value));
                setPage(1);
              }}
              className="btn btn-secondary btn-sm"
              style={{ width: "auto" }}
            >
              {[10, 25, 50, 100].map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            disabled={meta.page <= 1 || loading}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            className="btn btn-secondary btn-sm"
          >
            ← Prev
          </button>
          <button
            type="button"
            disabled={meta.page >= totalPages || loading}
            onClick={() => setPage((p) => p + 1)}
            className="btn btn-secondary btn-sm"
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

      {confirmDialog}
      {promptDialog}
    </div>
  );
}
