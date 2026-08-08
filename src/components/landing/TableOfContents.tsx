"use client";

import { useTranslations } from "next-intl";
import { useScrollSpy } from "@/hooks/useScrollSpy";

export interface TocItem {
  id: string;
  /** Translation key under `toc.sections`. */
  labelKey: string;
}

interface TableOfContentsProps {
  items: TocItem[];
}

/**
 * Sticky table of contents. Highlights the active section via scroll-spy and
 * smooth-scrolls on click.
 *
 * - Desktop: a vertical rail. `sticky top-24` lives here; the parent grid cell
 *   stretches to the row height (CSS grid default `align-items: stretch`), and
 *   `self-start` on this wrapper keeps the sticky box from growing — both
 *   together let it stick for the full scroll length of the centre column.
 * - Mobile: a horizontal scrollable strip (the parent gates desktop/mobile).
 */
export function TableOfContents({ items }: TableOfContentsProps) {
  const ids = items.map((i) => i.id);
  const { active } = useScrollSpy(ids);
  const tSections = useTranslations("toc.sections");
  const tCommon = useTranslations("toc");

  const handleClick = (e: React.MouseEvent, id: string) => {
    e.preventDefault();
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
      history.replaceState(null, "", `#${id}`);
    }
  };

  return (
    <nav aria-label="Sections" className="text-sm lg:sticky lg:top-24 lg:self-start">
      {/* Desktop rail */}
      <div className="hidden lg:block">
        <div className="text-[10px] font-mono uppercase tracking-widest text-text-faint mb-3">
          {tCommon("contents")}
        </div>
        <ol className="space-y-1 border-l border-border">
          {items.map((item, i) => {
            const isActive = active === item.id;
            return (
              <li key={item.id}>
                <a
                  href={`#${item.id}`}
                  onClick={(e) => handleClick(e, item.id)}
                  className={`group flex items-start gap-2 -ml-px pl-3 py-1 border-l-2 transition ${
                    isActive
                      ? "border-brand text-text font-semibold"
                      : "border-transparent text-text-muted hover:text-text"
                  }`}
                >
                  <span className="font-mono text-[10px] text-text-faint mt-0.5">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span>{tSections(item.labelKey)}</span>
                </a>
              </li>
            );
          })}
        </ol>
      </div>

      {/* Mobile strip */}
      <div className="lg:hidden -mx-4 px-4 overflow-x-auto">
        <ol className="flex gap-2 pb-1">
          {items.map((item, i) => {
            const isActive = active === item.id;
            return (
              <li key={item.id} className="shrink-0">
                <a
                  href={`#${item.id}`}
                  onClick={(e) => handleClick(e, item.id)}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs whitespace-nowrap transition ${
                    isActive
                      ? "border-brand bg-brand-soft text-brand font-semibold"
                      : "border-border bg-canvas text-text-muted"
                  }`}
                >
                  <span className="font-mono text-[10px]">{i + 1}</span>
                  {tSections(item.labelKey)}
                </a>
              </li>
            );
          })}
        </ol>
      </div>
    </nav>
  );
}
