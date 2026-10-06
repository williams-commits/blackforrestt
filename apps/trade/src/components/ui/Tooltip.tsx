import type { ReactNode } from "react";

/** Shared hover/focus tooltip bubble styles (see Tooltip and InfoHint). */
const BUBBLE_BASE =
  "pointer-events-none absolute left-1/2 z-50 w-44 -translate-x-1/2 rounded border border-border bg-panel-2 p-2 text-center text-[11px] leading-snug text-text-muted opacity-0 shadow-lg transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100";

/** Wrap any inline element with a styled tooltip revealed on hover or focus.
 *  Use placement="bottom" for elements near the top of the viewport (navbars,
 *  header bars) so the bubble isn't clipped by the screen edge.
 *  Replaces native title-attribute tooltips, which show nothing on many
 *  setups (long delay, suppressed hovers, all touch devices). */
export function Tooltip({
  text,
  children,
  placement = "top",
}: {
  text: string;
  children: ReactNode;
  placement?: "top" | "bottom";
}) {
  const placementClasses = placement === "bottom" ? "top-full mt-1.5" : "bottom-full mb-1.5";
  return (
    <span className="group relative inline-flex min-w-0 max-w-full">
      {children}
      <span role="tooltip" className={`${BUBBLE_BASE} ${placementClasses}`}>
        {text}
      </span>
    </span>
  );
}
