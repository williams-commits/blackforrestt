"use client";

import { type ButtonHTMLAttributes, forwardRef } from "react";

type Variant = "buy" | "sell" | "default" | "ghost" | "brand";
type Size = "sm" | "md";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  loadingLabel?: string;
}

const variants: Record<Variant, string> = {
  buy: "bg-up text-white hover:brightness-110 font-semibold",
  sell: "bg-down text-white hover:brightness-110 font-semibold",
  default: "bg-panel-3 text-text hover:bg-border border border-border",
  ghost: "bg-transparent text-text-muted hover:text-text hover:bg-panel-2",
  brand: "bg-brand text-white hover:brightness-110 font-semibold",
};

const sizes: Record<Size, string> = {
  sm: "h-8 px-3 text-xs",
  md: "h-10 px-4 text-sm",
};

/** Themed button with safe form defaults and an announced loading state. */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = "default",
    size = "md",
    loading = false,
    loadingLabel = "Processing",
    className = "",
    children,
    disabled,
    type = "button",
    ...rest
  },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={`inline-flex items-center justify-center gap-2 rounded transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer ${variants[variant]} ${sizes[size]} ${className}`}
      {...rest}
    >
      {loading ? (
        <>
          <span
            aria-hidden="true"
            className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent"
          />
          <span className="sr-only">{loadingLabel}</span>
        </>
      ) : null}
      {/* Flex wrapper: Tailwind preflight forces svg to display:block, which
          stacks a leading icon above the label inside a plain inline span. */}
      <span aria-hidden={loading || undefined} className="inline-flex items-center gap-1.5">{children}</span>
    </button>
  );
});
