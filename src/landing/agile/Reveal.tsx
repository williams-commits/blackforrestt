"use client";

import { useEffect, useRef, type ReactNode } from "react";

/**
 * Scroll-reveal wrapper: fades content up once as it enters the viewport.
 * The motion itself is disabled under prefers-reduced-motion via the
 * .ag-reveal rules in AgileStyles — this component only toggles the class.
 */
export function Reveal({
  children,
  delay = 0,
  className = "",
}: {
  children: ReactNode;
  /** Stagger in milliseconds — keep within the 0-300ms range. */
  delay?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    if (typeof IntersectionObserver === "undefined") {
      node.classList.add("ag-reveal-in");
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            node.classList.add("ag-reveal-in");
            observer.disconnect();
          }
        }
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.05 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={ref} className={`ag-reveal ${className}`} style={delay ? { transitionDelay: `${delay}ms` } : undefined}>
      {children}
    </div>
  );
}
