import { type ReactNode } from "react";

interface PanelProps {
  title?: ReactNode;
  right?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}

/** A dark panel with a header bar, matching the pro-layout screenshot style. */
export function Panel({ title, right, children, className = "", bodyClassName = "" }: PanelProps) {
  return (
    <section className={`flex flex-col bg-panel border border-border rounded-[4px] overflow-hidden ${className}`}>
      {title ? (
        <header className="flex items-center justify-between h-9 px-3 border-b border-border bg-panel-2 shrink-0">
          <div className="text-xs font-medium text-text-muted uppercase tracking-wide">{title}</div>
          {right}
        </header>
      ) : null}
      <div className={`flex-1 min-h-0 ${bodyClassName}`}>{children}</div>
    </section>
  );
}
