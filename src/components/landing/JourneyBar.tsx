"use client";

import { useTranslations } from "next-intl";
import { useScrollSpy } from "@/hooks/useScrollSpy";

export interface TocItem {
  id: string;
  /** Translation key under `toc.sections` (used when `label` is absent). */
  labelKey?: string;
  /** Pre-resolved label from a domain content package (wins over labelKey). */
  label?: string;
}

/**
 * Journey bar — the landing's guided-tour navigation. One sticky strip under
 * the navbar replaces the old three-rail layout: numbered section chips with
 * scroll-spy active state and read-checks, plus an inline progress meter
 * (inherited from the retired ProgressChecklist). Frees the page body to
 * full-width bands while keeping the guided-tour feel.
 */
export function JourneyBar({ items }: { items: TocItem[] }) {
  const ids = items.map((i) => i.id);
  const { active, read } = useScrollSpy(ids);
  const tSections = useTranslations("toc.sections");
  const pct = items.length === 0 ? 0 : Math.round((read.size / items.length) * 100);

  const handleClick = (e: React.MouseEvent, id: string) => {
    e.preventDefault();
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
      history.replaceState(null, "", `#${id}`);
    }
  };

  return (
    <nav
      aria-label="Sections"
      className="sticky top-16 z-30 border-y border-border-soft bg-canvas/90 backdrop-blur"
    >
      <div className="max-w-7xl mx-auto px-4 lg:px-8">
        <ol className="flex items-center gap-1.5 overflow-x-auto py-2.5">
          {items.map((item, i) => {
            const isActive = active === item.id;
            const isRead = read.has(item.id);
            const label = item.label ?? (item.labelKey ? tSections(item.labelKey) : item.id);
            return (
              <li key={item.id} className="shrink-0">
                <a
                  href={`#${item.id}`}
                  onClick={(e) => handleClick(e, item.id)}
                  aria-current={isActive ? "true" : undefined}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs whitespace-nowrap transition ${
                    isActive
                      ? "border-brand bg-brand-soft text-brand font-semibold"
                      : isRead
                        ? "border-border-soft bg-panel text-text"
                        : "border-border-soft bg-canvas text-text-muted hover:text-text hover:border-border"
                  }`}
                >
                  <span
                    className={`font-mono text-[10px] ${isRead ? "text-up" : "text-text-faint"}`}
                    aria-hidden="true"
                  >
                    {isRead ? "✓" : i + 1}
                  </span>
                  {label}
                </a>
              </li>
            );
          })}
          {items.length > 0 ? (
            <li className="ml-auto flex shrink-0 items-center gap-2 pl-3">
              <div className="h-1 w-16 rounded-full bg-panel-3 overflow-hidden" aria-hidden="true">
                <div
                  className="h-full bg-brand transition-[width] duration-500 ease-out"
                  style={{ width: `${pct}%` }}
                />
              </div>
              <span className="tnum font-mono text-[11px] text-text-faint">
                {read.size}/{items.length}
              </span>
            </li>
          ) : null}
        </ol>
      </div>
    </nav>
  );
}
