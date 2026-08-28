"use client";

import { CandlestickChart, ChevronDown, FileText, LogOut, Settings, User } from "lucide-react";

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
            <AccountMenuLink href="/trade/AUDCAD" label="Trading terminal" onSelect={() => setOpen(false)} icon={<TradeTerminal />} />
            <AccountMenuLink href="/reports" label="Trade reports" onSelect={() => setOpen(false)} icon={<ReportsIcon />} />
            {isAdmin && <AccountMenuLink href="/admin" label="Admin console" onSelect={() => setOpen(false)} icon={<SettingsIcon />} />}
          </div>
          <div className="border-t border-border p-1">
            <button
              type="button"
              role="menuitem"
              onClick={() => void signOut({ redirect: false }).then(() => { window.location.assign("/login"); })}
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
  return <User size={14} strokeWidth={1.75} aria-hidden />;
}
function ReportsIcon() {
  return <FileText size={14} strokeWidth={1.75} aria-hidden />;
}
function SettingsIcon() {
  return <Settings size={14} strokeWidth={1.75} aria-hidden />;
}

function TradeTerminal() {
  return <CandlestickChart size={14} strokeWidth={1.75} aria-hidden className={ic} />;
}



function SignOutIcon() {
  return <LogOut size={14} strokeWidth={1.75} aria-hidden />;
}

function ChevronIcon({ open }: { open: boolean }) {
  return <ChevronDown size={11} strokeWidth={2.5} aria-hidden className={`transition-transform ${open ? "rotate-180" : ""}`} />;
}
