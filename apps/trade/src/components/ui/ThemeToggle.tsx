"use client";

import { Moon, Sun } from "lucide-react";

import { useTheme } from "@/components/ThemeProvider";
import { cn } from "@/lib/utils";

/**
 * Light / dim theme switcher — a modern two-segment control: a pill track
 * with Sun and Moon segments; the active segment is a raised canvas chip.
 * The same switcher pattern is used for every theme control (header and the
 * account menu's Dim mode row).
 */
export function ThemeToggle({ className = "" }: { className?: string }) {
  const { theme, setTheme } = useTheme();
  const isDim = theme === "dim";

  const segment = (dim: boolean, label: string, Icon: typeof Sun) => (
    <button
      type="button"
      onClick={() => setTheme(dim ? "dim" : "light")}
      aria-label={label}
      aria-pressed={isDim === dim}
      className={cn(
        "flex h-7 flex-1 items-center justify-center rounded-full transition-all duration-150 focus-visible:outline-2 focus-visible:outline-brand",
        isDim === dim ? "bg-canvas text-text shadow-sm" : "text-text-muted hover:text-text",
      )}
    >
      <Icon size={13} strokeWidth={2} aria-hidden />
    </button>
  );

  return (
    <div
      role="group"
      aria-label="Theme"
      className={cn("flex h-8 items-center gap-0.5 rounded-full bg-panel-2 p-0.5", className)}
    >
      {segment(false, "Switch to light mode", Sun)}
      {segment(true, "Switch to dim mode", Moon)}
    </div>
  );
}
