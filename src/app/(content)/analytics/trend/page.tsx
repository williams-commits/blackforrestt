import { ArticleLayout, Section } from "@/components/landing/ArticleLayout";

export const dynamic = "force-dynamic";


export const metadata = { title: "Determining Trend Potential" };

export default function TrendPage() {
  return (
    <ArticleLayout
      eyebrow="Analytics"
      title="Determining Trend Potential"
      description="Gauge whether a trend has the fuel to continue — or is running on fumes. A framework combining momentum, structure, and volume."
    >
      <Section title="Step 1 — Define the trend with price structure">
        <p>
          Before you ask whether a trend will continue, confirm it exists. An uptrend is a sequence of
          <strong> higher highs and higher lows</strong>; a downtrend is the reverse. The moment this
          structure breaks — a lower low in an uptrend — the trend is in question. Draw your swing highs and
          lows on a chart; this simple structure does more than any single indicator.
        </p>
      </Section>

      <Section title="Step 2 — Measure momentum">
        <p>
          Momentum tells you how much conviction backs the move. The tools:
        </p>
        <ul className="list-disc pl-5 space-y-2 marker:text-brand">
          <li><strong>RSI (Relative Strength Index):</strong> A reading above 55 with rising peaks confirms strong bullish momentum; divergence (price makes a higher high but RSI makes a lower high) warns of exhaustion.</li>
          <li><strong>MACD:</strong> When the histogram expands in the trend&apos;s direction, momentum is building. When it contracts, the trend is losing steam.</li>
          <li><strong>ADX (Average Directional Index):</strong> Above 25 indicates a trending market worth trading; below 20 suggests a choppy, range-bound market to avoid or trade with mean-reversion tactics.</li>
        </ul>
      </Section>

      <Section title="Step 3 — Confirm with volume">
        <p>
          A trend with rising volume is a trend with institutional participation. Look for volume to expand
          on impulsive moves in the trend direction and contract on the counter-trend pullbacks. If price
          pushes to new highs on <em>falling</em> volume, buyers are exhausted — a classic warning sign.
        </p>
      </Section>

      <Section title="Step 4 — The trend-potential checklist">
        <div className="bg-canvas border border-border rounded-xl p-5 not-prose">
          <p className="text-sm font-semibold text-text mb-3">A trend has strong continuation potential when:</p>
          <ul className="space-y-2 text-sm text-text-muted">
            <li className="flex gap-2"><span className="text-up">✓</span> Price structure (HH/HL or LH/LL) is intact</li>
            <li className="flex gap-2"><span className="text-up">✓</span> Price is above (long) or below (short) a rising/falling moving average</li>
            <li className="flex gap-2"><span className="text-up">✓</span> Momentum indicators confirm with no divergence</li>
            <li className="flex gap-2"><span className="text-up">✓</span> Volume expands on impulse moves, contracts on pullbacks</li>
            <li className="flex gap-2"><span className="text-up">✓</span> No major high-impact news imminent (check the calendar)</li>
          </ul>
        </div>
      </Section>

      <Section title="Step 5 — Know when to exit">
        <p>
          Even the strongest trend ends. Your exit signal is the <strong>first break of structure</strong> in
          the opposite direction — the first lower low after a string of higher lows. Many traders give back
          gains by hoping for &quot;just a bit more.&quot; Let the structure, not your emotions, tell you when the
          trend has changed.
        </p>
      </Section>
    </ArticleLayout>
  );
}
