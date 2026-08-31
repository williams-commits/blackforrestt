"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Menu, X } from "lucide-react";
import { AgileMark } from "./AgileMark";
import { clientTradeUrl } from "@/lib/branding";

/**
 * Slim dark navigation for the Agile template: logo, anchor links into the
 * landing sections, language switch, and the two-tier auth actions
 * (outlined pill + green pill). Collapses to a hamburger sheet on mobile.
 */
export function AgileNavbar() {
  const t = useTranslations("agile.nav");
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Close the mobile sheet on Escape.
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const links = [
    { href: "#markets", label: t("markets") },
    { href: "#platform", label: t("platform") },
    { href: "#value", label: t("pricing") },
    { href: "/analytics/technical", label: t("analytics") },
    { href: "/education/beginners", label: t("education") },
    { href: "/about", label: t("company") },
  ];

  return (
    <header
      className={`sticky top-0 z-50 border-b transition-colors duration-300 ${
        scrolled
          ? "border-white/10 bg-[#0d100f]/65 shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_10px_30px_-18px_rgba(0,0,0,0.9)] backdrop-blur-xl backdrop-saturate-150"
          : "border-transparent bg-transparent"
      }`}
      style={{ borderColor: scrolled ? "rgba(255,255,255,0.12)" : undefined }}
    >
      <nav className="ag-container flex h-16 items-center justify-between gap-6" aria-label="Primary">
        {/* The mark renders its own home link — never wrap it in another. */}
        <AgileMark className="shrink-0" />

        <ul className="hidden items-center gap-7 lg:flex">
          {links.map((link) => (
            <li key={link.href}>
              <Link
                href={link.href}
                className="text-[13.5px] font-medium text-[#a7ada8] transition-colors hover:text-[#f1f3ef]"
              >
                {link.label}
              </Link>
            </li>
          ))}
        </ul>

        <div className="hidden items-center gap-3 lg:flex">
          <Link href={clientTradeUrl("/login")} className="ag-btn ag-btn-ghost min-h-0! px-4 py-2.5 text-[13.5px]">
            {t("login")}
          </Link>
          <Link href={clientTradeUrl("/register")} className="ag-btn ag-btn-primary min-h-0! px-4 py-2.5 text-[13.5px] rounded-full!">
            {t("cta")}
          </Link>
        </div>

        <button
          type="button"
          className="flex h-10 w-10 items-center justify-center rounded-lg border border-white/10 text-[#f1f3ef] lg:hidden"
          aria-expanded={open}
          aria-label={open ? "Close menu" : "Open menu"}
          onClick={() => setOpen((value) => !value)}
        >
          {open ? <X size={18} strokeWidth={2} aria-hidden /> : <Menu size={18} strokeWidth={2} aria-hidden />}
        </button>
      </nav>

      {open && (
        <div className="border-t border-white/12 bg-[#0d100f]/70 backdrop-blur-xl backdrop-saturate-150 lg:hidden">
          <ul className="ag-container flex flex-col py-3">
            {links.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  onClick={() => setOpen(false)}
                  className="block border-b border-white/8 py-3.5 text-[15px] font-medium text-[#a7ada8] last:border-0 hover:text-[#f1f3ef]"
                >
                  {link.label}
                </Link>
              </li>
            ))}
            <li className="mt-3 flex gap-3 pb-2">
              <Link href={clientTradeUrl("/login")} onClick={() => setOpen(false)} className="ag-btn ag-btn-ghost flex-1">
                {t("login")}
              </Link>
              <Link href={clientTradeUrl("/register")} onClick={() => setOpen(false)} className="ag-btn ag-btn-primary flex-1 rounded-full!">
                {t("cta")}
              </Link>
            </li>
          </ul>
        </div>
      )}
    </header>
  );
}
