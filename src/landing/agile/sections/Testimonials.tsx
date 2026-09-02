import { getTranslations } from "next-intl/server";
import { Star } from "lucide-react";
import { Reveal } from "@/components/landing/Reveal";

/** Photo avatars in the source feedback order (Anton→2, Sophie→3, Carlos→1…). */
const AVATARS = [2, 3, 1, 4, 5].map(
  (n) => `/brands/agilefgs/testimonials/feedback__avatar-${n}.svg`,
);

interface Testimonial {
  quote: string;
  name: string;
  role: string;
  avatar: string;
  /** Illustrative per-story stats (card design, like the sample). */
  returns?: string;
  trades?: string;
}

/** The per-story stat strip: Returns (mint) + Trades (mono count). */
function StoryStats({ returns, trades, label }: { returns?: string; trades?: string; label: { returns: string; trades: string } }) {
  if (!returns && !trades) return null;
  return (
    <div className="flex items-center gap-6">
      {returns && (
        <span className="flex flex-col gap-0.5">
          <span className="tnum text-lg font-extrabold tracking-[-0.02em] text-[#63e891]">{returns}</span>
          <span className="text-[9.5px] font-semibold uppercase tracking-[0.16em] text-[#747a75]">{label.returns}</span>
        </span>
      )}
      {trades && (
        <span className="flex flex-col gap-0.5">
          <span className="tnum text-lg font-extrabold tracking-[-0.02em] text-[#f1f3ef]">{trades}</span>
          <span className="text-[9.5px] font-semibold uppercase tracking-[0.16em] text-[#747a75]">{label.trades}</span>
        </span>
      )}
    </div>
  );
}

/**
 * Testimonials — a static bento: the section voice sits in a deep-green
 * feature panel (with the five-star mark), the client stories fill a card
 * grid beside it — four tiles and one wide cell. No carousel: the grid IS
 * the composition, every story visible at once.
 */
export async function TestimonialsSection() {
  const t = await getTranslations("agile.testimonials");
  const items = (t.raw("items") as Testimonial[]).map((item, index) => ({
    ...item,
    avatar: AVATARS[index] ?? AVATARS[0],
  }));
  const tiles = items.slice(0, 4);
  const wide = items[4];

  return (
    <section id="reviews" className="relative scroll-mt-24 overflow-hidden bg-[#0d100f] pb-24 pt-4">
      <div className="ag-container relative">
        <div className="grid gap-5 lg:grid-cols-[0.85fr_1.5fr]">
          {/* Feature panel — the section voice. */}
          <Reveal className="h-full">
            <div className="ag-cell-accent relative flex h-full flex-col overflow-hidden rounded-[14px] p-9 lg:p-10">
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-0"
                style={{ background: "radial-gradient(90% 60% at 90% -10%, rgba(99,232,145,0.14), transparent 60%)" }}
              />
              <div className="relative flex h-full flex-col">
                <span className="ag-eyebrow">{t("eyebrow")}</span>
                <h2 className="ag-h2 mt-4 text-[clamp(1.6rem,2.4vw,2.1rem)]!">{t("title")}</h2>
                <span role="img" aria-label="Rated 5 out of 5" className="mt-auto flex items-center gap-1 pt-10 text-[#63e891]">
                  {Array.from({ length: 5 }).map((_, index) => (
                    <Star key={index} size={16} strokeWidth={0} fill="currentColor" aria-hidden />
                  ))}
                </span>
              </div>
            </div>
          </Reveal>

          {/* Story grid — four tiles + one wide cell. */}
          <div className="grid gap-5 sm:grid-cols-2">
            {tiles.map((item, index) => (
              <Reveal key={item.name} delay={index * 80}>
                <figure className="ag-bento-cell flex h-full flex-col p-7">
                  {/* eslint-disable-next-line @next/next/no-img-element -- decorative portrait; name sits below */}
                  <img
                    src={item.avatar}
                    alt=""
                    width={56}
                    height={56}
                    loading="lazy"
                    decoding="async"
                    className="h-14 w-14 rounded-full border border-white/15 object-cover"
                  />
                  <blockquote className="mt-5 flex-1">
                    <p className="text-[14.5px] leading-relaxed text-[#f1f3ef]/90">“{item.quote}”</p>
                  </blockquote>
                  <div className="mt-5">
                    <StoryStats returns={item.returns} trades={item.trades} label={{ returns: t("returns"), trades: t("trades") }} />
                  </div>
                  <figcaption className="mt-4 border-t border-white/10 pt-4">
                    <div className="text-[13px] font-bold text-[#f1f3ef]">{item.name}</div>
                    <div className="mt-0.5 text-[11px] text-[#747a75]">{item.role}</div>
                  </figcaption>
                </figure>
              </Reveal>
            ))}

            {wide && (
              <Reveal delay={320} className="sm:col-span-2">
                <figure className="ag-bento-cell flex flex-col items-start gap-6 p-7 sm:flex-row">
                  {/* eslint-disable-next-line @next/next/no-img-element -- decorative portrait; name sits adjacent */}
                  <img
                    src={wide.avatar}
                    alt=""
                    width={56}
                    height={56}
                    loading="lazy"
                    decoding="async"
                    className="h-14 w-14 shrink-0 rounded-full border border-white/15 object-cover"
                  />
                  <div className="min-w-0 flex-1">
                    <blockquote className="flex-1">
                      <p className="text-[14.5px] leading-relaxed text-[#f1f3ef]/90">“{wide.quote}”</p>
                    </blockquote>
                    <div className="mt-4 flex flex-wrap items-end justify-between gap-4 border-t border-white/10 pt-4">
                      <figcaption className="flex items-center gap-3">
                        <div className="text-[13px] font-bold text-[#f1f3ef]">{wide.name}</div>
                        <span aria-hidden="true" className="h-0.5 w-0.5 rounded-full bg-[#747a75]" />
                        <div className="text-[11px] text-[#747a75]">{wide.role}</div>
                      </figcaption>
                      <StoryStats returns={wide.returns} trades={wide.trades} label={{ returns: t("returns"), trades: t("trades") }} />
                    </div>
                  </div>
                </figure>
              </Reveal>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
