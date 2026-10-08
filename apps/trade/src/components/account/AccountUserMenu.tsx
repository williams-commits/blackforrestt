"use client";

import { CandlestickChart, ChevronDown, FileText, LogOut, Settings, User } from "lucide-react";

import { ThemeToggle } from "@/components/ui/ThemeToggle";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import Link from "next/link";
import { signOut } from "next-auth/react";

/**
 * Account chip + dropdown menu on the portal/trade headers. The open state,
 * outside-click and Escape handling ride on the Radix dropdown primitive;
 * visuals are unchanged (avatar initial chip, profile header, icon links,
 * destructive sign-out).
 */
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
  const initial = (displayName || email || "U").charAt(0).toUpperCase();

  return (
    <div className="ml-auto">
      <div className="flex items-center gap-2">
        <ThemeToggle className="h-8 w-8" />
        <DropdownMenu>
          <DropdownMenuTrigger
            asChild
          >
            <button
              type="button"
              className="flex max-w-[58vw] items-center gap-2 rounded-md px-2 py-1.5 text-left hover:bg-panel-2 sm:max-w-xs"
            >
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-soft text-xs font-semibold text-brand">{initial}</span>
              <span className="min-w-0 hidden sm:block">
                <span className="block truncate text-xs font-medium text-text">{displayName}</span>
                <span className="block truncate text-(length:--term-text-2xs) text-text-faint">#{accountNo ?? "—"}</span>
              </span>
              <span aria-hidden="true" className="text-xs text-text-muted transition-transform in-data-[state=open]:rotate-180">
                <ChevronDown size={11} strokeWidth={2.5} aria-hidden />
              </span>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-64 rounded-lg border border-border bg-canvas p-0 text-xs shadow-xl">
            <div className="border-b border-border bg-panel-2/60 px-4 py-3">
              <div className="truncate text-xs font-semibold">{displayName}</div>
              <div className="truncate text-(length:--term-text-2xs) text-text-faint">{email}</div>
            </div>
            <div className="p-1">
              <AccountMenuLink href="/account" label="My account" icon={<User size={14} strokeWidth={1.75} aria-hidden />} />
              <AccountMenuLink href="/trade/AUDCAD" label="Trading terminal" icon={<CandlestickChart size={14} strokeWidth={1.75} aria-hidden />} />
              <AccountMenuLink href="/reports" label="Trade reports" icon={<FileText size={14} strokeWidth={1.75} aria-hidden />} />
              {isAdmin && <AccountMenuLink href="/admin" label="Admin console" icon={<Settings size={14} strokeWidth={1.75} aria-hidden />} />}
            </div>
            <div className="border-t border-border p-1">
              <DropdownMenuItem
                variant="destructive"
                className="gap-3 rounded-none px-4 py-2 text-xs text-down focus:bg-down/10 focus:text-down"
                onSelect={() => {
                  void signOut({ redirect: false }).then(() => {
                    window.location.assign("/login");
                  });
                }}
              >
                <SignOutIcon />
                <span className="font-medium">Sign out</span>
              </DropdownMenuItem>
            </div>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}

const ic = "w-3.5 h-3.5";

function AccountMenuLink({ href, label, icon }: { href: string; label: string; icon?: React.ReactNode }) {
  return (
    <DropdownMenuItem asChild className="gap-3 rounded-none px-4 py-2 text-xs text-text focus:bg-panel-2 focus:text-text">
      <Link href={href}>
        <span className="text-text-muted">{icon}</span>
        <span className="font-medium">{label}</span>
      </Link>
    </DropdownMenuItem>
  );
}

function SignOutIcon() {
  return <LogOut size={14} strokeWidth={1.75} aria-hidden className={ic} />;
}
