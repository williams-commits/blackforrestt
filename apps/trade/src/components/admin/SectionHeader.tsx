"use client";

import type { ReactNode } from "react";
import { RefreshCw } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/Button";

/**
 * The one admin page/section header. Every tab renders it directly under the
 * tab boundary; the console banner at the top of /admin is the same component
 * with size="xl". Title + one-line description on the left, action slot and an
 * optional Refresh button on the right — no per-page header dialects.
 */
export function SectionHeader({
  title,
  description,
  onRefresh,
  action,
  icon,
  size = "lg",
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  /** Renders the standard outline Refresh button when provided. */
  onRefresh?: () => void;
  /** Right-aligned custom controls (badges, primary actions, stats). */
  action?: ReactNode;
  /** Leading Lucide icon in a tonal tile — the tab's identity mark. */
  icon?: ReactNode;
  /** "xl" is the console banner; default is the per-tab header. */
  size?: "lg" | "xl";
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap items-start justify-between gap-3", size !== "xl" && "mb-5", className)}>
      <div className="flex min-w-0 items-start gap-3">
        {icon != null && (
          <span
            aria-hidden
            className={cn(
              "flex shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary",
              size === "xl" ? "size-10" : "size-8",
            )}
          >
            {icon}
          </span>
        )}
        <div className="min-w-0">
          <h2 className={cn("font-semibold tracking-tight", size === "xl" ? "text-xl" : "text-lg")}>{title}</h2>
          {description != null && (
            <p className={cn("mt-1 text-muted-foreground", size === "xl" ? "text-xs" : "text-sm")}>{description}</p>
          )}
        </div>
      </div>
      {(action || onRefresh) && (
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {action}
          {onRefresh && (
            <Button type="button" size="sm" variant="outline" onClick={onRefresh}>
              <RefreshCw size={13} strokeWidth={2} aria-hidden /> Refresh
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
