/**
 * Blackforrest section manifest content — the single source for the TOC
 * rail, mobile strip, and progress checklist.
 */
import { getTranslations } from "next-intl/server";
import type { PageSectionItem } from "@/content/contracts";

const LANDING_SECTION_KEYS: Array<{ id: string; key: string }> = [
  { id: "playground", key: "playground" },
  { id: "market-forex", key: "forex" },
  { id: "market-crypto", key: "crypto" },
  { id: "market-commodity", key: "commodity" },
  { id: "market-index", key: "index" },
  { id: "confidence", key: "confidence" },
  { id: "final-cta", key: "finalCta" },
];

export async function blackforestLandingSections(): Promise<PageSectionItem[]> {
  const t = await getTranslations("toc.sections");
  return LANDING_SECTION_KEYS.map(({ id, key }) => ({ id, label: t(key) }));
}

