import type { ReactNode } from "react";

/**
 * Course summary banner for the VOD pages. Replaces the former emoji-led banner
 * with an inline-SVG mark consistent with the rest of the app's iconography.
 * Pairs a headline stat with a short description inside a brand-tinted card.
 */
export function VodBanner({ stat, children }: { stat: string; children: ReactNode }) {
  return (
    <div className="flex items-center gap-4 bg-brand-soft border border-brand/30 rounded-xl p-4 not-prose">
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-canvas/60 text-brand">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <rect x="2" y="4" width="20" height="16" rx="2" />
          <path d="M2 8h20M7 4v4M17 4v4M10 12l4 2.5-4 2.5z" fill="currentColor" stroke="none" />
        </svg>
      </div>
      <div>
        <div className="text-sm font-semibold text-text">{stat}</div>
        <div className="text-xs text-text-muted">{children}</div>
      </div>
    </div>
  );
}
