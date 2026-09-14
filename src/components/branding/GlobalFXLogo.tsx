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
      <path
        d="M24.7 11.2a10.4 10.4 0 1 0 0 9.6l-3.4-2.4a6.25 6.25 0 1 1 0-4.8h-4.1v3.2h7.5v-5.6h-3.2v2.4h-2.1a6.25 6.25 0 0 1 5.3 2.9Z"
        fill="#0d0d0f"
        fillRule="evenodd"
      />
      <path d="M10.2 9.2h3.3v13.6h-3.3zM13.5 9.2h8.1v3.2h-8.1zM13.5 14.3h6.2v3.1h-6.2z" fill="#0d0d0f" />
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
      <span className={`${textSize} font-bold leading-none tracking-[-0.035em] ${inverted ? "text-white" : "text-[#151517]"}`}>
        Global<span className="text-[#f0b90b]">FX</span>
      </span>
      {children}
    </span>
  );

  if (!href) return content;
  if (external) return <a href={href} aria-label="GlobalFX — Global Forex Services">{content}</a>;
  return <Link href={href} aria-label="GlobalFX — Global Forex Services">{content}</Link>;
}
