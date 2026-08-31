import { getTranslations } from "next-intl/server";
import { Reveal } from "../Reveal";
import { TestimonialCarousel, type Testimonial } from "../TestimonialCarousel";

/**
 * Testimonials — "Real feedback": the closing social proof before the final
 * CTA. Same charcoal band and ambient glows as the steps section above it,
 * so the color bridge into the deep-green CTA still starts from #0d100f.
 */
/** Photo avatars in the source feedback order (Anton→2, Sophie→3, Carlos→1…). */
const AVATARS = [2, 3, 1, 4, 5].map(
  (n) => `/brands/agilefgs/testimonials/feedback__avatar-${n}.svg`,
);

export async function TestimonialsSection() {
  const t = await getTranslations("agile.testimonials");
  const items = (t.raw("items") as Testimonial[]).map((item, index) => ({
    ...item,
    avatar: AVATARS[index] ?? AVATARS[0],
  }));

  return (
    <section id="reviews" className="relative scroll-mt-24 overflow-hidden bg-[#0d100f] pb-24 pt-6">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(36% 50% at 50% 0%, rgba(38,59,51,0.5), transparent 70%), radial-gradient(30% 44% at 85% 85%, rgba(38,59,51,0.35), transparent 70%)",
        }}
      />
      <div className="ag-container relative">
        <Reveal className="mx-auto max-w-2xl text-center">
          <span className="ag-eyebrow">{t("eyebrow")}</span>
          <h2 className="ag-h2 mt-3">{t("title")}</h2>
        </Reveal>
      </div>
      <div className="relative mt-12">
        <TestimonialCarousel items={items} />
      </div>
    </section>
  );
}
