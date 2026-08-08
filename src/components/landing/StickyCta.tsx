"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { clientTradeUrl } from "@/lib/branding";

/**
 * Fixed registration bar that appears once the reader scrolls past the hero and
 * hides again near the final CTA section (so it doesn't duplicate). Honours the
 * dim theme automatically via the design tokens. Dismissible for the session.
 *
 * Visibility is driven by an IntersectionObserver watching the hero and final-CTA
 * elements (plus a scroll listener as a belt-and-braces fallback). This mirrors
 * the useScrollSpy approach, which is reliable across browsers and embedded
 * web-views where window 'scroll' events alone can be unreliable.
 */
export function StickyCta({ heroId = "hero", finalId = "final-cta" }: { heroId?: string; finalId?: string }) {
  const t = useTranslations("stickyCta");
  const [pastHero, setPastHero] = useState(false);
  const [atFinal, setAtFinal] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (dismissed) return;
    const hero = document.getElementById(heroId);
    const final = document.getElementById(finalId);

    const compute = () => {
      // Hero scrolled past when its bottom is above the viewport top.
      if (hero) setPastHero(hero.getBoundingClientRect().bottom < 0);
      else setPastHero(window.scrollY > window.innerHeight);
      // Final CTA on screen when its top is within the viewport (with margin).
      if (final) setAtFinal(final.getBoundingClientRect().top < window.innerHeight + 80);
      else setAtFinal(false);
    };

    // Primary signal: IntersectionObserver on both anchor elements.
    const observer = new IntersectionObserver(
      () => compute(),
      { rootMargin: "0px", threshold: [0, 0.1, 0.5, 1] },
    );
    if (hero) observer.observe(hero);
    if (final) observer.observe(final);

    // Fallback signal: scroll/resize listeners (some embedded views deliver
    // scroll here even when IntersectionObserver callbacks are delayed).
    compute();
    window.addEventListener("scroll", compute, { passive: true });
    window.addEventListener("resize", compute);

    return () => {
      observer.disconnect();
      window.removeEventListener("scroll", compute);
      window.removeEventListener("resize", compute);
    };
  }, [heroId, finalId, dismissed]);

  if (dismissed || !(pastHero && !atFinal)) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 px-4 pb-4 pointer-events-none">
      <div className="max-w-3xl mx-auto pointer-events-auto rounded-xl border border-border bg-canvas/95 backdrop-blur shadow-card px-4 py-3 flex items-center gap-3">
        <div className="hidden sm:flex h-9 w-9 items-center justify-center rounded-md bg-brand-soft text-brand shrink-0" aria-hidden="true">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 17l6-6 4 4 8-8" /><path d="M21 7v6h-6" />
          </svg>
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold text-text">{t("title")}</div>
          <div className="text-xs text-text-muted truncate">{t("subtitle")}</div>
        </div>
        <a
          href={clientTradeUrl("/register")}
          className="shrink-0 px-4 py-2 rounded-lg bg-brand text-white text-sm font-semibold hover:brightness-110 transition"
        >
          {t("button")}
        </a>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          aria-label={t("dismiss")}
          className="shrink-0 h-8 w-8 inline-flex items-center justify-center rounded-md text-text-faint hover:text-text hover:bg-panel transition"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
