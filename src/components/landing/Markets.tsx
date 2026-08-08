import { getTranslations } from "next-intl/server";
import { SectionTicker } from "@/components/landing/SectionTicker";
import { MarketIcon } from "@/components/landing/MarketIcons";
import {
  CATEGORY_ORDER,
  getInstrumentsByCategory,
} from "@/lib/landingData";
import type { InstrumentCategory } from "@/lib/types";

/**
 * Market Types — one deep section per asset class (Forex, Crypto, Commodities,
 * Indices). Each section opens with serif prose, then a live instrument table
 * rendered server-side and kept fresh by a SectionTicker client island.
 *
 * `ids` mirror the TOC / progress checklist so scroll-spy tracks each section.
 */
export async function Markets() {
  return (
    <div>
      {CATEGORY_ORDER.map((category) => (
        <MarketSection key={category} category={category} />
      ))}
    </div>
  );
}

async function MarketSection({ category }: { category: InstrumentCategory }) {
  const id = `market-${category.toLowerCase()}`;
  const catKey = category.toLowerCase();
  const t = await getTranslations(`markets.${catKey}`);
  const tCommon = await getTranslations("markets.section");
  const label = await getTranslations("toc.sections");
  const instruments = getInstrumentsByCategory(category);

  return (
    <section id={id} className="scroll-mt-24 py-16 lg:py-20 border-t border-border-soft first:border-t-0">
      <div className="max-w-7xl mx-auto px-4 lg:px-8 grid lg:grid-cols-[minmax(0,320px)_minmax(0,1fr)] gap-10">
        {/* Left: editorial intro */}
        <div className="lg:sticky lg:top-24 self-start">
          <div className="flex items-center gap-3 mb-4">
            <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-panel-2 text-brand">
              <MarketIcon category={category} className="h-7 w-7" />
            </div>
            <span className="text-[11px] font-semibold uppercase tracking-widest text-brand">
              {t("eyebrow")}
            </span>
          </div>
          <h3 className="mt-1 text-2xl font-bold tracking-tight">{label(catKey === "commodity" ? "commodity" : catKey)}</h3>
          <p className="font-prose mt-3 text-text-muted leading-relaxed">
            {t("tagline")}. {tCommon("body")}
          </p>
          <div className="mt-5 inline-flex items-center gap-2 text-xs text-text-faint font-mono">
            <span className="h-1.5 w-1.5 rounded-full bg-up animate-pulse" />
            {tCommon("live")}
          </div>
        </div>

        {/* Right: live table */}
        <div className="rounded-xl border border-border bg-canvas p-5 shadow-panel">
          <SectionTicker category={category} initial={instruments} />
        </div>
      </div>
    </section>
  );
}
