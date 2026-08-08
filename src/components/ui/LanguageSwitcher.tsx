"use client";

import { useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { locales, LOCALE_DISPLAY, LOCALE_COOKIE, type Locale } from "@/i18n/config";

/**
 * Working language dropdown. Replaces the decorative EN/FR buttons.
 *
 * Selecting a language sets the `NEXT_LOCALE` cookie (scoped to the brand apex
 * domain so it persists across the apex and trade.* subdomains) plus
 * localStorage, then reloads the page so server components re-render with the
 * new locale. The cookie is read by src/i18n/request.ts on every request.
 */
export function LanguageSwitcher({ className = "" }: { className?: string }) {
  const t = useTranslations("language");
  const activeLocale = useLocale() as Locale;
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close on outside click / Escape.
  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      // Close when clicking outside the whole switcher (button + dropdown panel).
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const select = (locale: Locale) => {
    setOpen(false);
    if (locale === activeLocale) return;
    // Cookie: 1 year, shared across apex + trade.* subdomains.
    const domain = window.location.hostname.split(".").slice(-2).join(".");
    const cookieDomain = domain.includes(".") ? `; domain=.${domain}` : "";
    document.cookie = `${LOCALE_COOKIE}=${locale}; max-age=31536000; path=/${cookieDomain}; samesite=lax`;
    try {
      localStorage.setItem(LOCALE_COOKIE, locale);
    } catch {
      /* storage unavailable — non-fatal */
    }
    // Reload so SSR'd strings re-render in the new locale.
    window.location.reload();
  };

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={t("switch")}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="inline-flex items-center gap-1.5 h-9 px-2 rounded-md border border-border bg-canvas text-text-muted hover:text-text hover:bg-panel transition text-xs"
      >
        <GlobeIcon />
        <span className="font-semibold uppercase">{activeLocale}</span>
        <ChevronIcon open={open} />
      </button>

      {open && (
        <div
          role="listbox"
          aria-label={t("label")}
          className="absolute right-0 mt-1 min-w-44 rounded-lg border border-border bg-canvas py-1 shadow-card z-50"
        >
          {locales.map((loc) => {
            const info = LOCALE_DISPLAY[loc];
            const isActive = loc === activeLocale;
            return (
              <button
                key={loc}
                type="button"
                role="option"
                aria-selected={isActive}
                onClick={() => select(loc)}
                className={`flex w-full items-center gap-2.5 px-3 py-2 text-sm transition ${
                  isActive ? "text-brand bg-brand-soft" : "text-text hover:bg-panel"
                }`}
              >
                <span className="text-base leading-none" aria-hidden="true">{info.flag}</span>
                <span className="flex-1 text-left">
                  <span className="block font-medium">{info.native}</span>
                  <span className="block text-[11px] text-text-faint uppercase">{loc}</span>
                </span>
                {isActive && <CheckIcon />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function GlobeIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" />
    </svg>
  );
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={`transition-transform ${open ? "rotate-180" : ""}`}>
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 12l5 5 9-11" />
    </svg>
  );
}
