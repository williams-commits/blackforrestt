import Link from "next/link";
import type { ReactNode } from "react";

export function GlobalFXLogo({
  className = "",
  size = "md",
  href = "/",
  external = false,
  inverted = false,
  children,
}: {
  className?: string;
  size?: "sm" | "md" | "lg";
  href?: string;
  external?: boolean;
  inverted?: boolean;
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

  if (!href) return content;
  if (external) return <a href={href} aria-label="GlobalFX — Global Forex Services">{content}</a>;
  return <Link href={href} aria-label="GlobalFX — Global Forex Services">{content}</Link>;
}
