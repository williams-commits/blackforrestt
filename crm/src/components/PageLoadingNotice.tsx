"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

function isModifiedClick(event: MouseEvent) {
  return event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0;
}

function isSamePageHash(url: URL) {
  return url.pathname === window.location.pathname && url.search === window.location.search && url.hash;
}

export function PageLoadingNotice() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(false);
  const timeoutRef = useRef<number | null>(null);

  useEffect(() => {
    if (!loading) return;
    if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
    timeoutRef.current = window.setTimeout(() => setLoading(false), 250);
    return () => {
      if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
    };
  }, [loading, pathname, searchParams]);

  useEffect(() => {
    function showLoading() {
      if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
      setLoading(true);
    }

    function onClick(event: MouseEvent) {
      if (event.defaultPrevented || isModifiedClick(event)) return;
      const target = event.target instanceof Element ? event.target : null;
      const anchor = target?.closest("a[href]");
      if (!(anchor instanceof HTMLAnchorElement)) return;
      if (anchor.target && anchor.target !== "_self") return;
      if (anchor.hasAttribute("download")) return;

      const url = new URL(anchor.href, window.location.href);
      if (url.origin !== window.location.origin) return;
      if (isSamePageHash(url)) return;
      if (url.pathname === window.location.pathname && url.search === window.location.search) return;
      showLoading();
    }

    function onSubmit(event: SubmitEvent) {
      if (event.defaultPrevented) return;
      const form = event.target;
      if (!(form instanceof HTMLFormElement)) return;
      const method = (form.method || "get").toLowerCase();
      if (method !== "get" && method !== "post") return;
      showLoading();
    }

    document.addEventListener("click", onClick, true);
    document.addEventListener("submit", onSubmit, true);
    window.addEventListener("beforeunload", showLoading);
    return () => {
      document.removeEventListener("click", onClick, true);
      document.removeEventListener("submit", onSubmit, true);
      window.removeEventListener("beforeunload", showLoading);
    };
  }, []);

  return (
    <div className={`page-loading-notice ${loading ? "visible" : ""}`} aria-live="polite" aria-atomic="true">
      <div className="page-loading-notice-bar" aria-hidden />
      <span>Loading page…</span>
    </div>
  );
}
