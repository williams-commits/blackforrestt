import { ArticleLayout, Section } from "@/components/landing/ArticleLayout";
import { companyLegalName, brandName } from "@/lib/branding";

export const metadata = { title: `About Us — ${brandName()}` };

export default function AboutPage() {
  return (
    <ArticleLayout
      eyebrow="Company"
      title={`About ${brandName()}`}
      description="A premier online trading platform built by traders, for traders — delivering fast execution, transparent pricing, and the education to help you grow."
    >
      {/* Stats band */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { v: "8+", l: "Forex pairs" },
          { v: "<50ms", l: "Avg. execution" },
          { v: "24/7", l: "Support" },
          { v: "100%", l: "Segregated funds" },
        ].map((s) => (
          <div key={s.l} className="bg-panel border border-border rounded-xl p-5 text-center">
            <div className="text-2xl font-extrabold text-brand tnum">{s.v}</div>
            <div className="text-xs text-text-muted mt-1">{s.l}</div>
          </div>
        ))}
      </div>

      <Section title="Our story">
        <p>
          {companyLegalName()} was founded with a single conviction: that a trading platform should be
          fast, transparent, and genuinely on the trader&apos;s side. Too many brokers bury their clients in
          fees, slow execution, and opaque pricing. We set out to build the opposite.
        </p>
        <p>
          Headquartered at 13 Ramsgate Street, London, we serve traders worldwide with access to forex,
          commodities, indices, and digital assets — all from one account, on one platform that works on any
          device. Our matching infrastructure streams live prices over WebSockets, so the rate you see is the
          rate you get.
        </p>
      </Section>

      <Section title="Our mission">
        <p>
          To give every trader — from their very first position to their ten-thousandth — the tools, the
          data, and the education to navigate the markets with confidence. We measure our success by yours.
        </p>
      </Section>

      <Section title="What we stand for">
        <div className="grid sm:grid-cols-2 gap-4 not-prose">
          {[
            { icon: "⚡", t: "Speed", d: "Millisecond execution and real-time data over WebSockets." },
            { icon: "🔍", t: "Transparency", d: "Tight spreads, clear commissions, no hidden fees — ever." },
            { icon: "🛡️", t: "Security", d: "Encrypted wallets, KYC verification, and segregated client funds." },
            { icon: "🎓", t: "Education", d: "Free guides, video courses, and daily analysis for every level." },
            { icon: "🤝", t: "Support", d: "A real human, 24 hours a day, whenever the markets are open." },
            { icon: "🌍", t: "Access", d: "Multi-asset markets from a single account on any device." },
          ].map((v) => (
            <div key={v.t} className="flex gap-3 bg-canvas border border-border rounded-xl p-4">
              <span className="text-2xl">{v.icon}</span>
              <div>
                <h3 className="text-sm font-semibold text-text">{v.t}</h3>
                <p className="text-xs text-text-muted mt-0.5">{v.d}</p>
              </div>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Regulation & compliance">
        <p>
          {companyLegalName()} operates in full compliance with applicable Anti-Money Laundering (AML)
          and Know Your Customer (KYC) regulations. Client funds are held in segregated accounts, separate
          from company operational funds, and never used for any purpose other than your trading activity.
        </p>
        <p>
          We do not provide services to citizens or residents of the United States, Syria, Sudan, Iran, or
          North Korea. Trading is only available to persons aged 18 and over.
        </p>
      </Section>
    </ArticleLayout>
  );
}
