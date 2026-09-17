"use client";

import type { ReactNode } from "react";
import { useBrand } from "@/components/providers";
import {
  ArticleLayout as BlackForestArticleLayout,
  Section as BlackForestSection,
} from "@/components/landing/ArticleLayout";
import {
  GbfxsArticleLayout,
  GbfxsSection,
} from "@/designs/gbfxs/public/content/GbfxsArticleLayout";

/**
 * PUBLIC DESIGN dispatcher for interior-page ARCHITECTURE — the client-side
 * mirror of the server dispatch in src/app/(content)/layout.tsx. Expressed as
 * a client component so it works inside both server and client pages (the
 * active design comes from the Providers brand context, resolved per request
 * on the server — no hydration mismatch).
 *
 * The default design keeps its editorial article layout; the gbfxs design
 * gets the landing's page architecture (GbfxsArticleLayout). Page bodies stay
 * shared — only the composition layer is design-owned. New public designs add
 * a case here AND a shell in src/designs/ registry (one key, both layers).
 */
export function ArticleLayout(props: {
  eyebrow: string;
  title: string;
  description?: string;
  children: ReactNode;
  sidebar?: ReactNode;
}) {
  const brand = useBrand();
  if (brand.publicDesign === "gbfxs") return <GbfxsArticleLayout {...props} />;
  return <BlackForestArticleLayout {...props} />;
}

export function Section(props: { title?: string; children: ReactNode }) {
  const brand = useBrand();
  if (brand.publicDesign === "gbfxs") return <GbfxsSection {...props} />;
  return <BlackForestSection {...props} />;
}
