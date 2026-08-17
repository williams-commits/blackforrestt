"use client";

import { useState } from "react";

/** Labeled grid of decrypted payment method details. Long values (wallet
 *  addresses, transaction hashes) render in monospace with a copy button so
 *  finance reviewers can inspect and reuse the complete strings. */
export function MethodDetailsGrid({ details }: { details: Record<string, string> }) {
  const [copied, setCopied] = useState<string | null>(null);

  async function copy(value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(value);
      setTimeout(() => setCopied((current) => (current === value ? null : current)), 1_500);
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
                  onClick={() => void copy(value)}
                  className="shrink-0 rounded px-1.5 py-0.5 text-[10px] text-text-faint hover:bg-panel-3 hover:text-brand"
                >
                  {copied === value ? "✓ Copied" : "Copy"}
                </button>
              )}
            </dd>
          </div>
        );
      })}
    </dl>
  );
}
