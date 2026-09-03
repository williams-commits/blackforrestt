"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { RECORD_UI, type ObjectKey } from "@/lib/recordUi";
import { RecordForm, type OptionSource } from "@/components/RecordForm";

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

  const can = useMemo(() => {
    const permissions = me?.permissions ?? [];
    return {
      create: permissions.includes(config.can.create),
      edit: permissions.includes(config.can.edit),
      delete: permissions.includes(config.can.delete),
      assign: config.can.assign ? permissions.includes(config.can.assign) : false,
      bulk: object === "leads",
    };
  }, [me, config, object]);

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
  }, [object, page, search, filters]);

  useEffect(() => {
    void fetch("/api/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((body) => setMe(body?.data ?? null))
      .catch(() => setMe(null));
    void fetchOptions();
  }, [fetchOptions]);

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
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold">{config.title}</h1>
          <p className="text-sm text-stone-500">
            {meta.total} record{meta.total === 1 ? "" : "s"}
          </p>
        </div>
        {can.create ? (
          <button
            type="button"
            onClick={() => {
              setEditRow(null);
              setFormMode("create");
            }}
            className="rounded-md px-3 py-1.5 text-sm font-semibold text-white"
            style={{ background: "var(--brand)" }}
          >
            New {config.singular}
          </button>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-stone-200 bg-white p-3">
        <form
          className="flex flex-1 flex-wrap items-center gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            setPage(1);
            void fetchRows();
          }}
        >
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={config.searchPlaceholder}
            aria-label="Search"
            className="min-w-52 flex-1 rounded-md border border-stone-300 px-3 py-1.5 text-sm"
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
                className="rounded-md border border-stone-300 px-2 py-1.5 text-sm"
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
      </div>

      {selected.size > 0 && can.bulk ? (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-[var(--brand)]/30 bg-[var(--brand)]/5 p-3 text-sm">
          <span className="font-medium">{selected.size} selected</span>
          {can.assign ? (
            <select
              aria-label="Assign to"
              defaultValue=""
              disabled={bulkBusy}
              onChange={(event) => {
                if (event.target.value) void runBulk("assign", { assignedUserId: event.target.value });
              }}
              className="rounded-md border border-stone-300 bg-white px-2 py-1.5"
            >
              <option value="">Assign to…</option>
              {options.users.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          ) : null}
          <select
            aria-label="Change status"
            defaultValue=""
            disabled={bulkBusy}
            onChange={(event) => {
              if (event.target.value) void runBulk("status", { statusId: event.target.value });
            }}
            className="rounded-md border border-stone-300 bg-white px-2 py-1.5"
          >
            <option value="">Change status…</option>
            {options.leadStatuses.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          {can.delete ? (
            <button
              type="button"
              disabled={bulkBusy}
              onClick={() => {
                if (window.confirm(`Delete ${selected.size} record(s)?`)) void runBulk("delete", {});
              }}
              className="rounded-md border border-red-300 px-2 py-1.5 font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
            >
              Delete
            </button>
          ) : null}
          {can.delete && selected.size === 2 ? (
            <button
              type="button"
              onClick={() => {
                setMergePrimary(mergeCandidates[0]?.id ?? "");
                setMergeOpen(true);
              }}
              className="rounded-md border border-stone-300 bg-white px-2 py-1.5 font-medium"
            >
              Merge selected…
            </button>
          ) : null}
          {bulkError ? <span className="text-red-700">{bulkError}</span> : null}
        </div>
      ) : null}

      {mergeOpen && mergeCandidates.length === 2 ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-md space-y-4 rounded-lg border border-stone-200 bg-white p-6 shadow-xl">
            <h2 className="text-base font-semibold">Merge leads</h2>
            <p className="text-sm text-stone-600">
              Choose the surviving record. The other lead is deleted; its timeline, notes, and
              open tasks move to the survivor.
            </p>
            {mergeError ? (
              <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
                {mergeError}
              </p>
            ) : null}
            <div className="space-y-2">
              {mergeCandidates.map((row) => (
                <label key={row.id} className="flex items-center gap-2 rounded-md border border-stone-200 p-3 text-sm">
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
                className="rounded-md border border-stone-300 px-3 py-1.5 text-sm font-medium hover:bg-stone-50"
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

      <div className="overflow-x-auto rounded-lg border border-stone-200 bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-stone-200 bg-stone-50 text-left text-xs uppercase tracking-wide text-stone-500">
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
                  {column.label}
                </th>
              ))}
              <th className="px-3 py-2 text-right font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={config.columns.length + 2} className="px-3 py-8 text-center text-stone-400">
                  Loading…
                </td>
              </tr>
            ) : loadError ? (
              <tr>
                <td colSpan={config.columns.length + 2} className="px-3 py-8 text-center text-red-600">
                  {loadError}
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={config.columns.length + 2} className="px-3 py-8 text-center text-stone-400">
                  No {config.title.toLowerCase()} yet.
                </td>
              </tr>
            ) : (
              rows.map((row) => {
                const isSelected = selected.has(row.id);
                return (
                  <tr key={row.id} className={isSelected ? "bg-[var(--brand)]/5" : ""}>
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
                      const raw = cellValue(row, column.key);
                      const content = (() => {
                        if (!raw) return <span className="text-stone-300">—</span>;
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
                          return (
                            <span className="rounded-full bg-stone-100 px-2 py-0.5 text-xs font-medium">
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
                      {can.edit ? (
                        <button
                          type="button"
                          onClick={() => {
                            setEditRow(row);
                            setFormMode("edit");
                          }}
                          className="mr-2 text-[var(--brand)] hover:underline"
                        >
                          Edit
                        </button>
                      ) : null}
                      {can.delete ? (
                        <button
                          type="button"
                          onClick={() => void deleteRow(row)}
                          className="text-red-600 hover:underline"
                        >
                          Delete
                        </button>
                      ) : null}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between text-sm text-stone-500">
        <span>
          Page {meta.page} of {totalPages}
        </span>
        <div className="flex gap-2">
          <button
            type="button"
            disabled={meta.page <= 1 || loading}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            className="rounded-md border border-stone-300 px-3 py-1.5 disabled:opacity-40"
          >
            Previous
          </button>
          <button
            type="button"
            disabled={meta.page >= totalPages || loading}
            onClick={() => setPage((p) => p + 1)}
            className="rounded-md border border-stone-300 px-3 py-1.5 disabled:opacity-40"
          >
            Next
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
