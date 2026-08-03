"use client";

import Link from "next/link";
import { signOut } from "next-auth/react";
import { useEffect, useRef, useState } from "react";

export function AccountUserMenu({
  displayName,
  email,
  accountNo,
  isAdmin,
}: {
  displayName: string;
  email: string;
  accountNo: string | null;
  isAdmin: boolean;
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const initial = (displayName || email || "U").charAt(0).toUpperCase();

  useEffect(() => {
    if (!open) return;
    const closeOutside = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const closeEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", closeOutside);
    document.addEventListener("keydown", closeEscape);
    return () => {
      document.removeEventListener("mousedown", closeOutside);
      document.removeEventListener("keydown", closeEscape);
    };
  }, [open]);

  return (
    <div ref={containerRef} className="relative ml-auto">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="flex max-w-[58vw] items-center gap-2 rounded-md px-2 py-1.5 text-left hover:bg-panel-2 sm:max-w-xs"
      >
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-soft text-xs font-semibold text-brand">{initial}</span>
        <span className="min-w-0 hidden sm:block">
          <span className="block truncate text-xs font-medium text-text">{displayName}</span>
          <span className="block truncate text-[10px] text-text-faint">#{accountNo ?? "—"}</span>
        </span>
        <span aria-hidden="true" className={`text-xs text-text-muted transition-transform ${open ? "rotate-180" : ""}`}>⌄</span>
      </button>

      {open && (
        <div role="menu" className="absolute right-0 z-50 mt-1 w-64 overflow-hidden rounded-lg border border-border bg-canvas shadow-xl">
          <div className="border-b border-border bg-panel-2/60 px-4 py-3">
            <div className="truncate text-xs font-semibold">{displayName}</div>
            <div className="truncate text-[10px] text-text-faint">{email}</div>
          </div>
          <div className="p-1 text-xs">
            <AccountMenuLink href="/account" label="My account" onSelect={() => setOpen(false)} />
            <AccountMenuLink href="/trade/AUDCAD" label="Trading terminal" onSelect={() => setOpen(false)} />
            <AccountMenuLink href="/reports" label="Trade reports" onSelect={() => setOpen(false)} />
            {isAdmin && <AccountMenuLink href="/admin" label="Admin console" onSelect={() => setOpen(false)} />}
          </div>
          <div className="border-t border-border p-1">
            <button
              type="button"
              role="menuitem"
              onClick={() => void signOut({ callbackUrl: "/login" })}
              className="w-full rounded px-3 py-2 text-left text-xs text-down hover:bg-down/10"
            >
              Sign out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function AccountMenuLink({ href, label, onSelect }: { href: string; label: string; onSelect: () => void }) {
  return <Link role="menuitem" href={href} onClick={onSelect} className="block rounded px-3 py-2 hover:bg-panel-2">{label}</Link>;
}
