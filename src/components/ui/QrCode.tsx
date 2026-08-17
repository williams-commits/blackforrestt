"use client";

import { useEffect, useRef } from "react";
import QRCodeStyling from "qr-code-styling";

/**
 * Modern styled deposit QR — rounded dots and brand-orange corner eyes drawn
 * by qr-code-styling. The center tree mark is overlaid as an inline React SVG,
 * NOT via the library's `image` option (whose async image-loading path stalls
 * and leaves the QR blank in this environment). An inline DOM overlay involves
 * zero image loading, so the code always renders.
 *
 * Renders as inline SVG — CSP-safe, no external requests. Colours are fixed
 * (dark dots / brand eyes on white) rather than theme-aware: QR contrast must
 * stay constant for reliable scanning.
 */

const BRAND_ORANGE = "#fd7e14";
const INK = "#17202a";

export function QrCode({
  value,
  size = 132,
  label,
  withLogo = true,
}: {
  value: string;
  size?: number;
  label?: string;
  /** Overlay the BlackForest tree mark in the center. */
  withLogo?: boolean;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const disc = Math.round(size * 0.3);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || !value) return;
    const qr = new QRCodeStyling({
      type: "svg",
      width: size,
      height: size,
      data: value,
      margin: 6,
      qrOptions: { errorCorrectionLevel: "H" },
      // Rounded body dots — the modern look.
      dotsOptions: { color: INK, type: "rounded" },
      // Brand-orange finder eyes: outer ring extra-rounded, inner dot circular.
      cornersSquareOptions: { color: BRAND_ORANGE, type: "extra-rounded" },
      cornersDotOptions: { color: BRAND_ORANGE, type: "dot" },
      backgroundOptions: { color: "#ffffff" },
    });
    container.innerHTML = "";
    qr.append(container);
    return () => {
      container.innerHTML = "";
    };
  }, [value, size]);

  return (
    <div className="flex flex-col items-center gap-1.5">
      <div
        className="rounded-lg border border-border bg-white p-2 shadow-panel"
        style={{ width: size + 16, height: size + 16 }}
      >
        <div className="relative" style={{ width: size, height: size }}>
          <div ref={containerRef} role="img" aria-label={label ? `QR code: ${label}` : "QR code"} style={{ width: size, height: size }} />
          {withLogo && (
            <span
              aria-hidden
              className="pointer-events-none absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-xl bg-white"
              style={{ width: disc, height: disc }}
            >
              <svg width={Math.round(disc * 0.62)} height={Math.round(disc * 0.62)} viewBox="0 0 24 24" fill="none">
                <path d="M12 1.5 7.5 9H10l-3 5.5H9.5L7 19h10l-2.5-4.5H17l-3-5.5h2.5L12 1.5Z" fill={BRAND_ORANGE} />
                <rect x="11" y="19" width="2" height="3.5" fill={BRAND_ORANGE} />
              </svg>
            </span>
          )}
        </div>
      </div>
      <span className="text-[10px] text-text-faint">Scan to pay</span>
    </div>
  );
}
