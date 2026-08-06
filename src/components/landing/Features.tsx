import Link from "next/link";
import { absoluteTradeUrl } from "@/lib/branding";

/** Section heading helper used across feature sections. */
function SectionHead({ eyebrow, title, subtitle }: { eyebrow: string; title: string; subtitle?: string }) {
  return (
    <div className="text-center max-w-2xl mx-auto mb-12">
      <span className="text-xs font-semibold uppercase tracking-widest text-brand">{eyebrow}</span>
      <h2 className="mt-2 text-3xl font-bold tracking-tight">{title}</h2>
      {subtitle && <p className="mt-3 text-text-muted">{subtitle}</p>}
    </div>
  );
}

/** Markets: the asset classes available to trade. */
export function Markets() {
  const items = [
    { icon: "💱", title: "Forex", desc: "60+ currency pairs with tight spreads and instant execution." },
    { icon: "🥇", title: "Commodities", desc: "Gold, silver, oil, and natural gas on competitive terms." },
    { icon: "📈", title: "Indices", desc: "Trade the world's leading stock indices around the clock." },
    { icon: "₿", title: "Crypto", desc: "Bitcoin, Ethereum, and major digital assets, 24/7." },
  ];
  return (
    <section className="py-20 bg-canvas">
      <div className="max-w-7xl mx-auto px-4 lg:px-8">
        <SectionHead eyebrow="Global Markets" title="One account. Every market." subtitle="Diversify across asset classes from a single platform — all with transparent pricing and no hidden fees." />
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {items.map((it) => (
            <div key={it.title} className="rounded-xl border border-border bg-panel p-6 hover:shadow-card hover:-translate-y-1 transition">
              <div className="text-3xl mb-4">{it.icon}</div>
              <h3 className="font-semibold text-lg">{it.title}</h3>
              <p className="mt-2 text-sm text-text-muted">{it.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/** Platform capabilities. */
export function PlatformFeatures() {
  const items = [
    { icon: "⚡", title: "Lightning Execution", desc: "Orders filled in milliseconds with price improvement technology." },
    { icon: "📊", title: "Advanced Charting", desc: "Professional candlestick charts with 6 timeframes and live quotes." },
    { icon: "🛡️", title: "Risk Management", desc: "Built-in stop-loss, take-profit, margin call, and liquidation protection." },
    { icon: "🔒", title: "Bank-Grade Security", desc: "Encrypted wallets, KYC verification, and segregated client funds." },
    { icon: "📱", title: "Any Device", desc: "A responsive web platform that works on desktop, tablet, and mobile." },
    { icon: "🌐", title: "Real-Time Data", desc: "Live market feeds streamed over WebSockets — zero stale prices." },
  ];
  return (
    <section className="py-20 bg-panel">
      <div className="max-w-7xl mx-auto px-4 lg:px-8">
        <SectionHead eyebrow="The Platform" title="Everything you need to trade with confidence" />
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {items.map((it) => (
            <div key={it.title} className="flex gap-4 rounded-xl border border-border bg-canvas p-6">
              <div className="text-2xl shrink-0">{it.icon}</div>
              <div>
                <h3 className="font-semibold">{it.title}</h3>
                <p className="mt-1 text-sm text-text-muted">{it.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/** Education + analytics resources. */
export function Education() {
  return (
    <section className="py-20 bg-canvas">
      <div className="max-w-7xl mx-auto px-4 lg:px-8 grid lg:grid-cols-2 gap-10 items-center">
        <div>
          <span className="text-xs font-semibold uppercase tracking-widest text-brand">Learn & Grow</span>
          <h2 className="mt-2 text-3xl font-bold tracking-tight">Master the markets with expert education</h2>
          <p className="mt-4 text-text-muted">
            From your first trade to advanced strategies, our education hub has you covered. Access
            guides, video-on-demand courses, daily technical analysis, and a full economic calendar.
          </p>
          <ul className="mt-6 space-y-3 text-sm">
            {["Beginners & advanced trading guides", "Video courses for every skill level", "Daily technical & fundamental analysis", "Economic calendar and live signals"].map((f) => (
              <li key={f} className="flex items-center gap-2">
                <span className="h-5 w-5 rounded-full bg-up/15 text-up flex items-center justify-center text-[10px]">✓</span>
                {f}
              </li>
            ))}
          </ul>
          <Link href={absoluteTradeUrl("/register")} className="inline-block mt-8 px-5 py-2.5 rounded-lg bg-brand text-white text-sm font-semibold hover:brightness-110 transition">
            Start Learning
          </Link>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <EduCard icon="📚" title="Guides" desc="Step-by-step from basics to pro" />
          <EduCard icon="🎥" title="VOD Courses" desc="Watch and learn at your pace" />
          <EduCard icon="📰" title="Daily Analysis" desc="Technical & fundamental insights" />
          <EduCard icon="🗓️" title="Calendar" desc="Track market-moving events" />
        </div>
      </div>
    </section>
  );
}

function EduCard({ icon, title, desc }: { icon: string; title: string; desc: string }) {
  return (
    <div className="rounded-xl border border-border bg-panel p-5">
      <div className="text-2xl mb-2">{icon}</div>
      <h3 className="font-semibold text-sm">{title}</h3>
      <p className="mt-1 text-xs text-text-muted">{desc}</p>
    </div>
  );
}

/** Support + innovation band with CTA. */
export function Support() {
  return (
    <section className="py-20 bg-brand">
      <div className="max-w-5xl mx-auto px-4 lg:px-8 text-center text-white">
        <h2 className="text-3xl font-bold tracking-tight">24/7 support, whenever you trade</h2>
        <p className="mt-3 text-white/85 max-w-xl mx-auto">
          Our team is here around the clock. Open an account in minutes and get a funded $10,000 demo
          to start practicing right away.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link href={absoluteTradeUrl("/register")} className="px-6 py-3 rounded-lg bg-white text-brand font-semibold hover:bg-canvas transition">
            Open Free Account
          </Link>
          <Link href="/trade/AUDCAD" className="px-6 py-3 rounded-lg bg-white/15 text-white font-semibold hover:bg-white/25 transition border border-white/30">
            Try the Demo
          </Link>
        </div>
      </div>
    </section>
  );
}
