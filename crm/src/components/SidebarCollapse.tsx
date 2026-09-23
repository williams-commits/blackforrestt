"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { Button } from "@/components/ui";
import { Icon } from "@/components/Icon";

/**
 * Shared icon-rail state: the desktop sidebar collapses to icons-only and the
 * toggle lives in the top bar beside the global search (mobile keeps the
 * off-canvas Sheet, so the toggle is desktop-only). Preference persists in
 * localStorage; SSR always renders expanded to keep hydration stable.
 */

const SidebarCollapseContext = createContext<{ collapsed: boolean; toggle: () => void }>({
  collapsed: false,
  toggle: () => {},
});

export function useSidebarCollapse() {
  return useContext(SidebarCollapseContext);
}

export function SidebarCollapseProvider({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  // The inline <head> script already applied data-sidebar="collapsed" before
  // paint (no flash); this just syncs React state with the stored preference.
  useEffect(() => {
    setCollapsed(localStorage.getItem("crm-sidebar") === "collapsed");
    setHydrated(true);
  }, []);

  // Persist + keep the html attribute in sync (the attribute drives the
  // pre-hydration CSS rule in globals.css).
  useEffect(() => {
    if (!hydrated) return;
    localStorage.setItem("crm-sidebar", collapsed ? "collapsed" : "expanded");
    document.documentElement.setAttribute("data-sidebar", collapsed ? "collapsed" : "");
  }, [collapsed, hydrated]);

  const toggle = useCallback(() => setCollapsed((prev) => !prev), []);

  return (
    <SidebarCollapseContext.Provider value={{ collapsed, toggle }}>
      {children}
    </SidebarCollapseContext.Provider>
  );
}

/** Collapse/expand button for the top bar, next to the global search. */
export function SidebarToggle() {
  const { collapsed, toggle } = useSidebarCollapse();
  const label = collapsed ? "Expand sidebar" : "Collapse sidebar";
  return (
    <Button
      variant="tertiary"
      size="icon-sm"
      onClick={toggle}
      aria-label={label}
      title={label}
      className="hidden shrink-0 lg:inline-flex"
    >
      <Icon name={collapsed ? "panel_left_open" : "panel_left_close"} size={16} />
    </Button>
  );
}
