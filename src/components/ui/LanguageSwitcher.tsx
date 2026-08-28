"use client";

import { useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { defaultLocale, locales, LOCALE_DISPLAY, LOCALE_COOKIE, type Locale } from "@/i18n/config";
import { Check, ChevronDown, Globe } from "lucide-react";

/**
 * Working language dropdown. Replaces the decorative EN/FR buttons.
 *
 * On the marketing apex: selecting a language navigates to the locale-prefixed
 * URL (/fr/about) — the middleware strips the prefix, sets the NEXT_LOCALE
 * cookie (scoped to the brand apex domain so it persists across the apex and
 * trade.* subdomains), and the page renders in that language. The default
 * locale (en) uses unprefixed URLs.
 *
 * On the trade subdomain (single-URL app area): the cookie is set directly and
 * the page reloads so server components re-render with the new locale.
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
    const host = window.location.hostname;
    const parts = host.split(".");
    // The cookie MUST be set for every locale — including the default. The
    // middleware persists the locale cookie on /<locale>/ URLs, and request.ts
    // resolves cookie-first; without an explicit "en" cookie, switching back
    // to English would keep rendering the previous language on unprefixed URLs.
    // Written to BOTH scopes (host-only + dot-domain): older middleware
    // versions created a host-only cookie, and a dot-domain-only write would
    // leave that stale one winning — the browser sends host-only first.
    const domain = parts.slice(-2).join(".");
    const cookieDomain = domain.includes(".") ? `; domain=.${domain}` : "";
    document.cookie = `${LOCALE_COOKIE}=${locale}; max-age=31536000; path=/; samesite=lax`;
    if (cookieDomain) {
      document.cookie = `${LOCALE_COOKIE}=${locale}; max-age=31536000; path=/${cookieDomain}; samesite=lax`;
    }
    try {
      localStorage.setItem(LOCALE_COOKIE, locale);
    } catch {
      /* storage unavailable — non-fatal */
    }
    const onApex = parts.length <= 2 || parts[0] === "www";
    if (onApex) {
      // Marketing domain: navigate to the locale-prefixed URL (default locale
      // unprefixed). Full navigation so the URL matches the chosen language.
      const strip = new RegExp(`^/(${locales.join("|")})(?=/|$)`);
      const path = window.location.pathname.replace(strip, "") || "/";
      const target = locale === defaultLocale ? path : `/${locale}${path === "/" ? "" : path}`;
      window.location.assign(`${target}${window.location.search}`);
      return;
    }
    // Trade subdomain: cookie + reload (no locale-prefixed URLs here).
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
          className="absolute right-0 top-full mt-1 min-w-44 rounded-lg border border-border bg-canvas py-1 shadow-card z-50"
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
  return <Globe size={14} strokeWidth={1.75} aria-hidden />;
}

function ChevronIcon({ open }: { open: boolean }) {
  return <ChevronDown size={11} strokeWidth={2.5} aria-hidden className={`transition-transform ${open ? "rotate-180" : ""}`} />;
}

function CheckIcon() {
  return <Check size={12} strokeWidth={2} aria-hidden />;
}
