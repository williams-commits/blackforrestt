"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * IdentityTile — the app's single tinted identity circle. Content is either
 * a Lucide icon (semantic surfaces: payments, transactions, support) or
 * initials (real identities: users, referrals). One component so size, tone
 * and rounding stay consistent everywhere.
 */
export function IdentityTile({
  children,
  tone = "muted",
  size = "md",
  className,
}: {
  children: ReactNode;
  tone?: "up" | "down" | "warn" | "brand" | "muted";
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const tones: Record<string, string> = {
    up: "bg-up/10 text-up",
    down: "bg-down/10 text-down",
    warn: "bg-(--term-warning-bg) text-(--term-warning-fg)",
    brand: "bg-primary/10 text-primary",
    muted: "bg-muted text-muted-foreground",
  };
  const sizes: Record<string, string> = {
    sm: "size-8",
    md: "size-9",
    lg: "size-12",
  };
  return (
    <span
      aria-hidden
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full",
        tones[tone],
        sizes[size],
        className,
      )}
    >
      {children}
    </span>
  );
}

/** Initials helper — derives up to two characters from a name/email. */
export function initialsOf(name: string | null | undefined): string {
  const source = (name ?? "?").trim();
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return source.slice(0, 2).toUpperCase() || "?";
}
