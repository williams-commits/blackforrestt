"use client";

import type { ReactNode } from "react";
import { use, Suspense } from "react";
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
 * (src/platform/.generated/composition-map.ts) which maps design keys to
 * article-layout-only dynamic imports — no landing/shell component refs,
 * no hard-coded design-key branches in this file.
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

// Module-level cache: design key → loaded module (avoids re-import churn).
const moduleCache = new Map<string, Record<string, unknown>>();

function pick(mod: Record<string, unknown>): {
  Layout: (props: ArticleLayoutProps) => ReactNode;
  SectionCmp: (props: SectionProps) => ReactNode;
} {
  // Custom designs export named components (GbfxsArticleLayout pattern);
  // the default re-exports from the shared ArticleLayout.
  const customLayout = mod.GbfxsArticleLayout as ((props: ArticleLayoutProps) => ReactNode) | undefined;
  const customSection = mod.GbfxsSection as ((props: SectionProps) => ReactNode) | undefined;
  if (customLayout && customSection) return { Layout: customLayout, SectionCmp: customSection };
  const defaultLayout = (mod.ArticleLayout ?? mod.DefaultArticleLayout) as ((props: ArticleLayoutProps) => ReactNode) | undefined;
  const defaultSection = (mod.Section ?? mod.DefaultSection) as ((props: SectionProps) => ReactNode) | undefined;
  return {
    Layout: defaultLayout ?? DefaultArticleLayout,
    SectionCmp: defaultSection ?? DefaultSection,
  };
}

async function loadModule(designKey: string): Promise<Record<string, unknown>> {
  const cached = moduleCache.get(designKey);
  if (cached) return Promise.resolve(cached);
  const loader = ARTICLE_MODULE_IMPORTS[designKey] ?? ARTICLE_MODULE_IMPORTS["default"];
  const mod = await loader();
  moduleCache.set(designKey, mod);
  return mod;
}

function ArticleLayoutResource({ designKey, props }: { designKey: string; props: ArticleLayoutProps }) {
  const mod = use(loadModule(designKey));
  const { Layout } = pick(mod);
  return <Layout {...props} />;
}

function SectionResource({ designKey, props }: { designKey: string; props: SectionProps }) {
  const mod = use(loadModule(designKey));
  const { SectionCmp } = pick(mod);
  return <SectionCmp {...props} />;
}

export function ArticleLayout(props: ArticleLayoutProps) {
  const brand = useBrand();
  return (
    <Suspense fallback={<div aria-busy="true" />}>
      <ArticleLayoutResource designKey={brand.publicDesign} props={props} />
    </Suspense>
  );
}

export function Section(props: SectionProps) {
  const brand = useBrand();
  return (
    <Suspense fallback={<div aria-busy="true" />}>
      <SectionResource designKey={brand.publicDesign} props={props} />
    </Suspense>
  );
}
