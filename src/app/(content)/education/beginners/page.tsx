import { ArticleLayout, Section } from "@/components/landing/ArticleLayout";

export const metadata = { title: "Beginners Guide — Black Forest Digital" };

export default function BeginnersPage() {
  return (
    <ArticleLayout
      eyebrow="Education"
      title="Beginners Guide to Trading"
      description="New to the markets? Start here. Everything from your first candlestick to your first managed trade — in plain language."
    >
      <Section title="1. What is forex trading?">
        <p>
          The foreign exchange (forex) market is where currencies are traded. When you trade EURUSD, you&apos;re
          simultaneously buying euros and selling US dollars. The goal is simple: you believe the euro will
          rise in value against the dollar, and if it does, you profit. If it falls, you lose.
        </p>
        <p>
          Unlike stocks, forex has no central exchange. It trades 24 hours a day, five days a week, across
          global financial centres. That round-the-clock action is both its appeal and its danger — there&apos;s
          always a market, which means there&apos;s always risk.
        </p>
      </Section>

      <Section title="2. Understanding pips, lots, and leverage">
        <p>
          Three terms you&apos;ll see constantly:
        </p>
        <ul className="list-disc pl-5 space-y-2 marker:text-brand">
          <li><strong>Pip</strong> — the smallest price move a pair makes, usually the 4th decimal (0.0001). If EURUSD moves from 1.0820 to 1.0821, that&apos;s one pip.</li>
          <li><strong>Lot</strong> — your trade size. One standard lot = 100,000 units. Most beginners start with 0.01–0.10 lots.</li>
          <li><strong>Leverage</strong> — borrowed money that lets you control a large position with a small deposit. It magnifies both gains <em>and</em> losses, so treat it with respect.</li>
        </ul>
      </Section>

      <Section title="3. How to read a price chart">
        <p>
          A <strong>candlestick chart</strong> shows four prices for each time period: the open, high, low, and
          close. A green (or white) candle means price closed higher than it opened — buyers won that period.
          A red candle means it closed lower — sellers won. The &quot;wicks&quot; (thin lines) show how far price
          pushed beyond the open and close before settling.
        </p>
        <p>
          Start with one timeframe — the 1-hour or 4-hour chart is ideal for beginners. Don&apos;t overcomplicate
          with a dozen indicators; a clean chart with price and a single moving average is plenty to begin.
        </p>
      </Section>

      <Section title="4. Placing your first trade">
        <p>
          On our platform: pick a symbol from the left sidebar, set your <strong>volume</strong> (start small —
          0.01 lots), then click <strong>Buy</strong> if you think the price will rise or <strong>Sell</strong> if
          you think it will fall. That&apos;s it. Your position appears in the bottom table, where you can watch its
          profit/loss in real time and close it whenever you like.
        </p>
      </Section>

      <Section title="5. The golden rule: risk management">
        <p>
          This is the single most important lesson in trading, and most beginners ignore it until it&apos;s too
          late. <strong>Never risk more than 1–2% of your account on a single trade.</strong> With a $10,000
          account, that&apos;s at most $100–200 of risk per trade. Use a stop-loss on every position, and size your
          trade so that hitting your stop costs no more than your risk budget.
        </p>
        <p>
          The traders who survive and thrive aren&apos;t the ones who never lose — they&apos;re the ones whose losses
          are small and controlled. Protect your capital first; the profits will follow.
        </p>
      </Section>

      <Section title="Your next steps">
        <ul className="list-disc pl-5 space-y-2 marker:text-brand">
          <li>Open a free demo account — you get $10,000 of practice money, zero risk.</li>
          <li>Place a few small trades to get comfortable with the platform.</li>
          <li>Move on to the <a href="/education/advanced" className="text-brand hover:underline">Advanced Guide</a> once the basics feel natural.</li>
        </ul>
      </Section>
    </ArticleLayout>
  );
}
