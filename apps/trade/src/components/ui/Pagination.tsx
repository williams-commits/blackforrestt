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

/** Accessible, reusable client-side pagination for bounded enterprise tables. */
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

  return (
    <nav
      aria-label={`${label} pagination`}
      className={`flex flex-wrap items-center justify-between gap-2 border-t border-border bg-panel-2 ${compact ? "px-3 py-1.5" : "px-4 py-2.5"}`}
    >
      <span className="text-[10px] text-text-faint" aria-live="polite">
        {totalItems === 0 ? `No ${label}` : `${start}–${end} of ${totalItems} ${label}`}
      </span>
      <div className="flex items-center gap-1">
        <button
          type="button"
          disabled={safePage <= 1}
          onClick={() => onPageChange(safePage - 1)}
          className="inline-flex items-center gap-1 rounded border border-border bg-canvas px-2.5 py-1 text-[10px] font-medium text-text-muted hover:border-brand hover:text-text disabled:cursor-not-allowed disabled:opacity-40"
        >
          <ChevronLeft size={12} strokeWidth={2} aria-hidden /> Previous
        </button>
        <span className="min-w-16 text-center text-[10px] text-text-muted tnum">
          {safePage} / {totalPages}
        </span>
        <button
          type="button"
          disabled={safePage >= totalPages}
          onClick={() => onPageChange(safePage + 1)}
          className="inline-flex items-center gap-1 rounded border border-border bg-canvas px-2.5 py-1 text-[10px] font-medium text-text-muted hover:border-brand hover:text-text disabled:cursor-not-allowed disabled:opacity-40"
        >
          Next <ChevronRight size={12} strokeWidth={2} aria-hidden />
        </button>
      </div>
    </nav>
  );
}
