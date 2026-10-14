"use client";

import { Moon, Sun } from "lucide-react";

import { useTheme } from "@/components/ThemeProvider";
import { cn } from "@/lib/utils";

/**
 * Compact theme control — a single icon button: the sun in light mode, the
 * moon in dim; clicking swaps. Icons live directly in the control (no track).
 */
export function ThemeToggle({ className = "" }: { className?: string }) {
  const { theme, setTheme } = useTheme();
  const isDim = theme === "dim";

  return (
    <button
      type="button"
      onClick={() => setTheme(isDim ? "light" : "dim")}
      aria-label={isDim ? "Switch to light mode" : "Switch to dim mode"}
      className={cn(
        "flex size-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40",
        className,
      )}
    >
      {isDim
        ? <Moon size={15} strokeWidth={2} aria-hidden />
        : <Sun size={15} strokeWidth={2} aria-hidden />}
    </button>
  );
}
