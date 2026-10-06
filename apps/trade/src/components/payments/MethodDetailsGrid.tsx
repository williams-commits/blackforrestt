"use client";

import { useState } from "react";

/** Labeled grid of decrypted payment method details. Long values (wallet
 *  addresses, transaction hashes) render in monospace with a copy button so
 *  finance reviewers can inspect and reuse the complete strings. */
export function MethodDetailsGrid({ details }: { details: Record<string, string> }) {
  // Keyed by field label (unique per grid) — keying by value would light up
  // every button sharing the same string (e.g. repeated addresses).
  const [copiedLabel, setCopiedLabel] = useState<string | null>(null);

  async function copy(label: string, value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedLabel(label);
      setTimeout(() => setCopiedLabel((current) => (current === label ? null : current)), 1_500);
    } catch {
      // Clipboard unavailable (permissions/embedded contexts) — value stays selectable.
    }
  }

  return (
    <dl className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
      {Object.entries(details).map(([label, value]) => {
        const long = value.length > 20;
        return (
          <div key={label} className="rounded border border-border-soft bg-panel-2 px-2.5 py-2">
            <dt className="text-[10px] uppercase tracking-wide text-text-faint">{label}</dt>
            <dd className="mt-0.5 flex items-start gap-1.5 text-xs text-text">
              <span className={`min-w-0 break-words ${long ? "font-mono text-[11px] leading-4" : ""}`}>{value}</span>
              {long && (
                <button
                  type="button"
                  onClick={() => void copy(label, value)}
                  className="shrink-0 rounded px-1.5 py-0.5 text-[10px] text-text-faint hover:bg-panel-3 hover:text-brand"
                >
                  {copiedLabel === label ? "✓ Copied" : "Copy"}
                </button>
              )}
            </dd>
          </div>
        );
      })}
    </dl>
  );
}
