"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { ArticleClosingCta } from "@/content/contracts";

/**
 * Interior-page closing-CTA content channel. The public shell (a server
 * component) resolves the domain's typed ArticleClosingCta ONCE and provides
 * it here; the design-owned article layouts (client components dispatched by
 * src/landing/composition.tsx) consume it without touching the i18n runtime.
 *
 * Kept in the shared landing library (not src/content) because it is a
 * React context — presentation plumbing, not a content model.
 */
const ArticleCtaContext = createContext<ArticleClosingCta | null>(null);

export function ArticleCtaProvider({ value, children }: { value: ArticleClosingCta; children: ReactNode }) {
  return <ArticleCtaContext.Provider value={value}>{children}</ArticleCtaContext.Provider>;
}

/** The shell-provided closing CTA, or null when the shell didn't provide one
 *  (the closing band is skipped — never rendered with placeholder copy). */
export function useArticleCta(): ArticleClosingCta | null {
  return useContext(ArticleCtaContext);
}
