"use client";

import { Inbox, Search } from "lucide-react";
import { EmptyState } from "@/components/ui/EmptyState";
import { Table, TableCell, TableHead } from "@/components/ui/table";

import type { ReactNode } from "react";

/**
 * Shared data-table kit for the account portal and admin console.
 * One card shell, one header/cell style, built-in sortable headers.
 * Element primitives (Table/TableHead/TableCell) come from ui/table — the
 * shadcn base — with the terminal's dense spacing applied as overrides.
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
      <Table className="w-full" style={{ minWidth: `${minWidth}px` }}>
        {children}
      </Table>
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
        <span className={`ml-1 text-(length:--term-text-2xs) ${active ? "text-brand" : "text-text-faint"}`}>{indicator}</span>
      )}
    </>
  );
  if (!sortable) {
    return (
      <TableHead
        aria-sort={undefined}
        className={`h-auto border-0 px-3 py-2 text-(length:--term-text-2xs) font-medium uppercase tracking-wide text-text-faint ${align === "right" ? "text-right" : align === "center" ? "text-center" : "text-left"} ${className}`}
      >
        {content}
      </TableHead>
    );
  }
  return (
    <TableHead
      aria-sort={active ? (sort!.direction === "asc" ? "ascending" : "descending") : "none"}
      className={`h-auto border-0 px-3 py-2 text-(length:--term-text-2xs) font-medium uppercase tracking-wide ${align === "right" ? "text-right" : align === "center" ? "text-center" : "text-left"} ${className}`}
    >
      <button
        type="button"
        onClick={() => onSort!(sortKey!)}
        className={`inline-flex items-center gap-0.5 uppercase transition hover:text-text ${active ? "text-text" : "text-text-faint"}`}
      >
        {content}
      </button>
    </TableHead>
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
    <TableCell
      colSpan={colSpan}
      className={`border-0 px-3 py-2 text-(length:--term-text-sm) tnum ${align === "right" ? "text-right" : align === "center" ? "text-center" : "text-left"} ${className}`}
    >
      {children}
    </TableCell>
  );
}

export function EmptyRow({ colSpan, label }: { colSpan: number; label: string }) {
  return (
    <tr>
      <TableCell colSpan={colSpan} className="p-0">
        <EmptyState compact icon={<Inbox size={18} />} title={label} />
      </TableCell>
    </tr>
  );
}

export function TotalsRow({ cells }: { cells: Array<{ label?: string; value?: string; colSpan?: number; align?: "left" | "right"; className?: string }> }) {
  // No border-t: the preceding data row's border-b is the single separator
  // (adding one here doubled the line above the totals).
  return (
    <tr className="bg-panel-2/60">
      {cells.map((cell, i) => (
        <TableCell
          key={i}
          colSpan={cell.colSpan}
          className={`border-0 px-3 py-2 text-(length:--term-text-sm) font-semibold tnum ${cell.align === "right" ? "text-right" : "text-left"} ${cell.className ?? ""}`}
        >
          {cell.label ?? cell.value ?? ""}
        </TableCell>
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
      className={`rounded-full border px-2.5 py-1 text-(length:--term-text-2xs) font-medium whitespace-nowrap transition active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 ${
        active
          ? "border-brand bg-brand text-white"
          : "border-border bg-canvas text-text-muted hover:border-brand/40 hover:text-text"
      }`}
    >
      {children}
    </button>
  );
}

/** Compact toolbar search input — full-width row on phones, bounded on sm+. */
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
    <div className="relative w-full sm:w-auto sm:min-w-48 sm:max-w-56">
      <Search
        size={14}
        aria-hidden
        className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-text-faint"
      />
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={label}
        className="h-8 w-full rounded-md border border-border bg-canvas pl-8 pr-2.5 text-(length:--term-text-sm) text-text outline-none transition placeholder:text-text-faint focus:border-brand focus:ring-2 focus:ring-brand/25"
      />
    </div>
  );
}
