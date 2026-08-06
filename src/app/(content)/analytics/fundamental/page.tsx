import { ArticleLayout, Section } from "@/components/landing/ArticleLayout";
import { brandName } from "@/lib/branding";


export const metadata = { title: `Fundamental Analysis — ${brandName()}` };

export default function FundamentalPage() {
  return (
    <ArticleLayout
      eyebrow="Analytics"
      title="Fundamental Analysis"
      description="Understand the 'why' behind price moves. Macro drivers, central bank policy, and economic data — interpreted for traders."
    >
      <Section title="Interest rates: the engine of currency markets">
        <p>
          Currencies are, at their core, a reflection of relative interest rates. Capital flows toward
          higher-yielding currencies, so a central bank that raises rates tends to strengthen its currency —
          and one that cuts tends to weaken it. When you trade a pair like EURUSD, you&apos;re effectively
          betting on the path of ECB rates versus Fed rates.
        </p>
        <p>
          That&apos;s why every central bank decision and every inflation print matters. Markets don&apos;t just
          react to the number — they react to whether the number changes the expected path of rates. A
          &quot;hawkish surprise&quot; (rates higher than expected, or signals of fewer future cuts) is bullish
          for that currency; a &quot;dovish surprise&quot; is bearish.
        </p>
      </Section>

      <Section title="The big three data points to watch">
        <div className="grid sm:grid-cols-3 gap-4 not-prose">
          {[
            { t: "Inflation (CPI)", d: "The single most-watched figure. Hot inflation forces central banks to keep rates high; cooling inflation paves the way for cuts." },
            { t: "Employment (NFP)", d: "A strong labour market gives a central bank room to hold rates; rising unemployment pressures them to cut." },
            { t: "GDP growth", d: "Robust growth supports a strong currency; recession fears drive rate-cut expectations and weakness." },
          ].map((c) => (
            <div key={c.t} className="bg-canvas border border-border rounded-xl p-5">
              <h3 className="text-sm font-semibold text-text">{c.t}</h3>
              <p className="text-xs text-text-muted mt-1.5">{c.d}</p>
            </div>
          ))}
        </div>
      </Section>

      <Section title="How to trade the news (without getting caught out)">
        <p>
          The biggest moves — and the biggest traps — happen around data releases. Three rules to keep you
          safe:
        </p>
        <ol className="list-decimal pl-5 space-y-2 marker:text-brand">
          <li><strong>Know the calendar.</strong> Never hold a large position into a high-impact release you didn&apos;t plan for. Check our Economic Calendar daily.</li>
          <li><strong>Trade the surprise, not the number.</strong> A strong jobs number that was <em>expected</em> barely moves the market. It&apos;s the deviation from the forecast that matters.</li>
          <li><strong>Respect the spread.</strong> Spreads widen dramatically around releases. Use limit orders, not market orders, if you must trade the print.</li>
        </ol>
      </Section>

      <Section title="Geopolitics & risk sentiment">
        <p>
          Beyond the data, currencies respond to risk sentiment. In &quot;risk-off&quot; moments — wars, banking
          stress, pandemic fears — capital flows into safe havens like the US dollar, Japanese yen, and
          Swiss franc, and out of growth-linked currencies like the Australian and Canadian dollars. Learning
          to read this risk pulse is a powerful complement to the data-driven approach above.
        </p>
      </Section>
    </ArticleLayout>
  );
}
