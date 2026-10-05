"use client";

import { useRef } from "react";
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  type ColumnDef,
} from "@tanstack/react-table";
import { useVirtualizer } from "@tanstack/react-virtual";

/**
 * TerminalTable — the Phase 3 data-grid primitive for the trading app.
 *
 * Headless TanStack Table core rendered onto the terminal token system
 * (sticky header, zebra rows, tabular figures, --term-row-* density).
 * Virtualization switches on automatically past `virtualThreshold` rows so
 * positions blotters and long histories scroll at 60fps without the caller
 * thinking about it. Column definitions are plain TanStack ColumnDefs —
 * sorting/grouping plug in per-surface without changing this shell.
 *
 * Scope note: styles reference `.terminal-ui` tokens — render inside the
 * authenticated shells only (never on marketing surfaces).
 */
export function TerminalTable<T extends object>({
  data,
  columns,
  rowHeight = 34,
  virtualThreshold = 60,
  minWidth,
  emptyState,
  ariaLabel,
  onRowClick,
  footer,
}: {
  data: T[];
  columns: ColumnDef<T, unknown>[];
  /** Row estimate for virtualization — match the density token in use
   *  (--term-row-sm 28 / md 34 / lg 40). */
  rowHeight?: number;
  /** Below this count the table renders plainly (live WS lists stay
   *  simple); beyond it the body virtualizes. */
  virtualThreshold?: number;
  minWidth?: number;
  emptyState?: React.ReactNode;
  ariaLabel: string;
  /** Row-level click (e.g. navigate to symbol) — applied to every row. */
  onRowClick?: (row: T) => void;
  /** Rendered below the scroll area (e.g. "Load 25 more"). */
  footer?: React.ReactNode;
}) {
  const table = useReactTable({ data, columns, getCoreRowModel: getCoreRowModel() });
  const rows = table.getRowModel().rows;
  const scrollRef = useRef<HTMLDivElement>(null);
  const virtualize = rows.length > virtualThreshold;

  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => rowHeight,
    overscan: 12,
    enabled: virtualize,
  });

  if (rows.length === 0 && emptyState) {
    return <>{emptyState}</>;
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
    <div ref={scrollRef} className="min-h-0 flex-1 overflow-auto">
      <div style={minWidth ? { minWidth } : undefined}>
        <table className="w-full" aria-label={ariaLabel}>
          <thead className="sticky top-0 z-10 bg-panel-2">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <th
                    key={header.id}
                    className={`whitespace-nowrap border-b border-border px-2 py-1.5 text-(length:--term-text-2xs) font-medium uppercase tracking-wide text-text-faint ${String((header.column.columnDef.meta as { headerClass?: string } | undefined)?.headerClass ?? "")}`}
                  >
                    {header.isPlaceholder
                      ? null
                      : flexRender(header.column.columnDef.header, header.getContext())}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {virtualize ? (
              <>
                {virtualizer.getVirtualItems().length > 0 && (
                  <tr style={{ height: virtualizer.getVirtualItems()[0]!.start }} aria-hidden>
                    <td colSpan={columns.length} />
                  </tr>
                )}
                {virtualizer.getVirtualItems().map((virtualRow) => {
                  const row = rows[virtualRow.index]!;
                  return (
                    <tr
                      key={row.id}
                      data-index={virtualRow.index}
                      onClick={(event) => { if (event.target instanceof Element && event.target.closest("button, a, input, select, textarea, label, [role=button]")) return; onRowClick?.(row.original); }}
                      ref={virtualizer.measureElement}
                      className={`border-t border-border-soft transition-colors hover:bg-panel-2/50 ${onRowClick ? "cursor-pointer " : ""}${
                        virtualRow.index % 2 === 1 ? "bg-panel/30" : ""
                      }`}
                    >
                      {row.getVisibleCells().map((cell) => (
                        <td
                          key={cell.id}
                          className={`whitespace-nowrap px-2 py-1 text-(length:--term-text-xs) ${String((cell.column.columnDef.meta as { cellClass?: string } | undefined)?.cellClass ?? "")}`}
                        >
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </td>
                      ))}
                    </tr>
                  );
                })}
                {virtualizer.getVirtualItems().length > 0 && (
                  <tr
                    style={{
                      height:
                        virtualizer.getTotalSize() -
                        (virtualizer.getVirtualItems().at(-1)!.end ?? 0),
                    }}
                    aria-hidden
                  >
                    <td colSpan={columns.length} />
                  </tr>
                )}
              </>
            ) : (
              rows.map((row, index) => (
                <tr
                  key={row.id}
                  onClick={(event) => { if (event.target instanceof Element && event.target.closest("button, a, input, select, textarea, label, [role=button]")) return; onRowClick?.(row.original); }}
                  className={`border-t border-border-soft transition-colors hover:bg-panel-2/50 ${onRowClick ? "cursor-pointer " : ""}${
                    index % 2 === 1 ? "bg-panel/30" : ""
                  }`}
                >
                  {row.getVisibleCells().map((cell) => (
                    <td
                      key={cell.id}
                      className={`whitespace-nowrap px-2 py-1 text-(length:--term-text-xs) ${String((cell.column.columnDef.meta as { cellClass?: string } | undefined)?.cellClass ?? "")}`}
                    >
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
    {footer}
    </div>
  );
}
