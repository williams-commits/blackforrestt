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
    tone === "up" ? "text-up" : tone === "down" ? "text-down" : tone === "warn" ? "text-brand" : "text-text";
  const body = (
    <>
      <p className="text-[10px] font-medium uppercase tracking-wide text-text-faint">{label}</p>
      <p className={`mt-1 text-lg font-semibold tnum leading-tight ${toneClass}`}>{value}</p>
      {hint && <p className="mt-1 text-[10px] text-text-faint">{hint}</p>}
    </>
  );
  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className="flex w-full items-start gap-2.5 rounded-lg border border-border bg-canvas p-4 text-left transition hover:border-brand/40"
      >
        {icon && <span className="mt-0.5 shrink-0">{icon}</span>}
        <span className="min-w-0 flex-1">{body}</span>
      </button>
    );
  }
  return (
    <div className="flex items-start gap-2.5 rounded-lg border border-border bg-canvas p-4">
      {icon && <span className="mt-0.5 shrink-0">{icon}</span>}
      <div className="min-w-0 flex-1">{body}</div>
    </div>
  );
}
