"use client";

import { useTranslations } from "next-intl";
import { ArticleLayout, Section } from "@/components/landing/ArticleLayout";
import { useTheme } from "@/components/ThemeProvider";
import { InstrumentIcon } from "@/components/icons/InstrumentIcon";
import { useInstruments } from "@/components/landing/useInstruments";

interface Instrument {
  symbol: string;
  name: string;
  digits: number;
  bid: number;
  ask: number;
  mid: number;
  changePct: number;
}

interface InformersWidgetProps {
  /** Brand domain from the server, so the embed snippet matches between SSR and client. */
  domain: string;
}

/**
 * Embeddable live-rate widgets (ticker + rate table + embed code).
 *
 * Uses the site-wide light/dim theme via useTheme() rather than a local toggle,
 * and renders entirely with design tokens (bg-canvas / bg-panel / text-text /
 * border-border / text-up / text-down) so the preview reskins automatically in
 * dim mode — no hardcoded hex colors.
 */
export function InformersWidget({ domain }: InformersWidgetProps) {
  const t = useTranslations("informers");
  const instruments: Instrument[] = useInstruments([], 2000);
  const { theme } = useTheme();
  const themeWord = theme === "dim" ? t("themeHintDim") : t("themeHintLight");

  return (
    <ArticleLayout
      eyebrow={t("eyebrow")}
      title={t("title")}
      description={t("description")}
    >
      {/* Theme hint — the preview follows the site theme (toggle in the navbar). */}
      <Section>
        <div className="inline-flex items-center gap-2 text-xs text-text-muted">
          <span className="h-1.5 w-1.5 rounded-full bg-up animate-pulse" />
          {t("themeHint", { theme: themeWord })}
        </div>
      </Section>

      {/* Ticker widget preview */}
      <Section title={t("ticker")}>
        <div className="rounded-xl p-4 overflow-x-auto bg-canvas border border-border">
          <div className="flex items-center gap-6 whitespace-nowrap">
            {instruments.map((i) => {
              const up = i.changePct >= 0;
              return (
                <div key={i.symbol} className="flex items-baseline gap-2">
                  <span className="flex items-center"><InstrumentIcon symbol={i.symbol} size={16} /></span>
                  <span className="text-sm font-semibold text-text">{i.symbol}</span>
                  <span className="text-sm tnum text-text">{i.mid.toFixed(i.digits)}</span>
                  <span className={`text-xs tnum ${up ? "text-up" : "text-down"}`}>
                    {up ? "▲" : "▼"} {Math.abs(i.changePct).toFixed(2)}%
                  </span>
                </div>
              );
            })}
            {instruments.length === 0 && (
              <span className="text-sm text-text-faint">{t("loading")}</span>
            )}
          </div>
        </div>
      </Section>

      {/* Rate table widget preview */}
      <Section title={t("rateTable")}>
        <div className="rounded-xl overflow-hidden border border-border">
          <table className="w-full">
            <thead className="bg-panel-2 text-text-faint">
              <tr>
                <th className="text-left text-[11px] uppercase px-4 py-2 font-medium">{t("thSymbol")}</th>
                <th className="text-right text-[11px] uppercase px-4 py-2 font-medium">{t("thBid")}</th>
                <th className="text-right text-[11px] uppercase px-4 py-2 font-medium">{t("thAsk")}</th>
                <th className="text-right text-[11px] uppercase px-4 py-2 font-medium">{t("th24h")}</th>
              </tr>
            </thead>
            <tbody>
              {instruments.map((i) => {
                const up = i.changePct >= 0;
                return (
                  <tr key={i.symbol} className="border-t border-border">
                    <td className="px-4 py-2">
                      <div className="flex items-center gap-2">
                        <InstrumentIcon symbol={i.symbol} size={16} />
                        <div className="text-sm font-medium text-text">{i.symbol}</div>
                      </div>
                      <div className="text-[11px] text-text-muted">{i.name}</div>
                    </td>
                    <td className="px-4 py-2 text-right text-sm tnum text-down">{i.bid.toFixed(i.digits)}</td>
                    <td className="px-4 py-2 text-right text-sm tnum text-up">{i.ask.toFixed(i.digits)}</td>
                    <td className={`px-4 py-2 text-right text-sm tnum ${up ? "text-up" : "text-down"}`}>
                      {up ? "+" : ""}{i.changePct.toFixed(2)}%
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {instruments.length === 0 && (
            <div className="px-4 py-6 text-sm text-text-faint text-center">{t("loading")}</div>
          )}
        </div>
      </Section>

      {/* Embed code */}
      <Section title={t("embedCode")}>
        <p className="mb-3">{t("embedIntro")}</p>
        <pre className="rounded-lg p-4 text-xs overflow-x-auto bg-panel text-text-muted border border-border font-mono">
{`<iframe
  src="${domain}/widgets/ticker?theme=${theme}"
  width="100%" height="40" frameborder="0"
  title="${t("liveRates")}">
</iframe>`}
        </pre>
      </Section>
    </ArticleLayout>
  );
}
