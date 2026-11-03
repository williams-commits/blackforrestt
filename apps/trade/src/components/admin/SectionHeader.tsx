"use client";

import type { ReactNode } from "react";
import { RefreshCw } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/Button";

/**
 * The one admin page header: category, icon/title hierarchy, and module actions.
 */
export function SectionHeader({
  eyebrow,
  title,
  description,
  onRefresh,
  action,
  icon,
  className,
}: {
  eyebrow: string;
  title: ReactNode;
  description?: ReactNode;
  /** Renders the standard outline Refresh button when provided. */
  onRefresh?: () => void;
  /** Right-aligned custom controls (badges, primary actions, stats). */
  action?: ReactNode;
  /** Leading Lucide icon in a tonal tile — the tab's identity mark. */
  icon?: ReactNode;
  className?: string;
}) {
  return (
    <header className={cn("flex flex-col gap-4 rounded-xl bg-card p-4 shadow-panel sm:flex-row sm:items-center sm:justify-between sm:p-5", className)}>
      <div className="flex min-w-0 items-center gap-3">
        {icon != null && (
          <span
            aria-hidden
            className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"
          >
            {icon}
          </span>
        )}
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-primary">{eyebrow}</p>
          <h1 className="mt-0.5 text-xl font-semibold tracking-tight sm:text-2xl">{title}</h1>
          {description != null && (
            <p className="mt-1 max-w-3xl text-sm leading-5 text-muted-foreground">{description}</p>
          )}
        </div>
      </div>
      {(action || onRefresh) && (
        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:shrink-0 sm:justify-end">
          {action}
          {onRefresh && (
            <Button type="button" size="sm" variant="outline" onClick={onRefresh}>
              <RefreshCw size={13} strokeWidth={2} aria-hidden /> Refresh
            </Button>
          )}
        </div>
      )}
    </header>
  );
}
