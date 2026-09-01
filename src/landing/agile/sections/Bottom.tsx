import Link from "next/link";
import { getTranslations } from "next-intl/server";
import {
  ArrowRight,
  Check,
  Landmark,
  Lock,
  Umbrella,
  CandlestickChart,
  ShieldCheck,
  Gauge,
  type LucideIcon,
} from "lucide-react";
import { Reveal } from "@/components/landing/Reveal";
import { SectionBackdrop } from "../SectionBackdrop";
import { currentBrandProfile } from "@/lib/branding";

/** Intelligence — deep green statement band: analysis, honestly framed. */
export async function IntelligenceSection() {
  const t = await getTranslations("agile.intelligence");
  const bullets = [t("b1"), t("b2"), t("b3"), t("b4")];
  return (
    <section id="intelligence" className="ag-section relative scroll-mt-24 overflow-hidden bg-[#263b33]">
      {/* Frosted glass plate: real analytics dashboards, blurred and tinted
          toward the deep green. The pitch sits on a near-solid green field;
          the checklist side is barely tinted so the data shows through. */}
      <SectionBackdrop
        src="/brands/agilefgs/backgrounds/intelligence-bg.jpg"
        opacity={0.6}
        position="50% 30%"
        blur={10}
        filter="saturate(0.7)"
        scrim="linear-gradient(100deg, rgba(38,59,51,0.97) 14%, rgba(38,59,51,0.78) 48%, rgba(38,59,51,0.28) 100%)"
      />
      <div className="ag-container relative grid items-center gap-10 lg:grid-cols-[1.1fr_0.9fr]">
        <Reveal>
          <span className="ag-eyebrow text-[#63e891]!">{t("eyebrow")}</span>
          <h2 className="ag-h2 mt-4">{t("title")}</h2>
          <p className="ag-sub mt-4">{t("subtitle")}</p>
          <Link href="/analytics/technical" className="ag-btn ag-btn-primary mt-8 rounded-full!">
            {t("cta")} <ArrowRight size={15} strokeWidth={2} aria-hidden />
          </Link>
        </Reveal>
        <Reveal delay={120}>
          <ul className="ag-glass ag-clip-border space-y-4 p-7">
            {bullets.map((bullet) => (
              <li key={bullet} className="flex items-start gap-3 text-[15px] text-[#f1f3ef]/90">
                <Check size={17} strokeWidth={2.5} className="mt-0.5 shrink-0 text-[#63e891]" aria-hidden />
                {bullet}
              </li>
            ))}
          </ul>
        </Reveal>
      </div>
    </section>
  );
}

