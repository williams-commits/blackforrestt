"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Star } from "lucide-react";

export interface Testimonial {
  quote: string;
  name: string;
  role: string;
  /** Avatar image path (photo avatars under /brands/agilefgs/testimonials/). */
  avatar: string;
}

/** Quote glyph from the Agile feedback identity, recolored via currentColor. */
function QuoteMark() {
  return (
    <svg width="26" height="26" viewBox="0 0 55 55" fill="none" aria-hidden="true" className="text-[#63e891]/60">
      <path
        d="M19.25 16.5L22 11H16.5C10.4225 11 5.5 18.6725 5.5 24.75V44H24.75V24.75H13.75C13.75 16.5 19.25 16.5 19.25 16.5ZM38.5 24.75C38.5 16.5 44 16.5 44 16.5L46.75 11H41.25C35.1725 11 30.25 18.6725 30.25 24.75V44H49.5V24.75H38.5Z"
        fill="currentColor"
      />
    </svg>
  );
}

/** Five-star rating row — the feedback mark of the Agile identity. */
function Stars() {
  return (
    <span role="img" aria-label="Rated 5 out of 5" className="flex items-center gap-0.5 text-[#63e891]">
      {Array.from({ length: 5 }).map((_, index) => (
        <Star key={index} size={13} strokeWidth={0} fill="currentColor" aria-hidden />
      ))}
    </span>
  );
}

/**
 * Testimonial carousel — native scroll-snap track (touch, trackpad and
 * keyboard friendly) with desktop arrow controls and pagination dots. The
 * scrollbar is fully suppressed on every engine; no autoplay, so it stays
 * reduced-motion safe by construction.
 */
export function TestimonialCarousel({ items }: { items: Testimonial[] }) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);

  // Track which card is in view to highlight its dot.
  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        const index = visible ? Number((visible.target as HTMLElement).dataset.index) : NaN;
        if (!Number.isNaN(index)) setActive(index);
      },
      { root: track, threshold: 0.6 },
    );
    for (const card of track.querySelectorAll("[data-card]")) observer.observe(card);
    return () => observer.disconnect();
  }, [items.length]);

  const scrollCards = (direction: 1 | -1) => {
    const track = trackRef.current;
    if (!track) return;
    const first = track.querySelector<HTMLElement>("[data-card]");
    const step = first ? first.offsetWidth + 20 : track.clientWidth * 0.8;
    track.scrollBy({ left: direction * step, behavior: "smooth" });
  };

  const goTo = (index: number) => {
    const track = trackRef.current;
    const card = track?.querySelectorAll<HTMLElement>("[data-card]")[index];
    card?.scrollIntoView({ behavior: "smooth", inline: "start", block: "nearest" });
  };

  return (
    <div className="relative">
      <div
        ref={trackRef}
        role="region"
        aria-label="Customer testimonials"
        className="flex snap-x snap-mandatory gap-5 overflow-x-scroll overscroll-x-contain [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:display-none [&::-webkit-scrollbar]:hidden"
      >
        {items.map((item, index) => (
          <article
            key={item.name}
            data-card
            data-index={index}
            aria-roledescription="slide"
            aria-label={`${index + 1} / ${items.length}`}
            className="ag-glass-tile ag-card-hover flex w-[86%] shrink-0 snap-start flex-col justify-between p-7 sm:w-[55%] lg:w-[31.8%]"
          >
            <div>
              <div className="flex items-start justify-between gap-3">
                <QuoteMark />
                <Stars />
              </div>
              <p className="mt-5 text-[15px] leading-relaxed text-[#f1f3ef]/90">{item.quote}</p>
            </div>
            <div className="mt-7 flex items-center gap-3 border-t border-white/12 pt-5">
              {/* eslint-disable-next-line @next/next/no-img-element -- decorative photo avatar; name sits adjacent */}
              <img
                src={item.avatar}
                alt=""
                width={44}
                height={44}
                loading="lazy"
                decoding="async"
                className="h-11 w-11 shrink-0 rounded-full border border-white/15 object-cover"
              />
              <div>
                <h4 className="text-sm font-bold text-[#f1f3ef]">{item.name}</h4>
                <p className="mt-0.5 text-[11px] text-[#747a75]">{item.role}</p>
              </div>
            </div>
          </article>
        ))}
      </div>

      {/* Desktop arrows, floating at the track edges. */}
      <button
        type="button"
        onClick={() => scrollCards(-1)}
        aria-label="Previous testimonials"
        className="absolute -left-5 top-1/2 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-white/14 bg-[#0d100f]/70 text-[#a7ada8] backdrop-blur transition-colors hover:border-[#63e891]/50 hover:text-[#63e891] lg:flex"
      >
        <ChevronLeft size={18} strokeWidth={2} aria-hidden />
      </button>
      <button
        type="button"
        onClick={() => scrollCards(1)}
        aria-label="Next testimonials"
        className="absolute -right-5 top-1/2 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-white/14 bg-[#0d100f]/70 text-[#a7ada8] backdrop-blur transition-colors hover:border-[#63e891]/50 hover:text-[#63e891] lg:flex"
      >
        <ChevronRight size={18} strokeWidth={2} aria-hidden />
      </button>

      {/* Pagination dots. */}
      <div className="mt-7 flex justify-center gap-2">
        {items.map((item, index) => (
          <button
            key={item.name}
            type="button"
            onClick={() => goTo(index)}
            aria-label={`Go to testimonial ${index + 1}`}
            aria-current={active === index}
            className={`h-1.5 rounded-full transition-all ${
              active === index ? "w-6 bg-[#63e891]" : "w-1.5 bg-white/20 hover:bg-white/40"
            }`}
          />
        ))}
      </div>
    </div>
  );
}
