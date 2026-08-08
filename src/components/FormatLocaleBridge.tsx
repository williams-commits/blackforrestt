"use client";

import { useEffect } from "react";
import { useLocale } from "next-intl";
import { setFormatLocale } from "@/lib/format";

/**
 * Keeps the locale-aware number formatters (src/lib/format.ts) in sync with the
 * active next-intl locale. Mounted once in the root layout. On each render it
 * pushes the current locale into the format module so prices/percentages use
 * the correct decimal separators (e.g. "," in DE/ES).
 */
export function FormatLocaleBridge() {
  const locale = useLocale();
  useEffect(() => {
    setFormatLocale(locale);
  }, [locale]);
  return null;
}
