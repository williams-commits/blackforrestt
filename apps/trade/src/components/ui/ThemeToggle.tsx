"use client";

import { Moon, Sun } from "lucide-react";

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
  return <Sun size={14} strokeWidth={1.75} aria-hidden />;
}

function MoonIcon() {
  return <Moon size={14} strokeWidth={1.75} aria-hidden />;
}
