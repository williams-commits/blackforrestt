"use client";

import { useTranslations } from "next-intl";

/**
 * Visual-only password strength meter. Purely advisory — the only enforced
 * rule is the shared length policy (src/lib/passwordPolicy.ts); this just
 * nudges users toward stronger passwords without blocking submission.
 */

/** Advisory score 1–4 (0 = empty): length tiers plus character-variety bonus. */
function scorePassword(password: string): number {
  let points = 0;
  if (password.length >= 6) points += 1;
  if (password.length >= 10) points += 1;
  if (password.length >= 14) points += 1;
  const classes = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter((pattern) => pattern.test(password)).length;
  if (classes >= 2) points += 1;
  return Math.max(1, Math.min(4, points));
}

const LABEL_KEYS = ["pwWeak", "pwFair", "pwGood", "pwStrong"] as const;
const TONES = ["text-down", "text-brand", "text-up/80", "text-up"] as const;
const BAR_TONES = ["bg-down", "bg-brand", "bg-up/70", "bg-up"] as const;

export function PasswordStrength({ password, className = "" }: { password: string; className?: string }) {
  const t = useTranslations("auth");
  if (!password) return null;
  const score = scorePassword(password);
  const label = t(LABEL_KEYS[score - 1]);
  return (
    <div className={`flex items-center gap-2 ${className}`} aria-live="polite" role="status" aria-label={`Password strength: ${label}`}>
      <div className="flex h-1 flex-1 gap-1" aria-hidden="true">
        {[0, 1, 2, 3].map((segment) => (
          <span
            key={segment}
            className={`h-full flex-1 rounded-full transition-colors ${segment < score ? BAR_TONES[score - 1] : "bg-panel-3"}`}
          />
        ))}
      </div>
      <span className={`w-12 text-right text-[10px] ${TONES[score - 1]}`}>{label}</span>
    </div>
  );
}
