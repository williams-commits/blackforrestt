"use client";

import { useEffect, useState } from "react";

/**
 * Track which section is currently in view, plus the set of sections the reader
 * has already scrolled past. Powers the sticky table of contents, the progress
 * checklist, and the sticky CTA reveal.
 *
 * Two signals are combined so the "read" set is reliable in every case:
 *   1. An IntersectionObserver marks a section read the moment any part of it
 *      is visible.
 *   2. A scroll listener marks a section read once its top crosses the
 *      `readLine` (default 65% down the viewport) — this catches long sections
 *      and the final section whose bottom may never reach the trigger band.
 *
 * "active" is the topmost section whose top is above the activation line.
 */
export function useScrollSpy(ids: string[], options?: { rootMargin?: string }) {
  const [active, setActive] = useState<string>(ids[0] ?? "");
  const [read, setRead] = useState<Set<string>>(() => new Set());

  // `ids` may be a fresh array each render; derive a stable string key so the
  // effect re-subscribes only when the actual section set changes.
  const idsKey = ids.join(",");

  useEffect(() => {
    const idsArr = idsKey ? idsKey.split(",") : [];
    if (typeof window === "undefined" || idsArr.length === 0) return;

    const elements = idsArr
      .map((id) => document.getElementById(id))
      .filter((el): el is HTMLElement => el !== null);
    if (elements.length === 0) return;

    const rootMargin = options?.rootMargin ?? "-45% 0px -50% 0px";
    // A section counts as "read" once its top crosses this far down the viewport.
    const readLine = () => window.innerHeight * 0.7;

    // --- Signal 1: IntersectionObserver (visibility → read + active) ---
    const observer = new IntersectionObserver(
      (entries) => {
        const newlyRead: string[] = [];
        for (const entry of entries) {
          if (entry.isIntersecting) newlyRead.push(entry.target.id);
        }
        if (newlyRead.length > 0) {
          // Always allocate a fresh Set when there's any addition so React
          // re-renders and derived values (e.g. the progress %) stay in sync.
          setRead((prev) => {
            let added = false;
            const next = new Set(prev);
            for (const id of newlyRead) {
              if (!next.has(id)) {
                next.add(id);
                added = true;
              }
            }
            return added ? next : prev;
          });
        }

        const intersecting = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (intersecting.length > 0) {
          setActive(intersecting[0].target.id);
        }
      },
      { rootMargin, threshold: [0, 0.25, 0.5, 1] },
    );
    for (const el of elements) observer.observe(el);

    // --- Signal 2: scroll-based active + read fallback ---
    const onScroll = () => {
      const line = readLine();
      let current = idsArr[0];
      const crossed: string[] = [];
      for (const id of idsArr) {
        const el = document.getElementById(id);
        if (!el) continue;
        const rect = el.getBoundingClientRect();
        const top = rect.top;
        if (top <= line) {
          current = id;
          crossed.push(id);
        }
        // Also count a section as read once its bottom edge is on screen —
        // catches short final sections whose top never reaches the read line
        // before the page runs out of scroll room.
        if (rect.bottom > 0 && rect.bottom <= window.innerHeight) {
          crossed.push(id);
        }
      }
      setActive((prev) => (prev === current ? prev : current));
      if (crossed.length > 0) {
        setRead((prev) => {
          let added = false;
          const next = new Set(prev);
          for (const id of crossed) {
            if (!next.has(id)) {
              next.add(id);
              added = true;
            }
          }
          return added ? next : prev;
        });
      }

      // Close to the bottom of the page, mark every remaining section read so
      // the progress bar can reach 100% even when the final section is short or
      // never fully crosses the read line. Triggers within one viewport of the
      // end — generous, since reaching absolute bottom is unreliable on mobile
      // and in embedded browsers (overscroll/bounce can hide the last pixels).
      const distanceFromBottom =
        document.body.scrollHeight - (window.innerHeight + window.scrollY);
      if (distanceFromBottom < window.innerHeight * 0.35) {
        setRead((prev) => {
          if (prev.size >= idsArr.length) return prev;
          return new Set(idsArr);
        });
      }
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);

    return () => {
      observer.disconnect();
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [idsKey, options?.rootMargin]);

  return { active, read };
}

/** Convenience: fraction of sections read (0..1), for the progress checklist. */
export function useReadProgress(ids: string[]) {
  const { read } = useScrollSpy(ids);
  return ids.length === 0 ? 0 : Math.min(1, read.size / ids.length);
}
