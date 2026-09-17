import type { LandingDesignProps } from "@/designs/contracts";

/** Starter landing — renders the content contract's essentials. */
export async function TemplateLanding({ content, brand }: LandingDesignProps) {
  return (
    <>
      <main id="main-content" tabIndex={-1}>
        <section id="hero">
          <h1>{content.landing.hero.titleA ?? brand.name}</h1>
          <p>{content.landing.hero.subtitle}</p>
        </section>
        <section id="final-cta">
          <h2>{content.landing.finalCta.title}</h2>
        </section>
      </main>
    </>
  );
}
