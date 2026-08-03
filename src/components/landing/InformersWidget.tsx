"use client";

import { useEffect, useState } from "react";
import { ArticleLayout, Section } from "@/components/landing/ArticleLayout";

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

export function InformersWidget({ domain }: InformersWidgetProps) {
  const [instruments, setInstruments] = useState<Instrument[]>([]);
  const [theme, setTheme] = useState<"light" | "dark">("light");

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/instruments");
        const data = await res.json();
        setInstruments(data.instruments ?? []);
      } catch {
        /* offline */
      }
    }
    load();
    const t = setInterval(load, 2000);
    return () => clearInterval(t);
  }, []);

  const dark = theme === "dark";

  return (
    <ArticleLayout
      eyebrow="Tools"
      title="Market Informers"
      description="Embeddable live-rate widgets for forex, commodities, and indices. Preview the available formats below, then drop them on your own site."
    >
      {/* Theme toggle */}
      <Section>
        <div className="inline-flex bg-panel-2 border border-border rounded-lg p-1 text-sm">
          {(["light", "dark"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTheme(t)}
              className={`px-4 py-1.5 rounded-md font-medium capitalize transition ${theme === t ? "bg-brand text-white" : "text-text-muted hover:text-text"}`}
            >
              {t}
            </button>
          ))}
        </div>
      </Section>

      {/* Ticker widget preview */}
      <Section title="Live Ticker">
        <div
          className={`rounded-xl p-4 overflow-x-auto ${dark ? "bg-[#1a1a1a] border border-[#333]" : "bg-canvas border border-border"}`}
        >
          <div className="flex items-center gap-6 whitespace-nowrap">
            {instruments.map((i) => {
              const up = i.changePct >= 0;
              return (
                <div key={i.symbol} className={`flex items-baseline gap-2 ${dark ? "text-white" : ""}`}>
                  <span className="text-sm font-semibold">{i.symbol}</span>
                  <span className="text-sm tnum">{i.mid.toFixed(i.digits)}</span>
                  <span className={`text-xs tnum ${up ? "text-up" : "text-down"}`}>
                    {up ? "▲" : "▼"} {Math.abs(i.changePct).toFixed(2)}%
                  </span>
                </div>
              );
            })}
            {instruments.length === 0 && (
              <span className={`text-sm ${dark ? "text-white/50" : "text-text-faint"}`}>Loading live rates…</span>
            )}
          </div>
        </div>
      </Section>

      {/* Rate table widget preview */}
      <Section title="Rate Table">
        <div className={`rounded-xl overflow-hidden border ${dark ? "border-[#333]" : "border-border"}`}>
          <table className="w-full">
            <thead className={dark ? "bg-[#242424] text-white/60" : "bg-panel-2 text-text-faint"}>
              <tr>
                <th className="text-left text-[11px] uppercase px-4 py-2 font-medium">Symbol</th>
                <th className="text-right text-[11px] uppercase px-4 py-2 font-medium">Bid</th>
                <th className="text-right text-[11px] uppercase px-4 py-2 font-medium">Ask</th>
                <th className="text-right text-[11px] uppercase px-4 py-2 font-medium">24h</th>
              </tr>
            </thead>
            <tbody>
              {instruments.map((i) => {
                const up = i.changePct >= 0;
                const txt = dark ? "text-white" : "text-text";
                const sub = dark ? "text-white/50" : "text-text-muted";
                return (
                  <tr key={i.symbol} className={dark ? "border-t border-[#333]" : "border-t border-border"}>
                    <td className="px-4 py-2">
                      <div className={`text-sm font-medium ${txt}`}>{i.symbol}</div>
                      <div className={`text-[11px] ${sub}`}>{i.name}</div>
                    </td>
                    <td className={`px-4 py-2 text-right text-sm tnum ${txt}`}>{i.bid.toFixed(i.digits)}</td>
                    <td className={`px-4 py-2 text-right text-sm tnum ${txt}`}>{i.ask.toFixed(i.digits)}</td>
                    <td className={`px-4 py-2 text-right text-sm tnum ${up ? "text-up" : "text-down"}`}>
                      {up ? "+" : ""}{i.changePct.toFixed(2)}%
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Section>

      {/* Embed code */}
      <Section title="Embed code">
        <p className="mb-3">Copy this snippet into your site to display live rates (a placeholder for the widget endpoint):</p>
        <pre className={`rounded-lg p-4 text-xs overflow-x-auto ${dark ? "bg-[#1a1a1a] text-white/80 border border-[#333]" : "bg-panel text-text-muted border border-border"}`}>
{`<iframe
  src="${domain}/widgets/ticker?theme=${theme}"
  width="100%" height="40" frameborder="0"
  title="Live Rates">
</iframe>`}
        </pre>
      </Section>
    </ArticleLayout>
  );
}
