"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";

interface PaginationProps {
  page: number;
  pageSize: number;
  totalItems: number;
  onPageChange: (page: number) => void;
  label?: string;
  compact?: boolean;
}

/**
 * Accessible, reusable client-side pagination for bounded enterprise tables.
 * Tonal footer band — no per-button borders; hover/disabled follow the
 * platform's ghost-button behavior instead of outlined chrome.
 */
export function Pagination({
  page,
  pageSize,
  totalItems,
  onPageChange,
  label = "items",
  compact = false,
}: PaginationProps) {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const safePage = Math.min(Math.max(page, 1), totalPages);
  const start = totalItems === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const end = Math.min(totalItems, safePage * pageSize);

  const step =
    "inline-flex cursor-pointer items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring disabled:pointer-events-none disabled:opacity-40";

  return (
    <nav
      aria-label={`${label} pagination`}
      className={`flex flex-wrap items-center justify-between gap-2 border-t bg-muted/40 ${compact ? "px-3 py-1.5" : "px-4 py-2.5"}`}
    >
      <span className="text-[10px] text-muted-foreground" aria-live="polite">
        {totalItems === 0 ? `No ${label}` : `${start}–${end} of ${totalItems} ${label}`}
      </span>
      <div className="flex items-center gap-1">
        <button
          type="button"
          disabled={safePage <= 1}
          onClick={() => onPageChange(safePage - 1)}
          className={step}
        >
          <ChevronLeft size={12} strokeWidth={2} aria-hidden /> Previous
        </button>
        <span className="min-w-16 text-center text-[10px] text-muted-foreground tnum">
          {safePage} / {totalPages}
        </span>
        <button
          type="button"
          disabled={safePage >= totalPages}
          onClick={() => onPageChange(safePage + 1)}
          className={step}
        >
          Next <ChevronRight size={12} strokeWidth={2} aria-hidden />
        </button>
      </div>
    </nav>
  );
}
