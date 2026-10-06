/**
 * Skeleton — premium loading placeholder with a shimmer sweep.
 * Uses the .skeleton-shimmer gradient animation defined in globals.css
 * (theme-aware: works in both light and dim modes).
 */
export function Skeleton({ className = "" }: { className?: string }) {
  return <div aria-hidden className={`skeleton-shimmer rounded-md ${className}`} />;
}
