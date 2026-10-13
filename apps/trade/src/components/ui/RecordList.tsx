"use client";

import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import type { ReactNode } from "react";
import { NativeSelect } from "@/components/ui/NativeSelect";

export type SortDirection = "asc" | "desc";

/**
 * Table-free record list kit for the account portal. Rows are CSS Grid
 * records (aligned columns on desktop, stacked cards below md) — semantic
 * lists, not HTML tables and not a role="table" imitation. Toolbars, filters,
 * pagination and CSV export compose exactly like the previous table shells.
 */

/** Card shell: toolbar band above the list, optional footer (pagination). */
export function RecordShell({
  toolbar,
  footer,
  children,
  ariaLabel,
}: {
  toolbar?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
  ariaLabel: string;
}) {
  return (
    <section aria-label={ariaLabel} className="overflow-hidden rounded-xl border border-border bg-canvas shadow-sm">
      {toolbar && (
        <div className="flex min-h-10 flex-wrap items-center gap-2 border-b border-border bg-panel-2 px-3 py-2">
          {toolbar}
        </div>
      )}
      {children}
      {footer}
    </section>
  );
}

/** Sortable column header for the desktop grid row — same toggle semantics
 *  and aria-sort contract as the previous table headers. */
export function RecordSortButton({
  label,
  sortKey,
  sort,
  onSort,
  align = "left",
}: {
  label: string;
  sortKey: string;
  sort?: { key: string; direction: SortDirection };
  onSort: (key: string) => void;
  align?: "left" | "right";
}) {
  const active = sort?.key === sortKey;
  const Icon = active ? (sort.direction === "asc" ? ArrowUp : ArrowDown) : ArrowUpDown;
  return (
    <button
      type="button"
      onClick={() => onSort(sortKey)}
      aria-label={`Sort by ${label}${active ? `, currently ${sort.direction === "asc" ? "ascending" : "descending"}` : ""}`}
      className={`inline-flex items-center gap-1 uppercase transition hover:text-text focus-visible:outline-2 focus-visible:outline-brand ${
        active ? "text-text" : "text-text-faint"
      } ${align === "right" ? "flex-row-reverse" : ""}`}
    >
      {label}
      <Icon size={11} strokeWidth={2} aria-hidden className={active ? "text-brand" : ""} />
    </button>
  );
}

/** Plain (non-sortable) column label. */
export function RecordLabel({ children, align = "left" }: { children: ReactNode; align?: "left" | "right" }) {
  return <span className={align === "right" ? "text-right" : ""}>{children}</span>;
}

/** Mobile sort selector — the equivalent accessible sort control for the
 *  widths where the grid header (and its sort buttons) is hidden. Options
 *  carry the same sort keys and directions the headers expose. */
export function MobileSortSelect({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (next: { key: string; direction: SortDirection }) => void;
  options: Array<{ key: string; direction: SortDirection; label: string }>;
}) {
  const current = options.find((o) => `${o.key}:${o.direction}` === value)?.label ?? "Sort";
  return (
    <NativeSelect
      value={value}
      onChange={(e) => {
        const [key, direction] = (e.target.value.split(":") as [string, SortDirection]);
        onChange({ key, direction });
      }}
      aria-label="Sort records"
      className="h-8 md:hidden"
    >
      {!options.some((o) => `${o.key}:${o.direction}` === value) && <option value={value}>{current}</option>}
      {options.map((o) => (
        <option key={`${o.key}:${o.direction}`} value={`${o.key}:${o.direction}`}>{o.label}</option>
      ))}
    </NativeSelect>
  );
}
