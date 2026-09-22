"use client";

import { useEffect, useState } from "react";
import { Icon } from "@/components/Icon";
import { Button } from "@/components/ui";

/**
 * Dark/light mode toggle — swaps CSS variables via `data-theme` on `<html>`,
 * persisted in localStorage.
 */
export function ThemeToggle() {
  const [dark, setDark] = useState<boolean | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem("crm-theme");
    const prefersDark = stored === "dark" || (!stored && window.matchMedia("(prefers-color-scheme: dark)").matches);
    setDark(prefersDark);
    document.documentElement.setAttribute("data-theme", prefersDark ? "dark" : "");
  }, []);

  function toggle() {
    const next = !(dark ?? document.documentElement.getAttribute("data-theme") === "dark");
    setDark(next);
    document.documentElement.setAttribute("data-theme", next ? "dark" : "");
    localStorage.setItem("crm-theme", next ? "dark" : "light");
  }

  const isDark = dark ?? false;

  return (
    <Button
      variant="secondary"
      size="icon"
      onClick={toggle}
      className="rounded-full text-muted-foreground"
      title={isDark ? "Switch to light mode" : "Switch to dark mode"}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
    >
      {isDark ? (
        <Icon name="sun" size={14} />
      ) : (
        <Icon name="moon" size={14} />
      )}
    </Button>
  );
}
