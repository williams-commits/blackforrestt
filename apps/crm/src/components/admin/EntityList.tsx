"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Premium entity list — the admin module's replacement for raw data tables.
 * Each row is a presentation card: leading visual (avatar/swatch), title
 * line with status chips, subtitle, right-aligned key/values, and trailing
 * actions. Desktop renders one calm horizontal row; phones stack the same
 * content into a two-zone card. No horizontal scrolling at any width —
 * the flexible zones reflow instead.
 */

export interface EntityBadge {
  label: ReactNode;
  tone?: "neutral" | "success" | "warning" | "info" | "error";
  /** Dot-prefixed chip (statuses, presence). */
  dot?: string;
  className?: string;
}

export interface EntityMetaItem {
  label: string;
  value: ReactNode;
  align?: "left" | "right";
}

export interface EntityListItem {
  id: string;
  /** 36–40px leading visual (avatar, color swatch, type icon). */
  leading?: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  badges?: EntityBadge[];
  meta?: EntityMetaItem[];
  trailing?: ReactNode;
  selected?: boolean;
  onClick?: () => void;
}

const TONE_CLASS: Record<NonNullable<EntityBadge["tone"]>, string> = {
  neutral: "bg-muted text-muted-foreground",
  success: "bg-(--success-bg) text-(--success)",
  warning: "bg-(--warning-bg) text-(--warning)",
  info: "bg-(--info-bg) text-(--info)",
  error: "bg-(--error-bg) text-(--error)",
};

function BadgeChip({ badge }: { badge: EntityBadge }) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium",
        TONE_CLASS[badge.tone ?? "neutral"],
        badge.className,
      )}
    >
      {badge.dot ? (
        <span aria-hidden className="size-1.5 rounded-full" style={{ background: badge.dot }} />
      ) : null}
      {badge.label}
    </span>
  );
}

export function EntityList({
  items,
  loading,
  empty,
  skeleton,
  /** Accessible label for the list ("Users", "Statuses"). */
  label,
}: {
  items: EntityListItem[];
  loading?: boolean;
  empty?: ReactNode;
  skeleton?: ReactNode;
  label: string;
}) {
  return (
    // Row separation is tonal (hover wash + hairlines at whisper strength)
    // — the container card carries the boundary, not per-row boxes.
    <ul aria-label={label} className="divide-y divide-border/60">
      {loading
        ? skeleton
        : items.map((item) => (
            <li
              key={item.id}
              className={cn(
                "flex flex-col gap-2 px-4 py-3.5 transition-colors sm:flex-row sm:items-center sm:gap-4",
                item.onClick ? "cursor-pointer" : undefined,
                item.selected ? "bg-muted" : "hover:bg-muted/40",
              )}
              onClick={item.onClick}
            >
              {item.leading ? <span className="shrink-0 sm:mt-0.5">{item.leading}</span> : null}
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="truncate text-sm font-medium text-foreground">{item.title}</span>
                  {item.badges?.map((badge, index) => (
                    <BadgeChip key={index} badge={badge} />
                  ))}
                </div>
                {item.subtitle ? (
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">{item.subtitle}</p>
                ) : null}
              </div>
              {item.meta && item.meta.length > 0 ? (
                <dl className="flex flex-wrap gap-x-6 gap-y-2 sm:ml-auto sm:flex-nowrap sm:pl-4">
                  {item.meta.map((entry) => (
                    <div key={entry.label} className="min-w-0">
                      <dt className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground/60">
                        {entry.label}
                      </dt>
                      <dd className="mt-0.5 text-[13px] text-foreground first-line:tnum">{entry.value}</dd>
                    </div>
                  ))}
                </dl>
              ) : null}
              {item.trailing ? (
                <div
                  className="flex shrink-0 items-center gap-1.5 empty:hidden max-sm:w-full max-sm:justify-between"
                  onClick={(event) => event.stopPropagation()}
                >
                  {item.trailing}
                </div>
              ) : null}
            </li>
          ))}
      {!loading && items.length === 0 && empty ? (
        <li className="px-4">{empty}</li>
      ) : null}
    </ul>
  );
}
