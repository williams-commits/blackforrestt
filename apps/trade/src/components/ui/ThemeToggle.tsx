"use client";

import { Moon, Sun } from "lucide-react";

import { useTheme } from "@/components/ThemeProvider";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

/**
 * Light / dim theme switcher on the shadcn Switch primitive. Sun and moon
 * flank the switch inside a tonal pill; the active side is tinted. The same
 * control serves the terminal header and the account menu.
 */
export function ThemeToggle({ className = "" }: { className?: string }) {
  const { theme, setTheme } = useTheme();
  const isDim = theme === "dim";

  return (
    <div
      role="group"
      aria-label="Theme"
      className={cn("flex h-8 items-center gap-2 rounded-full bg-panel-2 px-2.5", className)}
    >
      <Sun
        size={13}
        strokeWidth={2}
        aria-hidden
        className={cn("transition-colors", isDim ? "text-text-muted" : "text-text")}
      />
      <Switch
        checked={isDim}
        onCheckedChange={(checked) => setTheme(checked ? "dim" : "light")}
        aria-label={isDim ? "Switch to light mode" : "Switch to dim mode"}
      />
      <Moon
        size={13}
        strokeWidth={2}
        aria-hidden
        className={cn("transition-colors", isDim ? "text-text" : "text-text-muted")}
      />
    </div>
  );
}
