"use client";

import { useEffect, useState } from "react";

/**
 * Generic media-query state. The initial value is what SSR and the first
 * client render use — pick it so the pre-hydration paint matches the most
 * common viewport; the real answer arrives in an effect. The plain `resize`
 * listener is a backstop for embedded webviews that skip matchMedia change
 * events on programmatic viewport changes.
 */
export function useMediaQuery(query: string, initial = false): boolean {
  const [matches, setMatches] = useState(initial);
  useEffect(() => {
    const mql = window.matchMedia(query);
    const update = () => setMatches(mql.matches);
    update();
    mql.addEventListener("change", update);
    window.addEventListener("resize", update);
    return () => {
      mql.removeEventListener("change", update);
      window.removeEventListener("resize", update);
    };
  }, [query]);
  return matches;
}

/**
 * Desktop breakpoint helper for dual-surface controls (the bell dropdown,
 * table toolbars). Desktop-first initial: SSR renders the desktop variant —
 * nothing panel-shaped exists until a click, so there is no flash — and
 * small screens correct on hydration.
 */
export function useIsDesktop(breakpoint = "(min-width: 640px)"): boolean {
  return useMediaQuery(breakpoint, true);
}
