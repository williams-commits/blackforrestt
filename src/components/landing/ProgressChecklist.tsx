"use client";

import { useTranslations } from "next-intl";
import { useScrollSpy } from "@/hooks/useScrollSpy";
import type { TocItem } from "@/components/landing/TableOfContents";
import Link from "next/link";

interface ProgressChecklistProps {
  items: TocItem[];
}

/**
 * A sticky "reading progress" card. Each section becomes a checked item once
 * it scrolls into view, and a thin progress bar shows overall completion.
 * Gives the structured, polished feel of a guided tour.
 */
export function ProgressChecklist({ items }: ProgressChecklistProps) {
  const ids = items.map((i) => i.id);
  const { read } = useScrollSpy(ids);
  const t = useTranslations("toc");
  const tSections = useTranslations("toc.sections");
  const pct = items.length === 0 ? 0 : Math.round((read.size / items.length) * 100);
  const done = pct === 100;

  return (
    <div className="rounded-xl border border-border bg-panel p-4 shadow-panel">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-mono uppercase tracking-widest text-text-faint">
          {t("progress")}
        </span>
        <span className={`tnum font-mono text-xs font-semibold ${done ? "text-up" : "text-text-muted"}`}>
          {pct}%
        </span>
      </div>

      <div className="mt-2 h-1.5 rounded-full bg-panel-3 overflow-hidden">
        <div
          className="h-full bg-brand transition-[width] duration-500 ease-out"
          style={{ width: `${pct}%` }}
        />
      </div>

      <ul className="mt-3 space-y-1.5">
        {items.map((item, i) => {
          const isRead = read.has(item.id);
          return (
            <li key={item.id} className="flex items-center gap-2 text-xs">
              <span
                className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border text-[9px] transition ${
                  isRead
                    ? "bg-up border-up text-white"
                    : "border-border text-transparent"
                }`}
                aria-hidden="true"
              >
                ✓
              </span>
              <span className={`font-mono text-[10px] text-text-faint w-4`}>{i + 1}</span>
              <span className={isRead ? "text-text" : "text-text-muted"}>
                {tSections(item.labelKey)}
              </span>
            </li>
          );
        })}
      </ul>

      {done && (
        <div className="mt-3 rounded-md bg-up/10 px-2.5 py-1.5 text-[11px] text-up font-semibold">
          {t.rich("complete", {
            link: (chunks) => <Link href="/register" className="underline hover:no-underline text-brand">{chunks}</Link>,
          })}
        </div>
      )}
    </div>
  );
}
