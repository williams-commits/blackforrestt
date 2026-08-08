"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";

type Theme = "light" | "dim";

interface ThemeContextValue {
  theme: Theme;
  toggle: () => void;
  setTheme: (t: Theme) => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: "light",
  toggle: () => {},
  setTheme: () => {},
});

export const STORAGE_KEY = "blckforest-theme";

/**
 * Site-wide light / dim theme. The active theme is the `.dim` class on
 * `<html>`; the underlying design tokens are redefined under that class in
 * globals.css, so every screen reskins without per-component work.
 *
 * The class is applied pre-paint by an inline script in layout.tsx to avoid a
 * flash. This provider keeps React state in sync for the toggle control and
 * persists the choice to localStorage.
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("light");

  // Sync with the class the no-FOUC script already applied.
  useEffect(() => {
    const current: Theme = document.documentElement.classList.contains("dim") ? "dim" : "light";
    setThemeState(current);
  }, []);

  const setTheme = useCallback((t: Theme) => {
    setThemeState(t);
    const root = document.documentElement;
    if (t === "dim") root.classList.add("dim");
    else root.classList.remove("dim");
    try {
      localStorage.setItem(STORAGE_KEY, t);
    } catch {
      /* storage may be unavailable (private mode) — non-fatal */
    }
  }, []);

  const toggle = useCallback(() => {
    setTheme(theme === "dim" ? "light" : "dim");
  }, [theme, setTheme]);

  return (
    <ThemeContext.Provider value={{ theme, toggle, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

/** Access the current theme and toggle. */
export function useTheme() {
  return useContext(ThemeContext);
}
