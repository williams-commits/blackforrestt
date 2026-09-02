import Link from "next/link";

/**
 * The Agile wordmark — the eToro-concept lockup: chunky rounded angle
 * brackets flanking a lowercase wordmark, all in the identity mint. The
 * brackets use the reference mark's exact geometry (cropped views of the
 * original 107×20 paths); the word renders in Inter extrabold. Renders its
 * own home link — never wrap it in another (same rule as the shared Logo).
 */

/** The reference mark's left bracket, cropped to its own bounding box. */
const LEFT_BRACKET = {
  d: "M5.90644 5.60209C6.22243 5.28726 6.72429 5.28726 7.04028 5.60209L8.1927 6.75033C8.50868 7.06516 8.50868 7.56519 8.1927 7.88003L4.23358 11.8248L8.1741 15.751C8.49009 16.0658 8.49009 16.5658 8.1741 16.8807L7.04028 18.0104C6.72429 18.3252 6.22243 18.3252 5.90644 18.0104L0.237292 12.3618C-0.0786924 12.047 -0.0786924 11.547 0.237292 11.2321L5.90644 5.60209Z",
  viewBox: "-0.1 5.28 8.62 13.06",
};

/** The reference mark's right bracket (same geometry, mirrored position). */
const RIGHT_BRACKET = {
  d: "M101.056 5.60209C100.74 5.28726 100.239 5.28726 99.9226 5.60209L98.7702 6.75033C98.4542 7.06516 98.4542 7.56519 98.7702 7.88003L102.729 11.8248L98.7888 15.751C98.4728 16.0658 98.4728 16.5658 98.7888 16.8807L99.9226 18.0104C100.239 18.3252 100.74 18.3252 101.056 18.0104L106.726 12.3618C107.042 12.047 107.042 11.547 106.726 11.2321L101.056 5.60209Z",
  viewBox: "98.44 5.28 8.62 13.06",
};

function Bracket({ d, viewBox, w, h }: { d: string; viewBox: string; w: number; h: number }) {
  return (
    <svg width={w} height={h} viewBox={viewBox} fill="#63E891" aria-hidden="true" focusable="false">
      <path d={d} />
    </svg>
  );
}

export function AgileMark({ className = "", size = "md" }: { className?: string; size?: "md" | "lg" }) {
  const wordClass = size === "lg" ? "text-[27px]" : "text-[22px]";
  const bracketH = size === "lg" ? 20 : 16;
  const bracketW = Math.round(bracketH * (7.62 / 13.06));

  return (
    <Link
      href="/"
      aria-label="Agile FGS — home"
      className={`flex select-none items-center gap-1 ${className}`}
    >
      <Bracket d={LEFT_BRACKET.d} viewBox={LEFT_BRACKET.viewBox} w={bracketW} h={bracketH} />
      <span className={`${wordClass} font-extrabold leading-none tracking-widest text-[#63e891]`}>
        agile
      </span>
      <Bracket d={RIGHT_BRACKET.d} viewBox={RIGHT_BRACKET.viewBox} w={bracketW} h={bracketH} />
    </Link>
  );
}
