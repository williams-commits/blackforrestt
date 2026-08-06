import { ArticleLayout, Section } from "@/components/landing/ArticleLayout";
import { brandName } from "@/lib/branding";

export const dynamic = "force-dynamic";


export const metadata = { title: `Advanced Guide — ${brandName()}` };

export default function AdvancedPage() {
  return (
    <ArticleLayout
      eyebrow="Education"
      title="Advanced Trading Guide"
      description="For traders who&apos;ve mastered the basics. Strategy, multi-timeframe analysis, position sizing, and the psychology of consistency."
    >
      <Section title="Multi-timeframe analysis">
        <p>
          No single timeframe tells the whole story. Professional traders analyse the same instrument on at
          least two timeframes: a <strong>higher timeframe</strong> (daily or H4) to define the dominant trend
          and key levels, and a <strong>lower timeframe</strong> (H1 or M15) to time entries with precision.
        </p>
        <p>
          The rule: <strong>trade in the direction of the higher timeframe trend</strong>, using the lower
          timeframe to find a good entry near a higher-timeframe support or resistance. This aligns your
          individual trades with the larger market structure — dramatically improving win rates.
        </p>
      </Section>

      <Section title="Position sizing & the Kelly criterion">
        <p>
          How much should you risk per trade? The naive answer (&quot;1–2%&quot;) is a starting point, but advanced
          traders size positions based on <strong>edge and odds</strong>. The Kelly formula gives the
          theoretically optimal fraction:
        </p>
        <div className="bg-panel border border-border rounded-lg p-4 text-center font-mono text-sm text-text not-prose">
          f* = (b·p − q) / b
        </div>
        <p>
          Where <code className="text-brand">p</code> is your win probability, <code className="text-brand">q = 1 − p</code>,
          and <code className="text-brand">b</code> is your win/loss ratio (average win ÷ average loss). In practice,
          traders use a <strong>fractional Kelly</strong> (¼ or ½ Kelly) — full Kelly is too volatile for real
          accounts. The lesson: your position size should reflect the quality of the setup, not be fixed.
        </p>
      </Section>

      <Section title="Correlation and portfolio risk">
        <p>
          Two long positions in EURUSD and GBPUSD are <em>not</em> two independent trades — the pairs are
          highly correlated, so you&apos;re effectively doubling up on the same &quot;dollar weakness&quot; bet. Real
          risk management accounts for correlation: a portfolio of correlated positions has far higher risk
          than the sum of its parts suggests. Diversify across uncorrelated instruments (a currency pair, a
          commodity, an index) to smooth your equity curve.
        </p>
      </Section>

      <Section title="Building a trading plan">
        <div className="bg-canvas border border-border rounded-xl p-5 not-prose">
          <p className="text-sm font-semibold text-text mb-3">Every trade should answer these questions in advance:</p>
          <ol className="list-decimal pl-5 space-y-2 text-sm text-text-muted marker:text-brand">
            <li>What is my thesis (in one sentence)?</li>
            <li>At what price do I enter, and why there specifically?</li>
            <li>Where is my stop-loss (where am I wrong)?</li>
            <li>Where is my take-profit (what&apos;s my target)?</li>
            <li>What is my risk in dollars, and is it under my 1–2% limit?</li>
            <li>What would invalidate this trade before my stop is hit?</li>
          </ol>
        </div>
        <p>
          If you can&apos;t answer all six, you don&apos;t have a trade — you have a gamble. Write it down before you
          click. A journal of your trades and the reasoning behind them is the single fastest way to improve.
        </p>
      </Section>

      <Section title="Trading psychology & discipline">
        <p>
          The hardest opponent in trading is yourself. After a losing streak, the urge to &quot;win it back&quot;
          with bigger sizes destroys more accounts than any bad strategy. After a winning streak,
          overconfidence does the same. The professionals don&apos;t feel less emotion — they&apos;ve built systems
          and rules that act <em>regardless</em> of how they feel.
        </p>
        <p>
          Three habits that separate pros from the rest: <strong>(1)</strong> a written, pre-defined trading
          plan you follow mechanically; <strong>(2)</strong> a hard daily loss limit after which you stop
          trading; <strong>(3)</strong> a journal you review weekly to find your leaks. Consistency, not
          brilliance, is what compounds.
        </p>
      </Section>
    </ArticleLayout>
  );
}
