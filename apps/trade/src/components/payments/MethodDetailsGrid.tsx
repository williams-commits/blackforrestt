"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";

/** Labeled rows of decrypted payment method details (account slider and
 *  finance review). Long values — wallet addresses, transaction hashes —
 *  render in monospace with a quiet copy button. */
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
    <dl className="space-y-1">
      {Object.entries(details).map(([label, value]) => {
        const long = value.length > 20;
        return (
          <div key={label} className="flex min-w-0 flex-col gap-1 rounded-lg px-3 py-2.5 transition-colors hover:bg-muted/40 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
            <dt className="pt-0.5 text-xs text-muted-foreground sm:shrink-0">{label}</dt>
            <dd className="flex min-w-0 max-w-full items-start gap-1.5 text-left sm:justify-end sm:text-right">
              <span className={`min-w-0 break-all text-sm ${long ? "font-mono text-xs leading-relaxed" : "font-medium"}`}>{value}</span>
              {long && (
                <button
                  type="button"
                  onClick={() => void copy(label, value)}
                  aria-label={`Copy ${label}`}
                  className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  {copiedLabel === label
                    ? <Check size={12} strokeWidth={2.5} aria-hidden />
                    : <Copy size={12} strokeWidth={2} aria-hidden />}
                </button>
              )}
            </dd>
          </div>
        );
      })}
    </dl>
  );
}
