"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Logo } from "@/components/trade/Logo";

interface MenuGroup {
  label: string;
  items: { label: string; href: string }[];
}

const MENUS: MenuGroup[] = [
  {
    label: "Company",
    items: [
      { label: "About Us", href: "/about" },
      { label: "Contacts", href: "/contact" },
    ],
  },
  {
    label: "Tools",
    items: [
      { label: "Informers", href: "/tools/informers" },
      { label: "Calendars", href: "/tools/calendars" },
      { label: "Calculators", href: "/tools/calculators" },
      { label: "Signals", href: "/tools/signals" },
    ],
  },
  {
    label: "Analytics",
    items: [
      { label: "News", href: "/analytics/news" },
      { label: "Technical Analysis", href: "/analytics/technical" },
      { label: "Fundamental Analysis", href: "/analytics/fundamental" },
      { label: "Determining trend potential", href: "/analytics/trend" },
    ],
  },
  {
    label: "Education",
    items: [
      { label: "Beginners guide", href: "/education/beginners" },
      { label: "Advanced guide", href: "/education/advanced" },
      { label: "Beginners VODs", href: "/education/beginners-vods" },
      { label: "Advanced VODs", href: "/education/advanced-vods" },
      { label: "Cryptocurrency VODs", href: "/education/crypto-vods" },
    ],
  },
];

/** Responsive marketing navbar with desktop dropdowns and a mobile navigation sheet. */
export function Navbar() {
  const pathname = usePathname();
  const [open, setOpen] = useState<string | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [mobileGroup, setMobileGroup] = useState<string | null>(null);

  useEffect(() => {
    setMobileOpen(false);
    setMobileGroup(null);
  }, [pathname]);

  useEffect(() => {
    if (!mobileOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMobileOpen(false);
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [mobileOpen]);

  return (
    <header
      className="sticky top-0 z-40 border-b border-border bg-canvas/95 backdrop-blur"
      onMouseLeave={() => setOpen(null)}
    >
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-2 px-3 sm:px-4 lg:px-8">
        <div className="min-w-0 shrink-0 lg:mr-6">
          <Logo className="gap-1.5 sm:gap-2" />
        </div>

        <nav className="hidden items-center gap-1 lg:flex" aria-label="Primary navigation">
          {MENUS.map((menu) => (
            <div key={menu.label} className="relative" onMouseEnter={() => setOpen(menu.label)}>
              <button
                type="button"
                aria-expanded={open === menu.label}
                className="flex items-center gap-1 px-3 py-2 text-sm font-medium text-text transition-colors hover:text-brand"
                onClick={() => setOpen((value) => (value === menu.label ? null : menu.label))}
              >
                {menu.label}
                <Chevron open={open === menu.label} />
              </button>
              {open === menu.label ? (
                <div className="absolute left-0 top-full pt-1">
                  <div className="min-w-[220px] rounded-lg border border-border bg-canvas py-2 shadow-card">
                    {menu.items.map((item) => (
                      <Link
                        key={item.href}
                        href={item.href}
                        className="block px-4 py-2 text-sm text-text-muted transition-colors hover:bg-panel hover:text-brand"
                      >
                        {item.label}
                      </Link>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          ))}
        </nav>

        <div className="ml-auto flex min-w-0 items-center gap-1.5 sm:gap-2 lg:gap-4">
          <div className="hidden items-center gap-1 text-xs md:flex">
            <button type="button" className="rounded bg-panel-2 px-2 py-1 font-semibold text-text">EN</button>
            <button type="button" className="rounded px-2 py-1 text-text-muted hover:text-text">FR</button>
          </div>
          <Link
            href="/login"
            className="hidden px-2 py-2 text-sm font-medium text-text transition-colors hover:text-brand sm:inline-flex lg:px-4"
          >
            Log in
          </Link>
          <Link
            href="/register"
            className="hidden rounded bg-brand px-3 py-2 text-xs font-semibold text-white transition hover:brightness-110 sm:inline-flex lg:px-4 lg:text-sm"
          >
            Open Account
          </Link>
          <button
            type="button"
            aria-label={mobileOpen ? "Close navigation menu" : "Open navigation menu"}
            aria-expanded={mobileOpen}
            aria-controls="mobile-navigation"
            onClick={() => setMobileOpen((value) => !value)}
            className="inline-flex h-10 w-10 items-center justify-center rounded border border-border text-text hover:bg-panel-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand lg:hidden"
          >
            {mobileOpen ? <CloseIcon /> : <MenuIcon />}
          </button>
        </div>
      </div>

      {mobileOpen ? (
        <div id="mobile-navigation" className="fixed inset-x-0 top-16 z-50 h-[calc(100dvh-4rem)] overflow-y-auto border-t border-border bg-canvas lg:hidden">
          <nav className="mx-auto flex min-h-full max-w-3xl flex-col px-4 pb-[calc(env(safe-area-inset-bottom)+1.5rem)] pt-3" aria-label="Mobile navigation">
            {MENUS.map((menu) => {
              const expanded = mobileGroup === menu.label;
              return (
                <section key={menu.label} className="border-b border-border-soft">
                  <button
                    type="button"
                    aria-expanded={expanded}
                    onClick={() => setMobileGroup((value) => (value === menu.label ? null : menu.label))}
                    className="flex w-full items-center justify-between py-4 text-left text-sm font-semibold text-text"
                  >
                    {menu.label}
                    <Chevron open={expanded} />
                  </button>
                  {expanded ? (
                    <div className="grid gap-1 pb-3 sm:grid-cols-2">
                      {menu.items.map((item) => (
                        <Link
                          key={item.href}
                          href={item.href}
                          className="rounded px-3 py-3 text-sm text-text-muted hover:bg-panel-2 hover:text-brand"
                        >
                          {item.label}
                        </Link>
                      ))}
                    </div>
                  ) : null}
                </section>
              );
            })}

            <div className="mt-auto grid gap-2 pt-6 sm:grid-cols-2">
              <Link href="/login" className="rounded border border-border px-4 py-3 text-center text-sm font-semibold text-text hover:border-brand">
                Log in
              </Link>
              <Link href="/register" className="rounded bg-brand px-4 py-3 text-center text-sm font-semibold text-white hover:brightness-110">
                Open Account
              </Link>
            </div>
          </nav>
        </div>
      ) : null}
    </header>
  );
}

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      className={`shrink-0 text-text-faint transition-transform ${open ? "rotate-180" : ""}`}
      aria-hidden="true"
    >
      <path d="m6 9 6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function MenuIcon() {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16" /></svg>;
}

function CloseIcon() {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" /></svg>;
}
