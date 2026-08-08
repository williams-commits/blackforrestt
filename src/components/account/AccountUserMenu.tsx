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
        <span aria-hidden="true" className={`text-xs text-text-muted transition-transform}`}>
          <ChevronIcon open={open} />
        </span>
      </button>

      {open && (
        <div role="menu" className="absolute right-0 z-50 mt-1 w-64 overflow-hidden rounded-lg border border-border bg-canvas shadow-xl">
          <div className="border-b border-border bg-panel-2/60 px-4 py-3">
            <div className="truncate text-xs font-semibold">{displayName}</div>
            <div className="truncate text-[10px] text-text-faint">{email}</div>
          </div>
          <div className="p-1 text-xs">
            <AccountMenuLink href="/account" label="My account" onSelect={() => setOpen(false)} icon={<AccountIcon />} />
            <AccountMenuLink href="/trade/AUDCAD" label="Trading terminal" onSelect={() => setOpen(false)} icon={<SettingsIcon />} />
            <AccountMenuLink href="/reports" label="Trade reports" onSelect={() => setOpen(false)} icon={<ReportsIcon />} />
            {isAdmin && <AccountMenuLink href="/admin" label="Admin console" onSelect={() => setOpen(false)} icon={<SettingsIcon />} />}
          </div>
          <div className="border-t border-border p-1">
            <button
              type="button"
              role="menuitem"
              onClick={() => void signOut({ callbackUrl: "/login" })}
              className="w-full flex items-center gap-3 px-4 py-2 text-xs text-down hover:bg-down/10 transition-colors"
            >
              <span className="text-down">
                <SignOutIcon />
              </span>
              <span className="font-medium">Sign out</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

const ic = "w-3.5 h-3.5";

function AccountMenuLink({ href, label, onSelect, icon}: { href: string; label: string; onSelect: () => void; icon?: React.ReactNode }) {
  return (
    <Link
      href={href}
      onClick={onSelect}
      className="w-full flex items-center gap-3 px-4 py-2 text-xs text-text hover:bg-panel-2 transition-colors"
    >
      <span className="text-text-muted">{icon}</span>
      <span className="font-medium">{label}</span>
    </Link>
  );
}

function AccountIcon() {
  return (
    <svg className={ic} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21v-1a8 8 0 0116 0v1" strokeLinecap="round" />
    </svg>
  );
}
function ReportsIcon() {
  return (
    <svg className={ic} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="4" y="3" width="16" height="18" rx="2" />
      <path d="M8 8h8M8 12h8M8 16h5" strokeLinecap="round" />
    </svg>
  );
}
function SettingsIcon() {
  return (
    <svg className={ic} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.8-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 11-4 0v-.1a1.7 1.7 0 00-1.1-1.5 1.7 1.7 0 00-1.8.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00.3-1.8 1.7 1.7 0 00-1.5-1H3a2 2 0 110-4h.1a1.7 1.7 0 001.5-1.1 1.7 1.7 0 00-.3-1.8l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.8.3H9a1.7 1.7 0 001-1.5V3a2 2 0 114 0v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.8-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.8V9a1.7 1.7 0 001.5 1H21a2 2 0 110 4h-.1a1.7 1.7 0 00-1.5 1z" />
    </svg>
  );
}

function SignOutIcon() {
  return (
    <svg className={ic} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={`transition-transform ${open ? "rotate-180" : ""}`}>
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}
