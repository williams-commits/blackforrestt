"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";

/**
 * Slim route-transition progress bar (NProgress-style, zero dependencies).
 *
 * Starts when the user clicks an internal <a> link, trickles toward 90%,
 * and completes when the pathname changes (or times out after 8s so it can
 * never get stuck). External links (e.g. apex ↔ trade subdomain), hash-only
 * jumps, downloads, and modified clicks (cmd/ctrl-click → new tab) are
 * ignored. Mounted once in the root layout — works across the whole app.
 */
export function TopProgressBar() {
  const pathname = usePathname();
  const [progress, setProgress] = useState<number | null>(null);
  const trickleRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const stopTrickle = () => {
    if (trickleRef.current) clearInterval(trickleRef.current);
    trickleRef.current = null;
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = null;
  };

  // Complete when navigation finishes (pathname changed).
  useEffect(() => {
    if (progress === null) return;
    stopTrickle();
    setProgress(100);
    const fade = setTimeout(() => setProgress(null), 300);
    return () => clearTimeout(fade);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  // Global click interception — no need to wrap every <Link> in the app.
  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      // NOTE: do NOT early-return on event.defaultPrevented — Next.js <Link>
      // intercepts clicks with preventDefault() before this document-level
      // listener runs, so Link navigations would never start the bar.
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const anchor = (event.target as HTMLElement | null)?.closest?.("a");
      if (!anchor || anchor.target === "_blank" || anchor.hasAttribute("download")) return;
      const href = anchor.getAttribute("href");
      if (!href || href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:")) return;

      let url: URL;
      try {
        url = new URL(href, window.location.href);
      } catch {
        return;
      }
      // Cross-origin (apex ↔ trade subdomain) — the browser handles it; skip.
      if (url.origin !== window.location.origin) return;
      // Same page — nothing to indicate.
      if (
        url.pathname === window.location.pathname &&
        url.search === window.location.search
      ) return;

      // Start the bar.
      stopTrickle();
      setProgress(12);
      let value = 12;
      trickleRef.current = setInterval(() => {
        // Decelerating trickle toward 90% — never reaches 100 until real nav.
        value += Math.max(0.5, (90 - value) * 0.12);
        setProgress(Math.min(value, 90));
      }, 120);
      // Safety valve: if navigation never completes, resolve the bar anyway.
      timeoutRef.current = setTimeout(() => {
        stopTrickle();
        setProgress(100);
        setTimeout(() => setProgress(null), 300);
      }, 8_000);
    };

    document.addEventListener("click", onClick);
    return () => {
      document.removeEventListener("click", onClick);
      stopTrickle();
    };
  }, []);

  if (progress === null) return null;

  return (
    <div aria-hidden className="pointer-events-none fixed inset-x-0 top-0 z-100 h-0.5">
      <div
        className="h-full bg-brand transition-[width,opacity] duration-200 ease-out"
        style={{
          width: `${progress}%`,
          opacity: progress === 100 ? 0 : 1,
          boxShadow: "0 0 8px var(--color-brand)",
        }}
      />
    </div>
  );
}
