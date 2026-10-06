"use client";

import { type InputHTMLAttributes, forwardRef } from "react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  suffix?: string;
}

/** Compact numeric-friendly input used in the order form. */
export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { className = "", suffix, ...rest },
  ref,
) {
  return (
    <div className="relative flex items-center">
      <input
        ref={ref}
        className={`h-9 w-full rounded border border-border bg-canvas px-2 text-sm text-text outline-none placeholder:text-text-faint focus:border-brand focus-visible:ring-1 focus-visible:ring-brand tnum ${suffix ? "pr-12" : ""} ${className}`}
        {...rest}
      />
      {suffix ? (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute right-2 select-none text-xs text-text-muted"
        >
          {suffix}
        </span>
      ) : null}
    </div>
  );
});
