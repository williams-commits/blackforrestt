"use client";

import type { ReactNode } from "react";
import { useBrand } from "@/components/providers";
import {
  ArticleLayout as BlackForestArticleLayout,
  Section as BlackForestSection,
} from "@/components/landing/ArticleLayout";
import {
  AgileArticleLayout,
  AgileSection,
} from "@/landing/agile/content/AgileArticleLayout";

/**
 * Host-level brand dispatcher for interior-page composition — the same
 * dispatch pattern as src/app/page.tsx and the (content) layout, expressed as
 * a client component so it works inside both server and client pages (the
 * active brand comes from the Providers brand context, resolved per request
 * on the server — no hydration mismatch).
 *
 * The primary brand keeps its editorial article layout; the Agile family gets
 * the landing's design system (AgileArticleLayout). Page bodies stay shared —
 * only the composition layer is brand-owned.
 */
export function ArticleLayout(props: {
  eyebrow: string;
  title: string;
  description?: string;
  children: ReactNode;
  sidebar?: ReactNode;
}) {
  const brand = useBrand();
  if (brand.landingTemplate === "agile") return <AgileArticleLayout {...props} />;
  return <BlackForestArticleLayout {...props} />;
}

export function Section(props: { title?: string; children: ReactNode }) {
  const brand = useBrand();
  if (brand.landingTemplate === "agile") return <AgileSection {...props} />;
  return <BlackForestSection {...props} />;
}
