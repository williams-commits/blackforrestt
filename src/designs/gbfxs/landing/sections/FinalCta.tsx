/** FinalCta — split from the former Bottom.tsx monolith (Phase 7 structural pass). */
import Link from "next/link";
import type { FinalCtaContent } from "@/content/contracts";
import {  } from "lucide-react"
import { Reveal } from "@/components/landing/Reveal"
import { SectionBackdrop } from "../visuals/SectionBackdrop"

export function FinalCta({ content, ctaBackground }: { content: FinalCtaContent; ctaBackground?: string }) {
  return (
    <section id="final-cta" className="ag-section-compact relative scroll-mt-24 overflow-hidden bg-[#0d0d0f]">
      {ctaBackground ? <SectionBackdrop
        src={ctaBackground}
        opacity={0.5}
        position="center 30%"
        blur={0}
        filter="saturate(1.05)"
        scrim="linear-gradient(180deg, #0d0d0f 0%, rgba(13,13,15,0.82) 45%, rgba(13,13,15,0.9) 100%)"
      /> : null}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{ background: "radial-gradient(60% 55% at 50% 0%, rgba(13, 15, 15,0.5), transparent 72%)" }}
      />
      <div className="ag-container relative">
        <Reveal>
          <div className="mx-auto max-w-3xl text-center">
            <span className="ag-eyebrow">{content.eyebrow}</span>
            <h2 className="ag-display mt-6 text-[clamp(2.5rem,5vw,4.25rem)]!">{content.title}</h2>
            <p className="mx-auto mt-6 max-w-xl text-lg leading-relaxed text-[#a9a9ae]">{content.subtitle}</p>
            <div className="mt-11 flex flex-wrap justify-center gap-3">
              <Link href="/register" className="ag-btn ag-btn-primary px-9">
                {content.ctaPrimaryLabel}
              </Link>
              <Link href="/login" className="ag-btn ag-btn-ghost">
                {content.ctaSecondaryLabel}
              </Link>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
