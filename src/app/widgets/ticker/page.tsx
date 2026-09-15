import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { getTranslations } from "next-intl/server";
import { AgileStyles } from "@/landing/agile/AgileStyles";
import { TickerMarquee } from "@/landing/agile/TickerMarquee";
import { getLandingInstruments } from "@/lib/landingData";

// The widget strip is a standalone surface — its font must not depend on a
// brand shell mounting the variable first.
const inter = Inter({ subsets: ["latin"], display: "swap", variable: "--font-agile-inter" });

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Live rates ticker",
  description: "Embeddable live rates ticker.",
  // Embeddable data strip — public by design, kept out of search indexes.
  robots: { index: false, follow: false },
};

/**
 * /widgets/ticker — the embeddable live-rates strip advertised by
 * /tools/informers ("Embed code"). Bare page: no navbar/shell, just the
 * agile ticker marquee on a transparent-friendly plate sized for a ~40px
 * iframe. ?theme=light flips the strip for light embeds.
 */
export default async function TickerWidgetPage({
  searchParams,
}: {
  searchParams: Promise<{ theme?: string | string[] }>;
}) {
  const [params, t] = await Promise.all([searchParams, getTranslations("agile.markets")]);
  const raw = Array.isArray(params.theme) ? params.theme[0] : params.theme;
  const light = (raw ?? "").toLowerCase() === "light";
  const instruments = getLandingInstruments();

  return (
    <div className={`${inter.variable} ${light ? "ag-widget-light" : ""}`}>
      <AgileStyles />
      {/* Scoped theme override — the marquee's own palette is dark; light
          embeds flip background, text, and edge fades. */}
      {light && (
        <style>{`
          .ag-widget-light .ag-ticker { background: #ffffff; border-color: rgba(0,0,0,0.08); }
          .ag-widget-light .ag-ticker-item { color: #1c1c1e; }
          .ag-widget-light .ag-ticker-item .tnum { color: #55555c; }
          .ag-widget-light .ag-ticker::before { background: linear-gradient(90deg, #ffffff, transparent); }
          .ag-widget-light .ag-ticker::after { background: linear-gradient(270deg, #ffffff, transparent); }
        `}</style>
      )}
      <TickerMarquee initial={instruments} ariaLabel={t("live")} />
    </div>
  );
}
