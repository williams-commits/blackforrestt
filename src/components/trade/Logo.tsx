"use client";

import Link from "next/link";
import { useMemo } from "react";

/**
 * blckforest wordmark with a simple tree-mark glyph.
 *
 * On the trade subdomain, the logo links to the apex domain via a plain `<a>`
 * (full page navigation) to avoid Next.js RSC prefetching, which triggers CORS
 * errors when the trade→apex domain redirect happens.
 *
 * On the apex domain (or localhost), it uses `<Link>` for client-side routing.
 */
export function Logo({
  className = "",
  inverted = false,
}: {
  className?: string;
  /** Use on dark backgrounds: renders the wordmark in white instead of dark. */
  inverted?: boolean;
}) {
  const { href, external } = useMemo(() => {
    if (typeof window === "undefined") return { href: "/", external: false };
    const host = window.location.hostname;
    const parts = host.split(".");
    // On the trade subdomain (e.g. trade.blackforrestt.com), link to apex.
    if (parts.length >= 3 && parts[0] !== "www") {
      return { href: `https://${parts.slice(1).join(".")}`, external: true };
    }
    return { href: "/", external: false };
  }, []);

  const cls = `flex items-center gap-2 select-none ${className}`;
  const inner = (
    <>
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M12 1.5 7.5 9H10l-3 5.5H9.5L7 19h10l-2.5-4.5H17l-3-5.5h2.5L12 1.5Z" fill="var(--color-brand)" />
        <rect x="11" y="19" width="2" height="3.5" fill="var(--color-brand)" />
      </svg>
      <span className="text-base font-semibold tracking-tight">
        <span className={inverted ? "text-white" : "text-text"}>Black</span>
        <span className="text-brand">Forest</span>
      </span>
    </>
  );

  if (external) {
    return <a href={href} className={cls}>{inner}</a>;
  }
  return <Link href={href} className={cls}>{inner}</Link>;
}
