import type { ReactNode } from "react";

/**
 * Shared empty-state block for account-portal tables and panels — the
 * enterprise "nothing here yet" treatment: a muted icon tile, a short
 * title, and an optional hint. Uses only base palette utilities (no
 * terminal-scope tokens), so it is safe on any surface.
 */
export function EmptyState({
  icon,
  title,
  hint,
  compact = false,
}: {
  /** Lucide icon element (e.g. <Inbox size={18} />). */
  icon?: ReactNode;
  title: string;
  hint?: string;
  /** Tighter padding for inside table cells and small panels. */
  compact?: boolean;
}) {
  return (
    <div className={`flex flex-col items-center justify-center gap-1.5 text-center ${compact ? "py-6" : "py-10"}`}>
      {icon ? (
        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-panel-2 text-text-faint" aria-hidden="true">
          {icon}
        </span>
      ) : null}
      <p className="text-xs font-medium text-text-muted">{title}</p>
      {hint ? <p className="max-w-72 text-[11px] leading-relaxed text-text-faint">{hint}</p> : null}
    </div>
  );
}
