"use client";

import { Download } from "lucide-react";

/**
 * Client-side CSV export — builds a CSV blob from columns + rows and triggers
 * a download. No server round-trip; works on already-fetched table data.
 */

function escapeCsvCell(value: unknown): string {
  const str = value == null ? "" : String(value);
  if (/[",\n\r]/.test(str)) return `"${str.replaceAll('"', '""')}"`;
  return str;
}

export function buildCsv(columns: string[], rows: Array<Array<unknown>>): string {
  const lines = [columns.map(escapeCsvCell).join(","), ...rows.map((row) => row.map(escapeCsvCell).join(","))];
  return lines.join("\r\n");
}

export function downloadCsv(filename: string, columns: string[], rows: Array<Array<unknown>>): void {
  const csv = buildCsv(columns, rows);
  const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename.endsWith(".csv") ? filename : `${filename}.csv`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export function CsvExportButton({
  filename,
  columns,
  rows,
  label = "Export CSV",
  disabled = false,
}: {
  filename: string;
  columns: string[];
  rows: Array<Array<unknown>>;
  label?: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => downloadCsv(filename, columns, rows)}
      className="flex h-8 shrink-0 items-center gap-1.5 rounded border border-border bg-canvas px-2.5 text-[11px] font-medium text-text-muted transition hover:border-brand/40 hover:text-brand disabled:opacity-50"
    >
      <Download size={12} strokeWidth={1.75} aria-hidden />
      {label}
    </button>
  );
}
