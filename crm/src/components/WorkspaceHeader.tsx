import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Icon } from "./Icon";

export function WorkspaceHeader({
  eyebrow,
  title,
  subtitle,
  actions,
  metrics,
  titleIcon = "folder",
}: {
  eyebrow?: string;
  title: string;
  subtitle?: ReactNode;
  actions?: ReactNode;
  metrics?: Array<{ label: string; value: ReactNode; tone?: "brand" | "success" | "warning" | "info" }>;
  titleIcon?: string;
}) {
  return (
    <header className="space-y-3">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          {eyebrow ? <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">{eyebrow}</p> : null}
          <h1 className="flex min-w-0 items-center gap-2 text-xl font-semibold tracking-tight text-foreground">
            {titleIcon ? (
              <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-linear-to-r from-primary/15 to-primary/20 text-primary">
                <Icon name={titleIcon} size={16} aria-hidden />
              </span>
            ) : null}
            <span className="truncate">{title}</span>
          </h1>
          {subtitle ? <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p> : null}
        </div>
        {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
      {metrics?.length ? (
        <div className="flex gap-5 overflow-x-auto pb-0.5 sm:gap-7" aria-label={`${title} summary`}>
          {metrics.map((metric) => (
            <div key={metric.label} className="flex shrink-0 items-center gap-2">
              <span
                aria-hidden
                className={cn(
                  "h-1.5 w-1.5 rounded-full",
                  metric.tone === "warning" ? "bg-foreground/40" : "bg-foreground/60"
                )}
              />
              <span className="text-lg font-bold tabular-nums text-foreground">{metric.value}</span>
              <span className="text-xs text-muted-foreground">{metric.label}</span>
            </div>
          ))}
        </div>
      ) : null}
    </header>
  );
}
