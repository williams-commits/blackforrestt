// GENERATED FILE — DO NOT EDIT.
// SOURCE: src/designs/<key>/public/content/ (article layout files)
// REGENERATE: npm run platform -- registry generate
// This file is a read-only build artifact; CI fails if it drifts from its sources.


// Client-safe: only article layout components — no landing/shell refs.
// The composition dispatcher (src/platform/composition.tsx) uses lazy()
// wrappers from these imports; Suspense handles the async boundary.

export const ARTICLE_MODULE_IMPORTS: Record<string, () => Promise<Record<string, unknown>>> = {
  convertio: () => import("@/designs/convertio/public/content/ConvertioArticleLayout"),
  default: () => import("@/components/landing/ArticleLayout"),
  gbfxs: () => import("@/designs/gbfxs/public/content/GbfxsArticleLayout"),
};
