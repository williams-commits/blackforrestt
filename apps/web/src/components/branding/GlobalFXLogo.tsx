import Link from "next/link";
import type { ReactNode } from "react";

export function GlobalFXLogo({
  className = "",
  size = "md",
  href = "/",
  external = false,
  inverted = false,
  ariaLabel,
  children,
}: {
  className?: string;
  size?: "sm" | "md" | "lg";
  href?: string;
  external?: boolean;
  inverted?: boolean;
  /** Accessible name — brand-agnostic override (e.g. the brand profile's name). */
  ariaLabel?: string;
  children?: ReactNode;
}) {
  const logoHeight = size === "lg" ? 38 : size === "sm" ? 24 : 30;
  const logoWidth = Math.round(logoHeight * 1.547);
  const logoSource = `/brand/logo.svg?theme=${inverted ? "dark" : "light"}`;
  const content = (
    <span className={`inline-flex select-none items-center ${className}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={logoSource}
        alt=""
        width={logoWidth}
        height={logoHeight}
        className="max-w-full object-contain"
        style={{ width: `${logoWidth}px`, height: `${logoHeight}px` }}
        draggable={false}
      />
      {children}
    </span>
  );

  // Brand-aware accessible name — the component is brand-agnostic, so a
  // second gbfxs family must not announce itself as GlobalFX.
  const label = ariaLabel ?? "Global Forex Services";
  if (!href) return content;
  if (external) return <a href={href} aria-label={label}>{content}</a>;
  return <Link href={href} aria-label={label}>{content}</Link>;
}
