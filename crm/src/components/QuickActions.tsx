"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Global quick actions (spec §36): a keyboard-friendly "+" menu with
 * shortcuts — Alt+N opens it; then a letter (l/c/a/k/t/i) jumps straight to
 * the relevant create form or tool.
 */
const ACTIONS: Array<{ key: string; label: string; href: string; hint: string }> = [
  { key: "l", label: "New lead", href: "/leads?new=1", hint: "l" },
  { key: "c", label: "New contact", href: "/contacts?new=1", hint: "c" },
  { key: "u", label: "New customer", href: "/customers?new=1", hint: "u" },
  { key: "a", label: "New account", href: "/accounts?new=1", hint: "a" },
  { key: "t", label: "New task", href: "/tasks?new=1", hint: "t" },
  { key: "i", label: "Import data", href: "/imports", hint: "i" },
];

export function QuickActions() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.altKey && event.key.toLowerCase() === "n") {
        event.preventDefault();
        setOpen((previous) => !previous);
        return;
      }
      if (!open) return;
      if (event.key === "Escape") {
        setOpen(false);
        return;
      }
      const action = ACTIONS.find((entry) => entry.key === event.key.toLowerCase());
      if (action) {
        event.preventDefault();
        setOpen(false);
        router.push(action.href);
      }
    }
    function onClickOutside(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onClickOutside);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onClickOutside);
    };
  }, [open, router]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((previous) => !previous)}
        aria-label="Quick actions (Alt+N)"
        className="rounded-md border border-[var(--border-strong)] px-2.5 py-1.5 text-sm font-semibold hover:bg-[var(--bg-hover)]"
      >
        +
      </button>
      {open ? (
        <div className="absolute right-0 top-full z-40 mt-1 w-56 rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] shadow-lg">
          <p className="border-b border-[var(--border-default)] px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--text-tertiary)]">
            Quick actions
          </p>
          {ACTIONS.map((action) => (
            <button
              key={action.key}
              type="button"
              onClick={() => {
                setOpen(false);
                router.push(action.href);
              }}
              className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-[var(--bg-hover)]"
            >
              {action.label}
              <kbd className="rounded border border-[var(--border-default)] px-1 text-[10px] text-[var(--text-tertiary)]">{action.hint}</kbd>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
