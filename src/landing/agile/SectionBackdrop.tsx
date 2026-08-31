/**
 * Decorative full-bleed photo layer for Agile landing sections.
 *
 * Glass grammar: the plate itself is FROSTED (optional blur + saturation
 * filter, scaled up so soft edges never show), then a scrim gradient keeps
 * a near-solid dark field wherever text sits — so copy always lands on dark,
 * and the image reads as frosted glass everywhere else. Panels/tiles that
 * float on the plate use the .ag-glass / .ag-glass-tile tokens.
 *
 * Pure CSS backgrounds (no <img> element) so plates lazy-load off the
 * critical rendering path and never compete with the LCP headline.
 * Server- and client-component safe (no hooks).
 */
export function SectionBackdrop({
  src,
  scrim,
  opacity = 0.4,
  position = "center",
  filter,
  blur = 0,
}: {
  src: string;
  /** CSS background painted over the plate — keep ≥0.5 alpha near text. */
  scrim: string;
  opacity?: number;
  /** CSS background-position, e.g. "62% 40%". */
  position?: string;
  /** Extra CSS filter (e.g. "saturate(0.6)") applied with any blur. */
  filter?: string;
  /** Frosted-glass blur on the plate itself, in px. */
  blur?: number;
}) {
  const combinedFilter = [blur > 0 ? `blur(${blur}px)` : null, filter]
    .filter(Boolean)
    .join(" ");
  return (
    <>
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-cover bg-no-repeat"
        style={{
          backgroundImage: `url("${src}")`,
          opacity,
          backgroundPosition: position,
          filter: combinedFilter || undefined,
          // Scale up when blurred so the softened edges never reveal the
          // flat section background at the frame borders.
          transform: blur > 0 ? "scale(1.08)" : undefined,
        }}
      />
      <div aria-hidden="true" className="pointer-events-none absolute inset-0" style={{ background: scrim }} />
    </>
  );
}
