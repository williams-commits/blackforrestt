"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

/**
 * Global quick actions (spec §36): a keyboard-friendly "+" menu with
 * shortcuts — Alt+N opens it; then a letter (l/c/u/a/t/i) jumps straight to
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
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, router]);

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="secondary" aria-label="Quick actions (Alt+N)">
          +
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          Quick actions
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {ACTIONS.map((action) => (
          <DropdownMenuItem
            key={action.key}
            onClick={() => {
              setOpen(false);
              router.push(action.href);
            }}
            className="flex w-full items-center justify-between"
          >
            {action.label}
            <kbd className="rounded border border-border bg-muted px-1 text-[10px] text-muted-foreground">{action.hint}</kbd>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
