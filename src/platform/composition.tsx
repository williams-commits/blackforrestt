"use client";

import type { ReactNode } from "react";
import { lazy, Suspense } from "react";
import type { LazyExoticComponent, ComponentType } from "react";
import { useBrand } from "@/components/providers";
import {
  ArticleLayout as DefaultArticleLayout,
  Section as DefaultSection,
} from "@/components/landing/ArticleLayout";
import { ARTICLE_MODULE_IMPORTS } from "@/platform/.generated/composition-map";

/**
 * PUBLIC DESIGN dispatcher for interior-page ARCHITECTURE — the client-side
 * mirror of the server dispatch in src/app/(content)/layout.tsx.
 *
 * The design key comes from the Providers brand context (resolved per request
 * on the server — no hydration mismatch). Article layout components are
 * resolved through the GENERATED CLIENT-SAFE composition map
 * (src/platform/.generated/composition-map.ts) using React.lazy() — the
 * standard Suspense-compatible pattern for dynamic imports in client
 * components. No hard-coded design-key branches in this file.
 *
 * Adding a new public design = create the article layout file under
 * src/designs/<key>/public/content/ + regenerate. No edits to this file.
 */

export interface ArticleLayoutProps {
  eyebrow: string;
  title: string;
  description?: string;
  children: ReactNode;
  sidebar?: ReactNode;
}

export interface SectionProps {
  title?: string;
  children: ReactNode;
}

/** Extract the layout/section components from an article-layout module. */
function pick(mod: Record<string, unknown>): {
  Layout: ComponentType<ArticleLayoutProps>;
  SectionCmp: ComponentType<SectionProps>;
} {
  // Generic detection: find the first exported component matching *ArticleLayout
  // and *Section (works for GbfxsArticleLayout, ConvertioArticleLayout, etc.).
  const layoutKey = Object.keys(mod).find((k) => /ArticleLayout/.test(k));
  const sectionKey = Object.keys(mod).find((k) => /^\w*Section$/.test(k) && k !== "DefaultSection");
  if (layoutKey && sectionKey) {
    return {
      Layout: mod[layoutKey] as ComponentType<ArticleLayoutProps>,
      SectionCmp: mod[sectionKey] as ComponentType<SectionProps>,
    };
  }
  // Default fallback from the shared ArticleLayout module.
  const defaultLayout = (mod.ArticleLayout ?? mod.DefaultArticleLayout) as ComponentType<ArticleLayoutProps> | undefined;
  const defaultSection = (mod.Section ?? mod.DefaultSection) as ComponentType<SectionProps> | undefined;
  return {
    Layout: defaultLayout ?? DefaultArticleLayout,
    SectionCmp: defaultSection ?? DefaultSection,
  };
}

/**
 * Memoized lazy-component cache: design key → { Layout, Section }.
 *
 * React.lazy() creates STABLE lazy components that Suspense can handle —
 * unlike `use(promise)` which requires a cached/Suspense-library promise.
 * The cache ensures each design key's lazy wrappers are created exactly once,
 * avoiding the "uncached promise" error and unnecessary remounts.
 */
const lazyCache = new Map<string, {
  Layout: LazyExoticComponent<ComponentType<ArticleLayoutProps>>;
  SectionCmp: LazyExoticComponent<ComponentType<SectionProps>>;
}>();

function getLazyComponents(designKey: string) {
  const cached = lazyCache.get(designKey);
  if (cached) return cached;

  const loader = ARTICLE_MODULE_IMPORTS[designKey] ?? ARTICLE_MODULE_IMPORTS["default"];
  if (!loader) {
    // No composition map entry at all — use the default directly (no lazy).
    const fallback = {
      Layout: lazy(async () => ({ default: DefaultArticleLayout })),
      SectionCmp: lazy(async () => ({ default: DefaultSection })),
    };
    lazyCache.set(designKey, fallback);
    return fallback;
  }

  const Layout = lazy(() => loader().then((mod) => ({ default: pick(mod).Layout })));
  const SectionCmp = lazy(() => loader().then((mod) => ({ default: pick(mod).SectionCmp })));
  const entry = { Layout, SectionCmp };
  lazyCache.set(designKey, entry);
  return entry;
}

export function ArticleLayout(props: ArticleLayoutProps) {
  const brand = useBrand();
  const { Layout } = getLazyComponents(brand.publicDesign);
  return (
    <Suspense fallback={<div aria-busy="true" />}>
      <Layout {...props} />
    </Suspense>
  );
}

export function Section(props: SectionProps) {
  const brand = useBrand();
  const { SectionCmp } = getLazyComponents(brand.publicDesign);
  return (
    <Suspense fallback={<div aria-busy="true" />}>
      <SectionCmp {...props} />
    </Suspense>
  );
}
