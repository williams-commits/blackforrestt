"use client";

import type { ReactNode } from "react";

/**
 * Shared data-table kit for the account portal and admin console.
 * One card shell, one header/cell style, built-in sortable headers.
 * Replaces the three copy-pasted Th/Td sets and ReferralTab's hand-rolled cells.
 */

export function TableShell({
  children,
  minWidth = 900,
  toolbar,
  footer,
}: {
  children: ReactNode;
  /** Horizontal scroll kicks in below this width (px). */
  minWidth?: number;
  /** Optional toolbar row rendered above the table inside the card. */
  toolbar?: ReactNode;
  /** Attached card footer (e.g. <Pagination />) — rendered inside the border. */
  footer?: ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-canvas">
      {toolbar && (
        <div className="flex min-h-10 flex-wrap items-center gap-2 border-b border-border bg-panel-2 px-3 py-2">
          {toolbar}
        </div>
      )}
      <div className="overflow-x-auto overscroll-x-contain">
        <table className="w-full" style={{ minWidth: `${minWidth}px` }}>
          {children}
        </table>
      </div>
      {footer}
    </div>
  );
}

export type SortDirection = "asc" | "desc";

export function useSortState<T extends string>(initial: T, initialDir: SortDirection = "desc") {
  return { key: initial, direction: initialDir } as { key: T; direction: SortDirection };
}

/** Sortable table header. Pass `sortKey` only for sortable columns. */
export function Th({
  children,
  sortKey,
  sort,
  onSort,
  align = "left",
  className = "",
}: {
  children: ReactNode;
  /** Enables click-to-sort when provided. */
  sortKey?: string;
  sort?: { key: string; direction: SortDirection };
  onSort?: (key: string) => void;
  align?: "left" | "right" | "center";
  className?: string;
}) {
  const sortable = Boolean(sortKey && onSort);
  const active = sortable && sort?.key === sortKey;
  const indicator = active ? (sort!.direction === "asc" ? "▲" : "▼") : sortable ? "⇅" : null;
  const content = (
    <>
      {children}
      {indicator && (
        <span className={`ml-1 text-[8px] ${active ? "text-brand" : "text-text-faint/50"}`}>{indicator}</span>
      )}
    </>
  );
  if (!sortable) {
    return (
      <th className={`px-3 py-2 text-[10px] font-medium uppercase tracking-wide text-text-faint ${align === "right" ? "text-right" : align === "center" ? "text-center" : "text-left"} ${className}`}>
        {content}
      </th>
    );
  }
  return (
    <th
      aria-sort={active ? (sort!.direction === "asc" ? "ascending" : "descending") : "none"}
      className={`px-3 py-2 text-[10px] font-medium uppercase tracking-wide ${align === "right" ? "text-right" : align === "center" ? "text-center" : "text-left"} ${className}`}
    >
      <button
        type="button"
        onClick={() => onSort!(sortKey!)}
        className={`inline-flex items-center gap-0.5 uppercase transition hover:text-text ${active ? "text-text" : "text-text-faint"}`}
      >
        {content}
      </button>
    </th>
  );
}

export function Td({
  children,
  align = "left",
  className = "",
  colSpan,
}: {
  children: ReactNode;
  align?: "left" | "right" | "center";
  className?: string;
  colSpan?: number;
}) {
  return (
    <td
      colSpan={colSpan}
      className={`px-3 py-2 text-xs tnum ${align === "right" ? "text-right" : align === "center" ? "text-center" : "text-left"} ${className}`}
    >
      {children}
    </td>
  );
}

export function EmptyRow({ colSpan, label }: { colSpan: number; label: string }) {
  return (
    <tr>
      <td colSpan={colSpan} className="px-3 py-8 text-center text-xs text-text-faint">
        {label}
      </td>
    </tr>
  );
}

export function TotalsRow({ cells }: { cells: Array<{ label?: string; value?: string; colSpan?: number; align?: "left" | "right"; className?: string }> }) {
  // No border-t: the preceding data row's border-b is the single separator
  // (adding one here doubled the line above the totals).
  return (
    <tr className="bg-panel-2/60">
      {cells.map((cell, i) => (
        <td
          key={i}
          colSpan={cell.colSpan}
          className={`px-3 py-2 text-xs font-semibold tnum ${cell.align === "right" ? "text-right" : "text-left"} ${cell.className ?? ""}`}
        >
          {cell.label ?? cell.value ?? ""}
        </td>
      ))}
    </tr>
  );
}

/** Small pill filter chip used in table toolbars. */
export function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`rounded-full border px-2.5 py-1 text-[10px] font-medium transition ${
        active ? "border-brand bg-brand text-white" : "border-border bg-canvas text-text-muted hover:border-brand/40 hover:text-text"
      }`}
    >
      {children}
    </button>
  );
}

/** Compact toolbar search input. */
export function TableSearch({
  value,
  onChange,
  placeholder = "Search…",
  label,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  label: string;
}) {
  return (
    <input
      type="search"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      aria-label={label}
      className="h-8 min-w-40 flex-1 rounded border border-border bg-canvas px-2.5 text-xs outline-none focus:border-brand sm:max-w-56"
    />
  );
}
