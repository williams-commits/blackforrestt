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
export const COOKIE_KEY = "blckforest-theme";

/**
 * Site-wide light / dim theme. The active theme is the `.dim` class on
 * `<html>`; the underlying design tokens are redefined under that class in
 * globals.css, so every screen reskins without per-component work.
 *
 * Storage is dual-layered so the choice persists across the two-domain
 * architecture (apex `blackforrestt.com` + trade subdomain `trade.*`):
 *   1. A cross-subdomain cookie (`domain=.blackforrestt.com`) — readable by
 *      both origins, used by the no-FOUC script before paint.
 *   2. localStorage — per-origin fast read for the client provider.
 *
 * The no-FOUC inline script in layout.tsx reads the cookie (not localStorage)
 * so the correct theme applies immediately on whichever subdomain the user
 * lands on.
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("light");

  // Sync with the class the no-FOUC script already applied.
  useEffect(() => {
    const current: Theme = document.documentElement.classList.contains("dim") ? "dim" : "light";
    setThemeState(current);
  }, []);

  const writeTheme = useCallback((t: Theme) => {
    const root = document.documentElement;
    if (t === "dim") root.classList.add("dim");
    else root.classList.remove("dim");
    // localStorage (per-origin fast read)
    try {
      localStorage.setItem(STORAGE_KEY, t);
    } catch {
      /* private mode — non-fatal */
    }
    // Cross-subdomain cookie (shared across apex + trade.*)
    const domain = window.location.hostname.split(".").slice(-2).join(".");
    const cookieDomain = domain.includes(".") ? `; domain=.${domain}` : "";
    document.cookie = `${COOKIE_KEY}=${t}; max-age=31536000; path=/${cookieDomain}; samesite=lax`;
  }, []);

  const setTheme = useCallback((t: Theme) => {
    setThemeState(t);
    writeTheme(t);
  }, [writeTheme]);

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
