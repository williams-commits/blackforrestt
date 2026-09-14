import Link from "next/link";
import type { ReactNode } from "react";

function GlobalFXIcon({ size }: { size: number }) {
  return (
    <svg
      aria-hidden="true"
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      focusable="false"
    >
      <rect width="32" height="32" rx="8" fill="var(--ag-accent, var(--color-brand, #f0b90b))" />
      <path d="M22.5 9.5a9 9 0 1 0 1.1 10.3" stroke="#0d0d0f" strokeWidth="3" strokeLinecap="round" />
      <path d="M23.5 16H17" stroke="#0d0d0f" strokeWidth="3" strokeLinecap="round" />
      <path d="M13 10.5v11M13 10.5h7M13 15.5h5.5" stroke="#0d0d0f" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

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
  const iconSize = size === "lg" ? 32 : size === "sm" ? 22 : 27;
  const textSize = size === "lg" ? "text-[25px]" : size === "sm" ? "text-[16px]" : "text-[20px]";
  const content = (
    <span className={`inline-flex select-none items-center gap-2 ${className}`}>
      <GlobalFXIcon size={iconSize} />
      <span className={`${textSize} font-bold leading-none tracking-[-0.035em] ${inverted ? "text-white" : "text-[#f1f1f3]"}`}>
        Global<span className="text-[#f0b90b]">FX</span>
      </span>
      {children}
    </span>
  );

  if (!href) return content;
  if (external) return <a href={href} aria-label="GlobalFX — Global Forex Services">{content}</a>;
  return <Link href={href} aria-label="GlobalFX — Global Forex Services">{content}</Link>;
}
