"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
import { clientTradeUrl } from "@/lib/branding";

interface Props {
  eyebrow: string;
  title: string;
  description?: string;
  children: ReactNode;
  sidebar?: ReactNode;
}

/**
 * Global Forex Services interior-page architecture — the landing's design system applied
 * to content routes:
 *
 *   header band  — brand-yellow statement plate, ink type, hairline, eyebrow ·
 *                  confident title · sub (mirrors the landing's yellow bands)
 *   body         — the deep-charcoal canvas at a comfortable measure,
 *                  sections in the landing's type and card grammar
 *   closing CTA  — the landing's yellow conversion band, so every interior
 *                  page ends in the product's voice
 *
 * This is the Agile replacement for the primary brand's editorial article
 * layout; selection happens in @/landing/composition (the host dispatcher),
 * never inside the components.
 */
export function AgileArticleLayout({ eyebrow, title, description, children, sidebar }: Props) {
  const t = useTranslations("finalCta");

  return (
    <div>
      {/* Header band — split composition: narrative left, desk mark right. */}
      <header className="ag-page-band ag-cell-yellow border-b border-black/10">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 bottom-0 h-px"
          style={{ background: "linear-gradient(90deg, transparent, rgba(13,13,15,0.45) 30%, rgba(13,13,15,0.16) 55%, transparent)" }}
        />
        <div className="ag-container relative grid items-center gap-8 py-12 sm:py-16 lg:grid-cols-[1.25fr_0.75fr] lg:py-20">
          <div>
            <span className="ag-eyebrow ag-eyebrow-ink">{eyebrow}</span>
            <h1 className="ag-h2 ag-ink-h2 mt-4 max-w-2xl text-balance">{title}</h1>
            {description && <p className="ag-sub ag-ink-sub mt-5 max-w-xl">{description}</p>}
          </div>
          {/* Desk mark — the brand's chart motif, framed. Decorative. */}
          <div className="ag-frame hidden p-5 lg:block" aria-hidden="true">
            <svg viewBox="0 0 220 80" className="w-full" focusable="false">
              <defs>
                <linearGradient id="ag-page-fill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="rgba(240,185,11,0.24)" />
                  <stop offset="100%" stopColor="rgba(240,185,11,0)" />
                </linearGradient>
              </defs>
              {[16, 32, 48, 64].map((y) => (
                <line key={y} x1="0" y1={y} x2="220" y2={y} stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
              ))}
              <path
                d="M0 64 L20 56 L40 60 L60 44 L80 50 L100 34 L120 40 L140 26 L160 32 L180 18 L200 24 L220 12 L220 80 L0 80 Z"
                fill="url(#ag-page-fill)"
              />
              <path
                d="M0 64 L20 56 L40 60 L60 44 L80 50 L100 34 L120 40 L140 26 L160 32 L180 18 L200 24 L220 12"
                fill="none"
                stroke="#f0b90b"
                strokeWidth="1.8"
                strokeLinecap="round"
              />
              <circle cx="220" cy="12" r="2.6" fill="#f0b90b" />
            </svg>
          </div>
        </div>
      </header>

      {/* Body */}
      <div className="ag-container py-14 lg:py-20">
        {sidebar ? (
          <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_280px]">
            <article className="prose-content space-y-8">{children}</article>
            <aside className="space-y-4 lg:sticky lg:top-24 self-start">{sidebar}</aside>
          </div>
        ) : (
          <article className="prose-content max-w-3xl space-y-8">{children}</article>
        )}
      </div>

      {/* Closing CTA — the landing's yellow band, ending every interior
          page in the product's voice. Same honest copy as the landing. */}
      <aside className="ag-page-cta ag-cell-yellow relative overflow-hidden">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
          style={{ background: "radial-gradient(46% 90% at 82% -20%, rgba(255,255,255,0.3), transparent 70%)" }}
        />
        <div className="ag-container relative flex flex-col items-start justify-between gap-6 py-12 lg:flex-row lg:items-center lg:py-14">
          <div>
            <h2 className="text-2xl font-bold tracking-[-0.02em] text-[#0d0d0f] lg:text-3xl">{t("title")}</h2>
            <p className="mt-2 max-w-md text-sm leading-relaxed text-[#0d0d0f]/72">{t("subtitle")}</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link href={clientTradeUrl("/register")} className="ag-btn ag-btn-ink">
              {t("primary")}
            </Link>
            <Link
              href={clientTradeUrl("/login")}
              className="ag-btn ag-btn-ghost border-[#0d0d0f]/30! text-[#0d0d0f]! hover:bg-[#0d0d0f]/8!"
            >
              {t("secondary")}
            </Link>
          </div>
        </div>
      </aside>
    </div>
  );
}

/**
 * A styled section block inside an Agile article: sans heading in the Agile
 * voice, hairline-underlined, generous body spacing. The shared token scope
 * keeps any nested token-styled markup on the Agile palette.
 */
export function AgileSection({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <section>
      {title && (
        <h2 className="mb-5 text-xl font-bold tracking-[-0.015em] text-[#f1f3ef]">
          {title}
          <span
            aria-hidden="true"
            className="mt-2.5 block h-px w-full"
            style={{ background: "linear-gradient(90deg, rgba(240,185,11,0.5), rgba(255,255,255,0.1) 40%, transparent 80%)" }}
          />
        </h2>
      )}
      <div className="space-y-3">{children}</div>
    </section>
  );
}
