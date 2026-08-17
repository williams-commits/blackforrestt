"use client";

import { useTheme } from "@/components/ThemeProvider";
import { Tooltip } from "@/components/ui/Tooltip";

/**
 * Light / dim theme toggle. Compact icon button that matches the navbar and
 * floating-control surfaces. Renders an inline SVG to avoid extra assets.
 */
export function ThemeToggle({ className = "" }: { className?: string }) {
  const { theme, toggle } = useTheme();
  const isDim = theme === "dim";

  return (
    <Tooltip text={isDim ? "Light mode" : "Dim mode"} placement="bottom">
      <button
        type="button"
        onClick={toggle}
        aria-label={isDim ? "Switch to light mode" : "Switch to dim mode"}
        className={`inline-flex items-center justify-center h-9 w-9 rounded-md border border-border bg-canvas text-text-muted hover:text-text hover:bg-panel transition ${className}`}
      >
        {isDim ? <SunIcon /> : <MoonIcon />}
      </button>
    </Tooltip>
  );
}

function SunIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  );
}
