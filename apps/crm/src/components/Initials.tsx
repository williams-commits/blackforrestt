"use client";

import { cn } from "@/lib/utils";

/**
 * Initials — the gradient name avatar used in tables and lists.
 * Deterministic: the same name always gets the same gradient, so a person
 * is recognizable across leads, tasks, audit, and the people table.
 *
 * Sizes: xs (20px, dense tables) · sm (24px, default tables) · md (28px)
 * · lg (44px, profile headers).
 */

const GRADIENTS = [
  "from-sky-400 to-blue-600",
  "from-violet-400 to-purple-600",
  "from-amber-400 to-orange-600",
  "from-rose-400 to-pink-600",
  "from-teal-400 to-emerald-600",
  "from-cyan-400 to-sky-600",
  "from-fuchsia-400 to-purple-600",
  "from-lime-400 to-green-600",
  "from-indigo-400 to-violet-600",
  "from-orange-400 to-red-600",
] as const;

const SIZES = {
  xs: "size-5 text-[9px]",
  sm: "size-6 text-[10px]",
  md: "size-7 text-[11px]",
  lg: "size-11 text-sm",
} as const;

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function gradientOf(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  }
  return GRADIENTS[hash % GRADIENTS.length];
}

export function Initials({
  name,
  size = "sm",
  className,
}: {
  name: string;
  size?: keyof typeof SIZES;
  className?: string;
}) {
  return (
    <span
      aria-hidden
      title={name}
      className={cn(
        "inline-flex shrink-0 select-none items-center justify-center rounded-md bg-linear-to-br font-semibold text-white shadow-xs",
        SIZES[size],
        gradientOf(name),
        className,
      )}
    >
      {initialsOf(name)}
    </span>
  );
}
