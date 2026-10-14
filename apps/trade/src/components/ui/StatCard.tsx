import type { ReactNode } from "react";

/**
 * Unified stat card — label, value, optional tone and hint.
 * Replaces the four divergent stat-card variants across the portal and admin.
 */
export function StatCard({
  label,
  value,
  tone = "default",
  hint,
  icon,
  onClick,
}: {
  label: string;
  value: ReactNode;
  tone?: "default" | "up" | "down" | "warn";
  hint?: ReactNode;
  icon?: ReactNode;
  onClick?: () => void;
}) {
  const toneClass =
    tone === "up" ? "text-up" : tone === "down" ? "text-down" : tone === "warn" ? "text-primary" : "text-foreground";
  const body = (
    <>
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className={`mt-1 text-lg font-semibold tabular-nums leading-tight ${toneClass}`}>{value}</p>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </>
  );
  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className="flex w-full items-start gap-2.5 rounded-xl border bg-card p-4 text-left shadow-sm transition-colors hover:border-primary/40"
      >
        {icon && <span className="mt-0.5 shrink-0">{icon}</span>}
        <span className="min-w-0 flex-1">{body}</span>
      </button>
    );
  }
  return (
    <div className="flex items-start gap-2.5 rounded-xl border bg-card p-4 shadow-sm">
      {icon && <span className="mt-0.5 shrink-0">{icon}</span>}
      <div className="min-w-0 flex-1">{body}</div>
    </div>
  );
}