/** Product showcase — the real terminal, pitched with a framed CSS mock. */
export async function ShowcaseSection() {
  const t = await getTranslations("agile.showcase");
  const tSteps = await getTranslations("agile.steps");
  const bullets = [t("b1"), t("b2"), t("b3")];

  return (
    <section id="platform" className="ag-section scroll-mt-24 bg-[#0d100f]">
      <div className="ag-container">
        <Reveal>
          <div className="ag-card overflow-hidden">
            <div className="grid gap-10 p-8 lg:grid-cols-[1fr_1.1fr] lg:p-12">
              <div>
                <span className="ag-eyebrow">{t("label")}</span>
                <h2 className="ag-h2 mt-4">{t("title")}</h2>
                <p className="ag-sub mt-4">{t("subtitle")}</p>
                <ul className="mt-6 space-y-3">
                  {bullets.map((bullet) => (
                    <li key={bullet} className="flex items-start gap-3 text-sm text-[#a7ada8]">
                      <Check size={16} strokeWidth={2.5} className="mt-0.5 shrink-0 text-[#63e891]" aria-hidden />
                      {bullet}
                    </li>
                  ))}
                </ul>
                <div className="mt-8 flex flex-wrap gap-3">
                  <Link href="/trade/XAUUSD" className="ag-btn ag-btn-primary rounded-full!">
                    {t("cta")}
                  </Link>
                  <Link href="/education/beginners" className="ag-btn ag-btn-ghost">
                    {tSteps("eyebrow")}
                  </Link>
                </div>
              </div>

              {/* Abstract terminal mock — pure CSS/SVG, no imagery and no
                  fabricated data: the structural grammar of the real terminal
                  (toolbar, chart grid, order ticket) rendered as an
                  architectural diagram. Price tags are deliberately blank. */}
              <div className="overflow-hidden rounded-xl border border-white/10 bg-[#111513]" aria-hidden="true">
                {/* Toolbar */}
                <div className="flex items-center gap-2 border-b border-white/10 px-4 py-3">
                  <span className="h-2.5 w-2.5 rounded-full bg-[#ff6b6b]/70" />
                  <span className="h-2.5 w-2.5 rounded-full bg-[#63e891]/50" />
                  <span className="h-2.5 w-2.5 rounded-full bg-[#63e891]" />
                  <span className="ml-3 font-mono text-[10px] tracking-widest text-[#747a75]">XAUUSD · M15</span>
                  <span className="ml-auto flex gap-1">
                    {["M5", "M15", "H1", "H4", "D1"].map((tf, i) => (
                      <span
                        key={tf}
                        className={`rounded px-1.5 py-0.5 font-mono text-[9px] ${i === 1 ? "bg-[#63e891]/15 text-[#63e891]" : "text-[#747a75]"}`}
                      >
                        {tf}
                      </span>
                    ))}
                  </span>
                </div>

                {/* Chart pane — candles over a soft area wash, dotted
                    current-price hairline with a blank price tag. */}
                <div className="relative m-4 h-52 rounded-lg border border-white/10 bg-[#0d100f] p-3">
                  <svg viewBox="0 0 400 150" className="h-full w-full" preserveAspectRatio="none">
                    <defs>
                      <pattern id="ag-grid" width="40" height="30" patternUnits="userSpaceOnUse">
                        <path d="M 40 0 L 0 0 0 30" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
                      </pattern>
                      <linearGradient id="ag-area" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="rgba(99,232,145,0.22)" />
                        <stop offset="100%" stopColor="rgba(99,232,145,0)" />
                      </linearGradient>
                    </defs>
                    <rect width="400" height="150" fill="url(#ag-grid)" />
                    <path
                      d="M0 118 L18 108 L36 112 L54 92 L72 98 L90 74 L108 82 L126 56 L144 64 L162 38 L180 46 L198 24 L216 32 L234 16 L252 24 L270 14 L288 22 L306 12 L324 18 L342 10 L360 16 L400 8 L400 150 L0 150 Z"
                      fill="url(#ag-area)"
                    />
                    <path
                      d="M0 118 L18 108 L36 112 L54 92 L72 98 L90 74 L108 82 L126 56 L144 64 L162 38 L180 46 L198 24 L216 32 L234 16 L252 24 L270 14 L288 22 L306 12 L324 18 L342 10 L360 16 L400 8"
                      fill="none"
                      stroke="rgba(99,232,145,0.75)"
                      strokeWidth="1.5"
                    />
                    {[
                      [12, 96, 7, 58], [30, 63, 7, 46], [48, 72, 7, 36], [66, 47, 7, 28],
                      [84, 57, 7, 38], [102, 40, 7, 24], [120, 50, 7, 32], [138, 30, 7, 20],
                      [156, 42, 7, 28], [174, 24, 7, 16], [192, 36, 7, 24], [210, 18, 7, 12],
                      [228, 30, 7, 20], [246, 20, 7, 16], [264, 34, 7, 22], [282, 26, 7, 16],
                      [300, 16, 7, 10], [318, 24, 7, 16], [336, 12, 7, 8], [354, 20, 7, 14],
                      [372, 28, 7, 20], [388, 16, 7, 10],
                    ].map(([x, y, w, h], index) => (
                      <rect
                        key={index}
                        x={x}
                        y={y}
                        width={w}
                        height={h}
                        rx="1"
                        fill={index % 3 === 2 ? "#63e891" : "rgba(99,232,145,0.5)"}
                        opacity={index % 3 === 2 ? 0.9 : 0.4}
                      />
                    ))}
                  </svg>
                  {/* Current-price hairline + blank tag — interface grammar,
                      no invented quote. */}
                  <div className="pointer-events-none absolute inset-x-10 top-[26%] border-t border-dashed border-[#63e891]/50" />
                  <span className="absolute right-3 top-[22%] h-4 w-12 rounded-sm bg-[#63e891]/20" />
                </div>

                {/* Order ticket pane — side toggle, abstract price/size rows. */}
                <div className="mx-4 mb-4 rounded-lg border border-white/10 bg-[#0d100f] p-3">
                  <div className="grid grid-cols-2 gap-2">
                    <span className="rounded-md bg-[#63e891]/15 py-1.5 text-center font-mono text-[9px] font-bold tracking-widest text-[#63e891]">BUY</span>
                    <span className="rounded-md bg-[#ff6b6b]/15 py-1.5 text-center font-mono text-[9px] font-bold tracking-widest text-[#ff6b6b]">SELL</span>
                  </div>
                  <div className="mt-3 space-y-2">
                    {["PRICE", "AMOUNT", "TOTAL"].map((row, index) => (
                      <div key={row} className="flex items-center justify-between rounded-md border border-white/8 bg-white/[0.02] px-3 py-2">
                        <span className="font-mono text-[9px] tracking-widest text-[#747a75]">{row}</span>
                        <span className={`h-1.5 rounded-full bg-white/15 ${index === 0 ? "w-14" : index === 1 ? "w-9" : "w-11"}`} />
                      </div>
                    ))}
                  </div>
                  <div className="mt-3 h-7 rounded-md bg-[#63e891] opacity-90" />
                </div>
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

/** Trust & security — three cards of REAL registry facts from the brand profile. */
export async function TrustSection() {
  const t = await getTranslations("agile.trust");
  const brand = await currentBrandProfile();
  const companyDesc = [
    brand.legalName,
    brand.companyJurisdiction ? `— registered in ${brand.companyJurisdiction}` : null,
    brand.companyRegistrationNumber ? `(reg. ${brand.companyRegistrationNumber})` : null,
  ]
    .filter(Boolean)
    .join(" ");
  const cards: Array<{ icon: LucideIcon; title: string; desc: string; meta: string | null }> = [
    {
      icon: Landmark,
      title: t("company.title"),
      desc: companyDesc || t("company.fallback"),
      meta: brand.companyRegulator,
    },
    { icon: Lock, title: t("segregated.title"), desc: t("segregated.desc"), meta: null },
    {
      icon: Umbrella,
      title: t("protection.title"),
      desc: brand.investorCompensationScheme || t("protection.fallback"),
      meta: null,
    },
  ];

  return (
    <section id="trust" className="ag-section scroll-mt-24 border-y border-white/10 bg-[#181c1a]">
      <div className="ag-container">
        <Reveal>
          <span className="ag-eyebrow">{t("eyebrow")}</span>
          <h2 className="ag-h2 mt-4 max-w-2xl">{t("title")}</h2>
          <p className="ag-sub mt-4">{t("subtitle")}</p>
        </Reveal>
        <div className="mt-14 grid gap-5 md:grid-cols-3">
          {cards.map(({ icon: Icon, title, desc, meta }, index) => (
            <Reveal key={title} delay={index * 90}>
              <article className="ag-card ag-card-hover h-full p-8">
                <Icon size={20} strokeWidth={1.75} className="text-[#63e891]" aria-hidden />
                <h3 className="mt-6 text-base font-bold text-[#f1f3ef]">{title}</h3>
                <p className="mt-2.5 text-sm leading-relaxed text-[#a7ada8]">{desc}</p>
                {meta && (
                  <p className="mt-5 border-t border-white/10 pt-4 text-[11px] font-medium uppercase tracking-widest text-[#747a75]">
                    {meta}
                  </p>
                )}
              </article>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

/** Steps band — three-step onboarding as glass cards over ambient glows. */
export async function StepsBand() {
  const t = await getTranslations("agile.steps");
  const steps = [
    { n: 1, title: t("s1.title"), desc: t("s1.desc"), icon: Gauge },
    { n: 2, title: t("s2.title"), desc: t("s2.desc"), icon: ShieldCheck },
    { n: 3, title: t("s3.title"), desc: t("s3.desc"), icon: CandlestickChart },
  ];
  return (
    <section id="get-started" className="relative scroll-mt-24 overflow-hidden bg-[#0d100f] py-24">
      {/* Ambient green glows give the glass cards depth to frost over. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(38% 55% at 16% 24%, rgba(38,59,51,0.55), transparent 70%), radial-gradient(42% 60% at 84% 78%, rgba(38,59,51,0.45), transparent 70%)",
        }}
      />
      <div className="ag-container relative">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <span className="ag-eyebrow">{t("eyebrow")}</span>
            <h2 className="ag-h2 mt-4">{t("title")}</h2>
          </div>
          <p className="ag-sub max-w-sm text-sm!">{t("subtitle")}</p>
        </div>
        <ol className="mt-10 grid gap-5 md:grid-cols-3">
          {steps.map(({ n, title, desc, icon: Icon }) => (
            <li key={n} className="ag-glass-tile ag-card-hover relative p-6">
              <div className="flex items-center justify-between">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#63e891] text-sm font-bold text-[#0d100f] shadow-[0_0_18px_-4px_rgba(99,232,145,0.55)] tnum">
                  {n}
                </span>
                <Icon size={18} strokeWidth={1.75} className="text-[#747a75]" aria-hidden />
              </div>
              <h3 className="mt-4 text-[15px] font-bold text-[#f1f3ef]">{title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-[#a7ada8]">{desc}</p>
              {/* Clipped accent hairline — echoes the intelligence panel's
                  framing device, fading out at each end. */}
              <span
                aria-hidden="true"
                className="mt-5 block h-px w-full"
                style={{
                  background:
                    "linear-gradient(90deg, transparent, rgba(99,232,145,0.45) 24%, rgba(255,255,255,0.14) 50%, rgba(99,232,145,0.45) 76%, transparent)",
                }}
              />
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

/** Final CTA — deep green, the closing argument in a glass panel over the
 *  night-city financial district, sealed with the platform's real numbers. */
export async function FinalCta() {
  const t = await getTranslations("agile");
  const tCta = await getTranslations("finalCta");
  const tV = await getTranslations("agile.value");
  const stats = (["c1", "c2", "c3"] as const).map((key) => ({ v: tV(`${key}.v`), l: tV(`${key}.l`) }));
  return (
    <section id="final-cta" className="ag-section relative scroll-mt-24 overflow-hidden bg-[#2d463b]">
      {/* Night-city financial district plate, FROSTED: the skyline blurs
          into soft bokeh light so the whole band reads as one glass
          material — the content panel then layers a second, sharper frost
          over it. */}
      <SectionBackdrop
        src="/brands/agilefgs/backgrounds/cta-bg.jpg"
        opacity={0.62}
        position="center 34%"
        blur={9}
        filter="saturate(1.15)"
        scrim="linear-gradient(180deg, rgba(45,70,59,0.55) 0%, rgba(24,36,30,0.78) 100%)"
      />
      {/* Top feather: meets the incoming color bridge at exactly #2d463b,
          then eases the frosted cityscape in — no hard seam at the edge. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-24"
        style={{ background: "linear-gradient(180deg, #2d463b 0%, rgba(45,70,59,0) 100%)" }}
      />
      <div className="ag-container relative">
        <Reveal>
          <div className="ag-glass ag-clip-border mx-auto max-w-3xl p-9 text-center sm:p-12">
            <h2 className="text-4xl font-extrabold tracking-tight text-[#f1f3ef] lg:text-5xl">{t("ctaTitle")}</h2>
            <p className="mx-auto mt-4 max-w-xl text-lg leading-relaxed text-[#f1f3ef]/75">{t("ctaSubtitle")}</p>
            <div className="mt-10 flex flex-wrap justify-center gap-3">
              <Link href="/register" className="ag-btn ag-btn-primary rounded-full! px-9">
                {tCta("primary")}
              </Link>
              <Link
                href="/login"
                className="ag-btn ag-btn-ghost border-[#f1f3ef]/30! text-[#f1f3ef]! hover:bg-[#f1f3ef]/10!"
              >
                {tCta("secondary")}
              </Link>
            </div>
            {/* The platform's real numbers — same honest stats as the value
                cards, sealing the pitch in enterprise register. */}
            <dl className="mt-10 flex flex-wrap items-center justify-center gap-x-10 gap-y-4 border-t border-white/10 pt-7">
              {stats.map(({ v, l }) => (
                <div key={l} className="text-center">
                  <dd className="font-mono text-xl font-bold tnum text-[#63e891]">{v}</dd>
                  <dt className="mt-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#a7ada8]/80">{l}</dt>
                </div>
              ))}
            </dl>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
