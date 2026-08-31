import Link from "next/link";

/**
 * The Agile wordmark, eToro-concept: a PROMINENT lowercase wordmark with
 * chunky geometric symbol accents. The angle brackets are drawn as SVG
 * strokes (round caps/joins, accent green) rather than thin text glyphs, so
 * the mark reads as a designed lockup at large size. Renders its own home
 * link — never wrap it in another (same rule as the shared Logo).
 */
export function AgileMark({ className = "", size = "md" }: { className?: string; size?: "md" | "lg" }) {
  const wordClass = size === "lg" ? "text-[27px]" : "text-2xl";
  const bracketWidth = size === "lg" ? 12 : 11;
  const bracketHeight = size === "lg" ? 24 : 22;

  return (
    <Link
      href="/"
      aria-label="Agile FGS — home"
      className={`flex select-none items-center gap-0.75 ${className}`}
    >
      <Bracket direction="left" width={bracketWidth} height={bracketHeight} />
      <span className={`${wordClass} font-extrabold leading-none tracking-[0.06em] text-[#63e891]`}>
        agile
      </span>
      <Bracket direction="right" width={bracketWidth} height={bracketHeight} />
    </Link>
  );
}

/** One angle bracket as a designed stroke — round caps, accent green. */
function Bracket({ direction, width, height }: { direction: "left" | "right"; width: number; height: number }) {
  const path = direction === "left" ? "M8.5 2.5 L2.5 11 L8.5 19.5" : "M2.5 2.5 L8.5 11 L2.5 19.5";
  return (
    <svg width={width} height={height} viewBox="0 0 11 22" fill="none" aria-hidden="true">
      <path d={path} stroke="#63E891" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
