"use client";

import { Icon } from "@/components/Icon";

/**
 * Pagination bar — prev/next controls with page count and total.
 */
export function PaginationBar({
  page,
  totalPages,
  total,
  loading,
  onPrev,
  onNext,
}: {
  page: number;
  totalPages: number;
  total: number;
  loading: boolean;
  onPrev: () => void;
  onNext: () => void;
}) {
  return (
    <div
      className="flex items-center justify-between"
      style={{ fontSize: "var(--text-sm)", color: "var(--text-tertiary)" }}
    >
      <span>
        Page <strong style={{ color: "var(--text-primary)" }}>{page}</strong> of {totalPages}
        {total > 0 ? <span style={{ marginLeft: "8px" }}>({total} total)</span> : null}
      </span>
      <div className="flex gap-2">
        <button
          type="button"
          disabled={page <= 1 || loading}
          onClick={onPrev}
          className="btn btn-secondary"
          style={{ height: "28px" }}
        >
          ← Prev
        </button>
        <button
          type="button"
          disabled={page >= totalPages || loading}
          onClick={onNext}
          className="btn btn-secondary"
          style={{ height: "28px" }}
        >
          Next →
        </button>
      </div>
    </div>
  );
}

/**
 * Bulk action bar — shown when rows are selected. Provides
 * assign, status change, tag, task creation, and delete actions.
 */
export function BulkActionBar({
  selectedCount,
  isLeads,
  canAssign,
  canDelete,
  canEdit,
  busy,
  users,
  statuses,
  tags,
  onAssign,
  onStatusChange,
  onTag,
  onCreateTask,
  onDelete,
  onClear,
  error,
}: {
  selectedCount: number;
  isLeads: boolean;
  canAssign: boolean;
  canDelete: boolean;
  canEdit: boolean;
  busy: boolean;
  users: Array<{ value: string; label: string }>;
  statuses: Array<{ value: string; label: string }>;
  tags: Array<{ id: string; name: string }>;
  onAssign: (userId: string) => void;
  onStatusChange: (statusId: string) => void;
  onTag: (tagId: string) => void;
  onCreateTask: (title: string) => void;
  onDelete: () => void;
  onClear: () => void;
  error?: string | null;
}) {
  if (selectedCount === 0) return null;

  const selectClass =
    "rounded-md border px-2 py-1.5 text-sm disabled:opacity-50";
  const selectStyle = {
    borderColor: "var(--border-strong)",
    background: "var(--bg-surface)",
  };

  return (
    <div
      className="flex flex-wrap items-center gap-2 rounded-lg border p-3"
      style={{
        borderColor: "var(--brand-200)",
        background: "var(--brand-50)",
        fontSize: "var(--text-sm)",
      }}
    >
      <span className="font-medium" style={{ color: "var(--brand-700)" }}>
        {selectedCount} selected
      </span>

      {isLeads && canAssign ? (
        <select
          aria-label="Assign to"
          defaultValue=""
          disabled={busy}
          onChange={(event) => event.target.value && onAssign(event.target.value)}
          className={selectClass}
          style={selectStyle}
        >
          <option value="">Assign to…</option>
          {users.map((user) => (
            <option key={user.value} value={user.value}>{user.label}</option>
          ))}
        </select>
      ) : null}

      {isLeads ? (
        <select
          aria-label="Change status"
          defaultValue=""
          disabled={busy}
          onChange={(event) => event.target.value && onStatusChange(event.target.value)}
          className={selectClass}
          style={selectStyle}
        >
          <option value="">Change status…</option>
          {statuses.map((status) => (
            <option key={status.value} value={status.value}>{status.label}</option>
          ))}
        </select>
      ) : null}

      {isLeads && canAssign && tags.length > 0 ? (
        <select
          aria-label="Add tag"
          defaultValue=""
          disabled={busy}
          onChange={(event) => event.target.value && onTag(event.target.value)}
          className={selectClass}
          style={selectStyle}
        >
          <option value="">Add tag…</option>
          {tags.map((tag) => (
            <option key={tag.id} value={tag.id}>{tag.name}</option>
          ))}
        </select>
      ) : null}

      {isLeads && canEdit ? (
        <button
          type="button"
          disabled={busy}
          onClick={() => {
            const title = window.prompt(`Create a follow-up task for ${selectedCount} lead(s) — task title:`);
            if (title && title.trim().length >= 2) onCreateTask(title.trim());
          }}
          className="btn btn-secondary"
          style={{ height: "28px", fontSize: "12px" }}
        >
          Create task…
        </button>
      ) : null}

      {canDelete ? (
        <button
          type="button"
          disabled={busy}
          onClick={onDelete}
          className="btn btn-destructive"
          style={{ height: "28px", fontSize: "12px" }}
        >
          Delete
        </button>
      ) : null}

      <button
        type="button"
        onClick={onClear}
        className="btn btn-ghost"
        style={{ height: "28px", fontSize: "12px" }}
      >
        Clear
      </button>

      {error ? <span style={{ color: "var(--error)" }}>{error}</span> : null}
    </div>
  );
}

/**
 * Filter chips — removable pills showing active search/filter values.
 */
export function FilterChips({
  search,
  filters,
  filterConfigs,
  options,
  onClearSearch,
  onClearFilter,
  onClearAll,
}: {
  search: string;
  filters: Record<string, string>;
  filterConfigs: Array<{ name: string; label: string; optionsFrom?: string }>;
  options: Record<string, Array<{ value: string; label: string }>>;
  onClearSearch: () => void;
  onClearFilter: (key: string) => void;
  onClearAll: () => void;
}) {
  const activeFilters = Object.entries(filters).filter(([, value]) => value);
  if (!search && activeFilters.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-2" style={{ marginBottom: "var(--space-2)" }}>
      {search ? (
        <span className="chip">
          Search: {search}
          <span className="chip-close" onClick={onClearSearch}>×</span>
        </span>
      ) : null}
      {activeFilters.map(([key, value]) => {
        const config = filterConfigs.find((f) => f.name === key);
        const label = config?.label ?? key;
        const optionList = config?.optionsFrom ? options[config.optionsFrom] ?? [] : [];
        const optionLabel = optionList.find((o) => o.value === value)?.label ?? value;
        return (
          <span key={key} className="chip">
            {label}: {optionLabel}
            <span className="chip-close" onClick={() => onClearFilter(key)}>×</span>
          </span>
        );
      })}
      <button
        type="button"
        className="btn btn-ghost"
        style={{ height: "24px", fontSize: "11px" }}
        onClick={onClearAll}
      >
        Clear all
      </button>
    </div>
  );
}

/**
 * Density toggle — switches between comfortable and compact row heights.
 */
export function DensityToggle({
  density,
  onToggle,
}: {
  density: "comfortable" | "compact";
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="btn btn-ghost"
      style={{ height: "32px", padding: "0 6px" }}
      title={density === "comfortable" ? "Compact rows" : "Comfortable rows"}
      aria-label={density === "comfortable" ? "Switch to compact density" : "Switch to comfortable density"}
    >
      <Icon name="sliders" size={14} />
    </button>
  );
}
