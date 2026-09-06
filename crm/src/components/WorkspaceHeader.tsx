import type { ReactNode } from "react";

export function WorkspaceHeader({
  eyebrow,
  title,
  subtitle,
  actions,
  metrics,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: ReactNode;
  actions?: ReactNode;
  metrics?: Array<{ label: string; value: ReactNode; tone?: "brand" | "success" | "warning" | "info" }>;
}) {
  return (
    <header className="workspace-header">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          {eyebrow ? <p className="workspace-eyebrow">{eyebrow}</p> : null}
          <h1 className="workspace-title">{title}</h1>
          {subtitle ? <p className="workspace-subtitle">{subtitle}</p> : null}
        </div>
        {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
      {metrics?.length ? (
        <div className="workspace-metrics" aria-label={`${title} summary`}>
          {metrics.map((metric) => (
            <div key={metric.label} className="workspace-metric">
              <span className={`workspace-metric-dot ${metric.tone ?? "brand"}`} />
              <span className="workspace-metric-value">{metric.value}</span>
              <span className="workspace-metric-label">{metric.label}</span>
            </div>
          ))}
        </div>
      ) : null}
    </header>
  );
}
