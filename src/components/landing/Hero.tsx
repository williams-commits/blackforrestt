import Link from "next/link";

/** Hero: headline + subheadline + dual CTA + a platform mockup. */
export function Hero() {
  return (
    <section className="relative overflow-hidden bg-gradient-to-b from-panel to-canvas">
      <div className="max-w-7xl mx-auto px-4 lg:px-8 py-20 lg:py-28 grid lg:grid-cols-2 gap-12 items-center">
        <div>
          <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-soft text-brand text-xs font-semibold mb-6">
            <span className="h-1.5 w-1.5 rounded-full bg-brand" />
            Trusted by traders worldwide
          </span>
          <h1 className="text-4xl lg:text-5xl font-extrabold leading-tight tracking-tight">
            Navigate the Future with{" "}
            <span className="text-brand">Premier Online Trading</span>
          </h1>
          <p className="mt-5 text-lg text-text-muted max-w-lg">
            Trade forex, commodities, and indices on a lightning-fast platform built for serious
            traders. Real-time quotes, advanced charting, and the tools to stay ahead of the market.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/register"
              className="px-6 py-3 rounded-lg bg-brand text-white font-semibold hover:brightness-110 transition shadow-card"
            >
              Open Free Account
            </Link>
            <Link
              href="/trade/AUDCAD"
              className="px-6 py-3 rounded-lg bg-canvas border border-border font-semibold hover:bg-panel transition"
            >
              Launch Platform →
            </Link>
          </div>
          <div className="mt-10 flex flex-wrap items-center gap-x-8 gap-y-3 text-sm text-text-muted">
            <Stat value="24/7" label="Support" />
          </div>
        </div>

        {/* Platform mockup */}
        <div className="relative">
          <div className="rounded-xl border border-border bg-canvas shadow-card overflow-hidden">
            <div className="flex items-center gap-1.5 h-8 px-3 bg-panel-2 border-b border-border">
              <span className="h-2.5 w-2.5 rounded-full bg-down/60" />
              <span className="h-2.5 w-2.5 rounded-full bg-brand/60" />
              <span className="h-2.5 w-2.5 rounded-full bg-up/60" />
              <span className="ml-3 text-[10px] text-text-faint">trade.blackforestd.net</span>
            </div>
            <div className="grid grid-cols-3 gap-px bg-border">
              <MockCol rows={["AUDCAD", "EURUSD", "GBPUSD", "USDJPY"]} />
              <div className="bg-canvas p-3 col-span-2">
                <div className="text-xs font-semibold mb-2">AUDCAD</div>
                <div className="h-28 flex items-end gap-1">
                  {[40, 55, 48, 62, 70, 58, 75, 82, 68, 90, 78, 95].map((h, i) => (
                    <div
                      key={i}
                      className={`flex-1 rounded-sm ${i % 3 === 0 ? "bg-up/70" : "bg-down/60"}`}
                      style={{ height: `${h}%` }}
                    />
                  ))}
                </div>
                <div className="mt-3 flex justify-between text-[10px] text-text-faint">
                  <span>Bid 0.89180</span>
                  <span className="text-up">+0.12%</span>
                  <span>Ask 0.89202</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="flex items-baseline gap-1.5">
      <span className="text-xl font-bold text-text tnum">{value}</span>
      <span>{label}</span>
    </div>
  );
}

function MockCol({ rows }: { rows: string[] }) {
  return (
    <div className="bg-panel p-2 space-y-1">
      {rows.map((r) => (
        <div key={r} className="text-[10px] text-text-muted px-1.5 py-1 rounded hover:bg-panel-2">
          {r}
        </div>
      ))}
    </div>
  );
}
