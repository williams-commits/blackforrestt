"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * Mobile menu state for the site navbars (shared Navbar, GbfxsNavbar):
 * the open/closed flag plus the two interaction invariants every
 * implementation used to duplicate — the page body must not scroll behind
 * the open sheet, and Escape closes it.
 */
export function useMobileMenu() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  const toggle = useCallback(() => setOpen((value) => !value), []);

  return { open, setOpen, toggle };
}
