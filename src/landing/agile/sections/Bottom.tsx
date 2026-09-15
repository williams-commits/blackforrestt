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
import { currentBrandProfile, tradeHostForDomain } from "@/lib/branding";

/**
 * Intelligence — the analysis pitch on the GBFXS statement yellow. Left carries the
 * narrative WITH the checklist in ink; right is a layered analyst composition — a
 * dark signal card (entry/exit guide bands, blank level chips) with a small
 * calendar card leaning against it. The dark frames sit on yellow as the
 * terminal-on-brand device. Abstract and honest: interface grammar,
 * no fabricated levels.
 */
export async function IntelligenceSection() {
  const t = await getTranslations("agile.intelligence");
  const bullets = [t("b1"), t("b2"), t("b3"), t("b4")];
  return (
    <section id="intelligence" className="ag-cell-yellow relative scroll-mt-24 overflow-hidden">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{ background: "radial-gradient(80% 55% at 92% -10%, rgba(255,255,255,0.32), transparent 62%)" }}
      />
      <div className="ag-container relative grid items-center gap-10 py-24 lg:grid-cols-[1.05fr_0.95fr] lg:gap-16 lg:py-34">
        {/* Narrative + checklist */}
        <Reveal>
          <span className="ag-eyebrow ag-eyebrow-ink">{t("eyebrow")}</span>
          <h2 className="ag-h2 ag-ink-h2 mt-4 text-balance">{t("title")}</h2>
          <p className="ag-sub ag-ink-sub mt-4 max-w-lg">{t("subtitle")}</p>
          <ul className="mt-8 space-y-3.5">
            {bullets.map((bullet) => (
              <li key={bullet} className="flex items-start gap-3 text-[14.5px] leading-relaxed text-[#0d0d0f]/84">
                <Check size={16} strokeWidth={2.5} className="mt-0.5 shrink-0 text-[#0d0d0f]" aria-hidden />
                {bullet}
              </li>
            ))}
          </ul>
          <Link href="/analytics/technical" className="ag-btn ag-btn-ink mt-9">
            {t("cta")} <ArrowRight size={15} strokeWidth={2} aria-hidden />
          </Link>
        </Reveal>

        {/* Analyst composition — signal card + leaning calendar card */}
        <Reveal delay={120}>
          <div className="relative">
            <div className="ag-frame p-6 sm:p-7">
              <div className="flex items-center justify-between" aria-hidden="true">
                <span className="flex items-center gap-2.5">
                  <span className="rounded-md bg-[#f0b90b]/12 px-2.5 py-1 font-mono text-[10px] font-bold tracking-widest text-[#f0b90b]">SIGNAL</span>
                  <span className="font-mono text-[10px] tracking-widest text-[#75757b]">H4</span>
                </span>
                {/* Confidence dots */}
                <span className="flex items-center gap-1">
                  {[0.35, 0.65, 1].map((opacity) => (
                    <span key={opacity} className="h-1.5 w-1.5 rounded-full bg-[#f0b90b]" style={{ opacity }} />
                  ))}
                </span>
              </div>

              <svg viewBox="0 0 320 132" className="mt-5 w-full" aria-hidden="true" focusable="false">
                <defs>
                  <linearGradient id="ag-int-fill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="rgba(240,185,11,0.2)" />
                    <stop offset="100%" stopColor="rgba(240,185,11,0)" />
                  </linearGradient>
                </defs>
                {/* Entry / exit guide bands — abstract zones, no numbers. */}
                <rect x="0" y="14" width="320" height="16" fill="rgba(255,107,107,0.07)" />
                <rect x="0" y="100" width="320" height="16" fill="rgba(240,185,11,0.08)" />
                <line x1="0" y1="22" x2="320" y2="22" stroke="rgba(255,107,107,0.4)" strokeDasharray="3 4" strokeWidth="1" />
                <line x1="0" y1="108" x2="320" y2="108" stroke="rgba(240,185,11,0.45)" strokeDasharray="3 4" strokeWidth="1" />
                <path
                  d="M0 96 L24 88 L48 92 L72 70 L96 77 L120 54 L144 61 L168 40 L192 47 L216 30 L240 37 L264 22 L288 29 L320 16 L320 132 L0 132 Z"
                  fill="url(#ag-int-fill)"
                />
                <path
                  d="M0 96 L24 88 L48 92 L72 70 L96 77 L120 54 L144 61 L168 40 L192 47 L216 30 L240 37 L264 22 L288 29 L320 16"
                  fill="none"
                  stroke="#f0b90b"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                />
                {/* Entry marker on the line */}
                <circle cx="168" cy="40" r="3" fill="#f0b90b" />
                <circle cx="168" cy="40" r="6" fill="none" stroke="rgba(240,185,11,0.5)" strokeWidth="1" />
              </svg>

              {/* Level chips — the signal card's footer, values blank. */}
              <div className="mt-5 grid grid-cols-3 gap-2" aria-hidden="true">
                {["ENTRY", "STOP", "TARGET"].map((level, index) => (
                  <span
                    key={level}
                    className={`rounded-md border py-2 text-center font-mono text-[8.5px] font-bold tracking-widest ${
                      index === 1
                        ? "border-[#ff6b6b]/25 bg-[#ff6b6b]/8 text-[#ff6b6b]"
                        : "border-[#f0b90b]/25 bg-[#f0b90b]/8 text-[#f0b90b]"
                    }`}
                  >
                    {level}
                </span>
                ))}
              </div>
            </div>

            {/* Calendar card — leaning against the signal card. */}
            <div
              className="ag-frame absolute bottom-0 left-0 w-44 -rotate-3 p-3 sm:w-48"
              aria-hidden="true"
            >
              <div className="flex items-center justify-between">
                <span className="font-mono text-[8px] font-bold tracking-widest text-[#75757b]">CALENDAR</span>
                <span className="h-1.5 w-1.5 rounded-full bg-[#f0b90b]" />
              </div>
              <div className="mt-2.5 space-y-1.5">
                {[0, 1, 2].map((row) => (
                  <span key={row} className="flex items-center gap-2 rounded-md border border-white/8 bg-white/5 px-2 py-1.5">
                    <span className="h-1.5 w-1.5 shrink-0 rounded-xs bg-[#f0b90b]/70" />
                    <span className="h-1.5 flex-1 rounded-full bg-white/12" />
                    <span className="h-1.5 w-4 rounded-full bg-white/8" />
                  </span>
                ))}
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

/**
 * Product showcase — the terminal presented as a layered device composition:
 * a wide browser plate with a phone module overlapping it, over the mesh
 * ambience. Numbered feature list beside it. All CSS/SVG, abstract and
 * honest (blank price tags).
 */
export async function ShowcaseSection() {
  const t = await getTranslations("agile.showcase");
  const showcaseBrand = await currentBrandProfile();
  const bullets = [t("b1"), t("b2"), t("b3")];

  return (
    <section id="terminal" className="ag-section relative scroll-mt-24 overflow-hidden bg-[#0d0d0f]">
      {/* <div className="pointer-events-none absolute inset-0 ag-mesh opacity-80" aria-hidden="true" /> */}
      <div className="ag-container relative grid items-center gap-16 lg:grid-cols-[0.9fr_1.1fr]">
        {/* Narrative + capabilities */}
        <Reveal>
          <span className="ag-eyebrow">{t("label")}</span>
          <h2 className="ag-h2 mt-4 text-balance">{t("title")}</h2>
          <p className="ag-sub mt-5 max-w-md">{t("subtitle")}</p>
          <ul className="mt-9 space-y-4">
            {bullets.map((bullet, index) => (
              <li key={bullet} className="flex items-start gap-4">
                <span className="ag-stepnum shrink-0 pt-1">{String(index + 1).padStart(2, "0")}</span>
                <span className="text-[15px] leading-relaxed text-[#a9a9ae]">{bullet}</span>
              </li>
            ))}
          </ul>
          <div className="mt-9 flex flex-wrap gap-3">
            <Link href="/trade/XAUUSD" className="ag-btn ag-btn-primary">
              {t("cta")}
            </Link>
          </div>
        </Reveal>

        {/*
          The terminal itself — desktop and mobile side by side with clear
          space between them, the phone standing taller than the desktop
          plate. Inside each screen: browser chrome/navbar above the real
          workspace grammar (metrics bar → chart + SELL/BUY order panel →
          positions dock on desktop; navbar → chart + order boxes + trade
          button on mobile). Values are blank — interface, not data.
        */}
        <Reveal delay={120}>
          <div className="relative mx-auto flex w-full max-w-xl items-center gap-8 perspective-[1600px]" aria-hidden="true">
            {/* Cast shade under the composition */}
            <div className="absolute -bottom-14 left-1/2 h-20 w-[94%] -translate-x-1/2 rounded-[100%] bg-black/70 blur-2xl" />

            {/* Desktop — the workspace plate */}
            <div className="ag-frame relative z-10 w-[86%] overflow-hidden p-2 transform-[rotateY(-5deg)_rotateX(1.5deg)] transition-transform duration-500 ease-out hover:transform-[rotateY(-1.5deg)_rotateX(0.5deg)] motion-reduce:transition-none">
              {/* Browser chrome — the navbar, as before */}
              <div className="flex items-center gap-1.5 border-b border-white/8 px-1 pb-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-[#ff6b6b]/60" />
                <span className="h-1.5 w-1.5 rounded-full bg-white/20" />
                <span className="h-1.5 w-1.5 rounded-full bg-[#f0b90b]/70" />
                <span className="ml-1.5 flex-1 rounded bg-white/5 px-2 py-0.5 font-mono text-[6.5px] tracking-widest text-[#75757b]">{tradeHostForDomain(showcaseBrand.domain)}</span>
              </div>
              {/* AccountBar — the real metrics strip */}
              <div className="flex items-center justify-between border-b border-white/8 px-3 py-2">
                {["ACCOUNT", "BALANCE", "EQUITY", "P/L"].map((metric) => (
                  <span key={metric} className="flex flex-col gap-1">
                    <span className="font-mono text-[6.5px] tracking-[0.16em] text-[#75757b]">{metric}</span>
                    <span className="h-1.5 w-8 rounded-sm bg-white/12" />
                  </span>
                ))}
              </div>
              {/* Chart + order panel */}
              <div className="grid grid-cols-[1fr_84px] gap-2 p-2">
                <div className="relative overflow-hidden rounded-md bg-[#0a0a0b] p-1.5">
                  <svg viewBox="0 0 300 120" className="h-36 w-full" preserveAspectRatio="none">
                    <defs>
                      <pattern id="ag-show-grid" width="30" height="24" patternUnits="userSpaceOnUse">
                        <path d="M 30 0 L 0 0 0 24" fill="none" stroke="rgba(255,255,255,0.045)" strokeWidth="1" />
                      </pattern>
                      <linearGradient id="ag-show-fill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="rgba(240,185,11,0.2)" />
                        <stop offset="100%" stopColor="rgba(240,185,11,0)" />
                      </linearGradient>
                    </defs>
                    <rect width="300" height="120" fill="url(#ag-show-grid)" />
                    <path
                      d="M0 96 L20 88 L40 92 L60 72 L80 78 L100 56 L120 63 L140 42 L160 49 L180 30 L200 38 L220 22 L240 29 L260 16 L280 24 L300 12 L300 120 L0 120 Z"
                      fill="url(#ag-show-fill)"
                    />
                    <path
                      d="M0 96 L20 88 L40 92 L60 72 L80 78 L100 56 L120 63 L140 42 L160 49 L180 30 L200 38 L220 22 L240 29 L260 16 L280 24 L300 12"
                      fill="none"
                      stroke="#f0b90b"
                      strokeWidth="1.7"
                      strokeLinecap="round"
                    />
                  </svg>
                  {/* blank last-price hairline */}
                  <div className="pointer-events-none absolute inset-x-6 top-[32%] border-t border-dashed border-[#f0b90b]/45" />
                </div>
                {/* Order rail — the real TradePanel grammar */}
                <div className="flex flex-col gap-1.5">
                  <span className="rounded-md border border-[#ff6b6b]/25 bg-[#ff6b6b]/10 py-1.5 text-center font-mono text-[8px] font-bold tracking-widest text-[#ff6b6b]">SELL</span>
                  <span className="rounded-md border border-[#f0b90b]/25 bg-[#f0b90b]/10 py-1.5 text-center font-mono text-[8px] font-bold tracking-widest text-[#f0b90b]">BUY</span>
                  <div className="grid grid-cols-4 gap-1 rounded-md border border-white/8 p-1.5">
                    {Array.from({ length: 8 }).map((_, i) => (
                      <span key={i} className="h-2 rounded-sm bg-white/10" />
                    ))}
                  </div>
                  <span className="mt-auto h-6 rounded-md bg-[#f0b90b] opacity-90" />
                </div>
              </div>
              {/* Positions dock */}
              <div className="flex items-center gap-2 border-t border-white/8 px-3 py-2">
                <span className="font-mono text-[6.5px] tracking-[0.16em] text-[#75757b]">POSITIONS</span>
                {Array.from({ length: 3 }).map((_, i) => (
                  <span key={i} className="h-1.5 flex-1 rounded-sm bg-white/8" />
                ))}
              </div>
              {/* gloss shade */}
              <div className="pointer-events-none absolute inset-0 bg-linear-to-tr from-transparent via-white/4 to-white/6" />
            </div>

            {/* Phone — beside the desktop, standing taller; navbar on top */}
            <div className="relative z-0 -my-10 flex w-[33%] shrink-0 flex-col rounded-[18px] border border-white/10 bg-[#111113] p-1.5 shadow-[0_30px_70px_-30px_rgba(0,0,0,0.9)] transform-[rotateY(10deg)_rotateX(2deg)]">
              <div className="flex h-full flex-col overflow-hidden rounded-[13px] bg-[#0a0a0b]">
                {/* App navbar — logo mark, section pills, account dot */}
                <div className="flex items-center justify-between border-b border-white/8 px-2 py-1.5">
                  <span className="flex items-center gap-1">
                    <span className="h-2 w-2 rounded-[3px] bg-[#f0b90b]" />
                    <span className="h-1 w-4 rounded-full bg-white/20" />
                  </span>
                  <span className="flex gap-1">
                    <span className="h-1.5 w-1.5 rounded-full bg-white/20" />
                    <span className="h-1.5 w-1.5 rounded-full bg-white/20" />
                  </span>
                </div>
                {/* Instrument chip strip */}
                <div className="flex items-center justify-between border-b border-white/8 px-2 py-1.5">
                  <span className="rounded bg-[#f0b90b]/12 px-1.5 py-0.5 font-mono text-[7px] font-bold tracking-widest text-[#f0b90b]">XAUUSD</span>
                  <span className="h-1 w-5 rounded-full bg-white/12" />
                </div>
                {/* chart — stretches so the phone stands tall */}
                <div className="flex-1 px-1 pt-1">
                  <svg viewBox="0 0 120 130" className="h-full w-full" preserveAspectRatio="none">
                    <path d="M0 116 L12 106 L24 110 L36 88 L48 96 L60 72 L72 80 L84 56 L96 64 L108 44 L120 52 L120 130 L0 130 Z" fill="rgba(240,185,11,0.13)" />
                    <path d="M0 116 L12 106 L24 110 L36 88 L48 96 L60 72 L72 80 L84 56 L96 64 L108 44 L120 52" fill="none" stroke="#f0b90b" strokeWidth="1.6" />
                  </svg>
                </div>
                {/* order boxes — SELL over BUY, like the sheet */}
                <div className="grid grid-cols-2 gap-1.5 p-2">
                  <span className="rounded-md border border-[#ff6b6b]/25 bg-[#ff6b6b]/10 py-2 text-center font-mono text-[8px] font-bold tracking-widest text-[#ff6b6b]">SELL</span>
                  <span className="rounded-md border border-[#f0b90b]/25 bg-[#f0b90b]/10 py-2 text-center font-mono text-[8px] font-bold tracking-widest text-[#f0b90b]">BUY</span>
                </div>
                {/* trade FAB */}
                <div className="flex justify-end p-2.5 pt-1">
                  <span className="flex h-7 w-14 items-center justify-center rounded-full bg-[#f0b90b] font-sans text-[8px] font-bold text-[#0d0d0f]">Trade</span>
                </div>
              </div>
              {/* gloss shade */}
              <div className="pointer-events-none absolute inset-0 rounded-[18px] bg-linear-to-tr from-transparent via-white/4 to-white/6" />
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

/**
 * Trust & security — a registry ledger: the real company facts as labelled
 * entries in framed cards, headed by the registration summary line. Only
 * configured facts render; fallbacks stay generic and truthful.
 */
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
  const cards: Array<{ icon: LucideIcon; title: string; desc: string; meta: string | null; tags: string[] }> = [
    {
      icon: Landmark,
      title: t("company.title"),
      desc: companyDesc || t("company.fallback"),
      meta: brand.companyRegulator,
      tags: t.raw("company.tags") as string[],
    },
    {
      icon: Lock,
      title: t("segregated.title"),
      desc: t("segregated.desc"),
      meta: null,
      tags: t.raw("segregated.tags") as string[],
    },
    {
      icon: Umbrella,
      title: t("protection.title"),
      desc: brand.investorCompensationScheme || t("protection.fallback"),
      meta: null,
      tags: t.raw("protection.tags") as string[],
    },
  ];

  return (
    <section id="trust" className="ag-section scroll-mt-24 bg-[#111113]">
      <div className="ag-container">
        <Reveal>
          <span className="ag-eyebrow">{t("eyebrow")}</span>
          <h2 className="ag-h2 mt-4 max-w-2xl text-balance">{t("title")}</h2>
          <p className="ag-sub mt-4">{t("subtitle")}</p>
        </Reveal>
        <div className="mt-14 grid gap-4 md:grid-cols-3">
          {cards.map(({ icon: Icon, title, desc, meta, tags }, index) => (
            <Reveal key={title} delay={index * 90}>
              <article className="ag-bento-cell flex h-full flex-col p-8">
                <div className="flex items-center justify-between">
                  <Icon size={20} strokeWidth={1.75} className="text-[#f0b90b]" aria-hidden />
                  <span className="ag-stepnum">{String(index + 1).padStart(2, "0")}</span>
                </div>
                <h3 className="mt-6 text-base font-bold text-[#f1f3ef]">{title}</h3>
                <p className="mt-2.5 text-sm leading-relaxed text-[#a9a9ae]">{desc}</p>
                {meta && (
                  <p className="mt-5 text-[11px] font-medium uppercase tracking-[0.16em] text-[#75757b]">
                    {meta}
                  </p>
                )}
                {/* Institution pills — regulators, custody banks, protection
                    schemes (content-managed in the agile.trust namespace). */}
                {tags.length > 0 && (
                  <div className="mt-auto flex flex-wrap gap-2 pt-5">
                    {tags.map((tag) => (
                      <span
                        key={tag}
                        className="rounded-full border border-white/12 bg-white/5 px-3.5 py-1.5 text-[11px] font-semibold tracking-wide text-[#a9a9ae]"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </article>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

/**
 * Steps — numbered editorial onboarding: a vertical rule connecting three
 * indexed entries (01 / 02 / 03), no cards — calm, institutional.
 */
export async function StepsBand() {
  const t = await getTranslations("agile.steps");
  const steps = [
    { n: 1, title: t("s1.title"), desc: t("s1.desc"), icon: Gauge },
    { n: 2, title: t("s2.title"), desc: t("s2.desc"), icon: ShieldCheck },
    { n: 3, title: t("s3.title"), desc: t("s3.desc"), icon: CandlestickChart },
  ];
  return (
    <section id="get-started" className="ag-section relative scroll-mt-24 overflow-hidden bg-[#0d0d0f]">
      {/* <div className="pointer-events-none absolute inset-0 ag-mesh opacity-60" aria-hidden="true" /> */}
      <div className="ag-container relative">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div>
            <span className="ag-eyebrow">{t("eyebrow")}</span>
            <h2 className="ag-h2 mt-4 text-balance">{t("title")}</h2>
          </div>
          <p className="ag-sub max-w-sm! text-sm!">{t("subtitle")}</p>
        </div>

        <ol className="mt-16 grid gap-12 lg:grid-cols-3 lg:gap-12">
          {steps.map(({ n, title, desc }) => (
            <li key={n} className="relative flex gap-6 lg:flex-col lg:gap-0">
              {/* Connector — horizontal through the circles (desktop) */}
              <span
                aria-hidden="true"
                className="absolute left-7 top-6 hidden h-px w-[calc(100%-3.5rem)] lg:block"
                style={{ background: "linear-gradient(90deg, rgba(240,185,11,0.5), rgba(255,255,255,0.1) 70%, transparent)" }}
              />
              {/* Vertical connector for stacked/mobile */}
              <span
                aria-hidden="true"
                className="absolute left-7 top-14 h-[calc(100%-2.5rem)] w-px bg-linear-to-b from-[#f0b90b]/40 to-transparent lg:hidden"
              />
              <span className="relative z-10 flex h-14 w-14 shrink-0 items-center justify-center rounded-full border border-[#f0b90b]/40 bg-[#111113] tnum text-[15px] font-bold text-[#f0b90b] shadow-[0_0_24px_-8px_rgba(240,185,11,0.45)]">
                {String(n).padStart(2, "0")}
              </span>
              <div className="lg:mt-8">
                <h3 className="text-lg font-bold tracking-[-0.015em] text-[#f1f3ef]">{title}</h3>
                <p className="mt-2.5 max-w-sm text-sm leading-relaxed text-[#a9a9ae]">{desc}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

/**
 * Final CTA — the closing frame: full-bleed night-district plate under a
 * near-solid scrim, display headline, dual CTA and the platform's real
 * numbers as a closing ledger row.
 */
export async function FinalCta() {
  const t = await getTranslations("agile");
  const tCta = await getTranslations("finalCta");
  return (
    <section id="final-cta" className="relative scroll-mt-24 overflow-hidden bg-[#0d0d0f]">
      <SectionBackdrop
        src="/brands/gbfxs/backgrounds/cta-bg.jpg"
        opacity={0.5}
        position="center 30%"
        blur={0}
        filter="saturate(1.05)"
        scrim="linear-gradient(180deg, #0d0d0f 0%, rgba(13,13,15,0.82) 45%, rgba(13,13,15,0.9) 100%)"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{ background: "radial-gradient(60% 55% at 50% 0%, rgba(13, 15, 15,0.5), transparent 72%)" }}
      />
      <div className="ag-container relative py-28 lg:py-36">
        <Reveal>
          <div className="mx-auto max-w-3xl text-center">
            <span className="ag-eyebrow">{tCta("eyebrow")}</span>
            <h2 className="ag-display mt-6 text-[clamp(2.5rem,5vw,4.25rem)]!">{t("ctaTitle")}</h2>
            <p className="mx-auto mt-6 max-w-xl text-lg leading-relaxed text-[#a9a9ae]">{t("ctaSubtitle")}</p>
            <div className="mt-11 flex flex-wrap justify-center gap-3">
              <Link href="/register" className="ag-btn ag-btn-primary px-9">
                {tCta("primary")}
              </Link>
              <Link href="/login" className="ag-btn ag-btn-ghost">
                {tCta("secondary")}
              </Link>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
