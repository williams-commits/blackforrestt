"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useBrand } from "@/components/providers";

/**
 * blckforest wordmark with a simple tree-mark glyph.
 *
 * On the trade subdomain, the logo links to the apex domain via a plain `<a>`
 * (full page navigation) to avoid Next.js RSC prefetching, which triggers CORS
 * errors when the trade→apex domain redirect happens.
 *
 * On the apex domain (or localhost), it uses `<Link>` for client-side routing.
 *
 * The href is computed in useEffect (not during render) to avoid React
 * hydration mismatch (#418) — the server always renders `href="/"` and the
 * client updates it after mount.
 */
export function Logo({
  className = "",
  inverted = false,
}: {
  className?: string;
  /** Use on dark backgrounds: renders the wordmark in white instead of dark. */
  inverted?: boolean;
}) {
  const brand = useBrand();
  const [href, setHref] = useState("/");
  const [external, setExternal] = useState(false);

  useEffect(() => {
    const host = window.location.hostname;
    const parts = host.split(".");
    // On the trade subdomain (e.g. trade.blackforrestt.com), link to apex.
    if (parts.length >= 3 && parts[0] !== "www") {
      setHref(`https://${parts.slice(1).join(".")}`);
      setExternal(true);
    }
  }, []);

  const cls = `flex items-center gap-2 select-none ${className}`;
  const glyph = brand.glyph;
  // Bracket lockup (logoLockup: "brackets"): the glyph's two bracket paths
  // flank a lowercase word — the config-driven agile app mark. The brackets
  // crop to their own bounding boxes (path.box) so they sit tight against
  // the word; color follows the same ink/accent rule as the glyph.
  const lockupPaths = glyph?.paths ?? [];
  const isLockup =
    brand.logoLockup === "brackets" && brand.logoWord && lockupPaths.length >= 2 && lockupPaths[0].box && lockupPaths[1].box;
  const inner = isLockup ? (
    <>
      <svg
        width="10"
        height="16"
        viewBox={lockupPaths[0].box}
        aria-hidden="true"
        style={brand.accentColor ? { color: brand.accentColor } : undefined}
      >
        <path d={lockupPaths[0].d} fill={lockupPaths[0].fill === "ink" ? "currentColor" : "var(--color-brand)"} />
      </svg>
      <span
        className={`text-[22px] font-bold leading-none tracking-widest ${inverted ? "text-white" : ""}`}
        style={brand.accentColor && !inverted ? { color: brand.accentColor } : undefined}
      >
        {brand.logoWord}
      </span>
      <svg
        width="10"
        height="16"
        viewBox={lockupPaths[1].box}
        aria-hidden="true"
        style={brand.accentColor ? { color: brand.accentColor } : undefined}
      >
        <path d={lockupPaths[1].d} fill={lockupPaths[1].fill === "ink" ? "currentColor" : "var(--color-brand)"} />
      </svg>
    </>
  ) : (
    <>
      <svg
        width="22"
        height="22"
        viewBox={glyph?.viewBox ?? "0 0 24 24"}
        fill="none"
        aria-hidden="true"
        style={brand.accentColor ? { color: brand.accentColor } : undefined}
      >
        {glyph
          ? glyph.paths.map((path, index) => (
              <path key={index} d={path.d} fill={path.fill === "ink" ? "currentColor" : "var(--color-brand)"} />
            ))
          : (
            <>
              <path d="M12 1.5 7.5 9H10l-3 5.5H9.5L7 19h10l-2.5-4.5H17l-3-5.5h2.5L12 1.5Z" fill="var(--color-brand)" />
              <rect x="11" y="19" width="2" height="3.5" fill="var(--color-brand)" />
            </>
          )}
      </svg>
      <span className="text-base font-semibold tracking-tight">
        <span className={inverted ? "text-white" : "text-text"}>{brand.wordmark[0]}</span>
        <span className="text-brand">{brand.wordmark[1]}</span>
      </span>
    </>
  );

  if (external) {
    return <a href={href} className={cls}>{inner}</a>;
  }
  return <Link href={href} className={cls}>{inner}</Link>;
}
