import Link from "next/link";

/** blckforest wordmark with a simple tree-mark glyph. */
export function Logo({
  className = "",
  inverted = false,
}: {
  className?: string;
  /** Use on dark backgrounds: renders the wordmark in white instead of dark. */
  inverted?: boolean;
}) {
  return (
    <Link href="/" className={`flex items-center gap-2 select-none ${className}`}>
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M12 1.5 7.5 9H10l-3 5.5H9.5L7 19h10l-2.5-4.5H17l-3-5.5h2.5L12 1.5Z" fill="var(--color-brand)" />
        <rect x="11" y="19" width="2" height="3.5" fill="var(--color-brand)" />
      </svg>
      <span className="text-base font-semibold tracking-tight">
        <span className={inverted ? "text-white" : "text-text"}>blck</span>
        <span className="text-brand">forest</span>
      </span>
    </Link>
  );
}
