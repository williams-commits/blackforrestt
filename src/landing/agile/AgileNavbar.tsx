"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Menu, X, ChevronDown, LogIn, UserPlus } from "lucide-react";
import { AgileMark } from "./AgileMark";
import { LanguageSwitcher } from "@/components/ui/LanguageSwitcher";
import type { NavigationContent } from "@/content/contracts";

/**
 * Agile enterprise navigation — the primary brand's navbar STRUCTURE (grouped
 * dropdown menus over the shared content routes, mobile accordion sheet)
 * dressed in the Agile dark-institutional system: deep translucent bar,
 * hairline dropdown panels, mint hover accents, Inter voice. The same bar
 * serves the landing and every interior page; the content package bakes the
 * quick-link anchors per context (`onLanding`).
 *
 * ALL labels arrive as the typed NavigationContent contract from the agile
 * domain content package — this component no longer fetches translations.
 */
export function AgileNavbar({ content }: { content: NavigationContent }) {
  const [open, setOpen] = useState<string | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [mobileGroup, setMobileGroup] = useState<string | null>(null);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Close everything on Escape.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setOpen(null);
      setMobileOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Lock body scroll behind the mobile sheet.
  useEffect(() => {
    if (!mobileOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [mobileOpen]);

  return (
    <header
      className={`sticky top-0 z-50 border-b transition-colors duration-300 ${
        scrolled || mobileOpen
          ? "border-white/10 bg-[#0d0d0f]/80 backdrop-blur-xl backdrop-saturate-150 shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_16px_40px_-24px_rgba(0,0,0,0.9)]"
          : "border-transparent bg-transparent"
      }`}
      onMouseLeave={() => setOpen(null)}
    >
      <nav className="ag-container flex h-16 items-center gap-6" aria-label={content.ariaLabel}>
        {/* The mark renders its own home link — never wrap it in another. */}
        <AgileMark className="shrink-0" />

        {/* Landing-section quick links + grouped content menus */}
        <div className="hidden min-w-0 items-center gap-1 lg:flex">
          {content.quickLinks.map((link) => (
            <Link
              key={link.anchor}
              href={link.anchor}
              className="rounded-md px-3 py-2 text-[13px] font-medium text-[#a9a9ae] transition-colors hover:text-[#f1f3ef]"
            >
              {link.label}
            </Link>
          ))}

          {content.groups.map((group) => (
            <div key={group.key} className="relative" onMouseEnter={() => setOpen(group.key)}>
              <button
                type="button"
                aria-expanded={open === group.key}
                onClick={() => setOpen((value) => (value === group.key ? null : group.key))}
                className="flex items-center gap-1.5 rounded-md px-3 py-2 text-[13px] font-medium text-[#a9a9ae] transition-colors hover:text-[#f1f3ef]"
              >
                {group.label}
                <ChevronDown
                  size={12}
                  strokeWidth={2.5}
                  aria-hidden
                  className={`text-[#75757b] transition-transform duration-200 ${open === group.key ? "rotate-180" : ""}`}
                />
              </button>
              {open === group.key && (
                <div className="absolute left-0 top-full pt-2">
                  <div className="min-w-52 rounded-xl border border-white/10 bg-[#141417] py-2 shadow-[0_28px_70px_-24px_rgba(0,0,0,0.9)]">
                    {group.links.map((item) => (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={() => setOpen(null)}
                        className="block px-4 py-2.5 text-[13px] text-[#a9a9ae] transition-colors hover:bg-white/5 hover:text-[#f0b90b]"
                      >
                        {item.label}
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="ml-auto flex items-center gap-3">
          <span className="hidden lg:inline-flex">
            <LanguageSwitcher />
          </span>
          <div className="hidden lg:inline-flex items-center gap-3">
            <Link
              href={content.loginHref}
              className="ag-btn ag-btn-ghost hidden min-h-0! px-4 py-2.5 text-[13px] lg:inline-flex"
            >
              {content.loginLabel}
            </Link>
            <Link
              href={content.registerHref}
              className="ag-btn ag-btn-primary hidden min-h-0! px-4 py-2.5 text-[13px] lg:inline-flex"
            >
              {content.registerLabel}
            </Link>
          </div>
          {/* Mobile actions are icon-only (below lg); the text pills are a
              desktop-only treatment, matching the language switcher. */}
          <Link
            href={content.loginHref}
            aria-label={content.loginLabel}
            title={content.loginLabel}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/12 text-[#a9a9ae] transition-colors hover:border-[#f0b90b]/50 hover:text-[#f0b90b] lg:hidden"
          >
            <LogIn size={17} strokeWidth={1.75} aria-hidden />
          </Link>
          <Link
            href={content.registerHref}
            aria-label={content.registerLabel}
            title={content.registerLabel}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-[#f0b90b] text-[#0d0d0f] transition-transform hover:scale-105 motion-reduce:transition-none lg:hidden"
          >
            <UserPlus size={16} strokeWidth={2} aria-hidden />
          </Link>
          <button
            type="button"
            aria-label={mobileOpen ? content.menuToggle.close : content.menuToggle.open}
            aria-expanded={mobileOpen}
            onClick={() => setMobileOpen((value) => !value)}
            className="flex h-10 w-10 items-center justify-center rounded-lg border border-white/10 text-[#f1f3ef] transition-colors hover:border-white/25 lg:hidden"
          >
            {mobileOpen ? <X size={18} strokeWidth={2} aria-hidden /> : <Menu size={18} strokeWidth={2} aria-hidden />}
          </button>
        </div>
      </nav>

      {/* Mobile accordion sheet */}
      {mobileOpen && (
        <div className="fixed inset-x-0 top-16 z-50 h-[calc(100dvh-4rem)] overflow-y-auto border-t border-white/10 bg-[#0d0d0f] lg:hidden">
          <nav className="ag-container flex min-h-full flex-col pt-3" aria-label={content.ariaLabel}>
            {/* Landing sections — only meaningful from the landing itself */}
            {content.onLanding && (
              <div className="flex gap-3 border-b border-white/8 pb-4">
                {content.quickLinks.map((link) => (
                  <Link
                    key={link.anchor}
                    href={link.anchor}
                    onClick={() => setMobileOpen(false)}
                    className="ag-btn ag-btn-ghost min-h-0! flex-1 py-2.5 text-[13px]"
                  >
                    {link.label}
                  </Link>
                ))}
              </div>
            )}

            {content.groups.map((group) => {
              const expanded = mobileGroup === group.key;
              return (
                <section key={group.key} className="border-b border-white/8">
                  <button
                    type="button"
                    aria-expanded={expanded}
                    onClick={() => setMobileGroup((value) => (value === group.key ? null : group.key))}
                    className="flex w-full items-center justify-between py-4 text-left text-[14px] font-semibold text-[#f1f3ef]"
                  >
                    {group.label}
                    <ChevronDown
                      size={14}
                      strokeWidth={2.5}
                      aria-hidden
                      className={`text-[#75757b] transition-transform duration-200 ${expanded ? "rotate-180" : ""}`}
                    />
                  </button>
                  {expanded && (
                    <div className="grid gap-0.5 pb-3">
                      {group.links.map((item) => (
                        <Link
                          key={item.href}
                          href={item.href}
                          onClick={() => setMobileOpen(false)}
                          className="rounded-md px-3 py-2.5 text-[13.5px] text-[#a9a9ae] transition-colors hover:bg-white/5 hover:text-[#f0b90b]"
                        >
                          {item.label}
                        </Link>
                      ))}
                    </div>
                  )}
                </section>
              );
            })}

            <div className="mt-auto space-y-3 pb-[calc(env(safe-area-inset-bottom)+1.5rem)] pt-6">
              <div className="flex justify-center">
                <LanguageSwitcher />
              </div>
              <div className="flex gap-3">
                <Link href={content.loginHref} onClick={() => setMobileOpen(false)} className="ag-btn ag-btn-ghost flex-1">
                  {content.loginLabel}
                </Link>
                <Link href={content.registerHref} onClick={() => setMobileOpen(false)} className="ag-btn ag-btn-primary flex-1">
                  {content.registerLabel}
                </Link>
              </div>
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}
