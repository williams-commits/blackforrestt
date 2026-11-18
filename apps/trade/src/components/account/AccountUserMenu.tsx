"use client";

import type { ReactNode } from "react";
import { CandlestickChart, ChevronDown, LogOut, MessageSquare, Settings, Shield, UserRound } from "lucide-react";

import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { UserAvatar } from "@/components/ui/UserAvatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import Link from "next/link";
import { signOut } from "next-auth/react";

/**
 * Shared account/admin header menu. The dropdown uses the terminal's compact
 * grouped navigation treatment while keeping the Radix interaction behavior.
 */
export function AccountUserMenu({
  userId,
  displayName,
  email,
  accountNo,
  secondaryLabel,
  isAdmin,
}: {
  userId?: string | null;
  displayName: string;
  email: string;
  accountNo: string | null;
  secondaryLabel?: string;
  isAdmin: boolean;
}) {
  const identity = userId || email || displayName;
  const accountLabel = secondaryLabel ?? `#${accountNo ?? "—"}`;

  return (
    <div className="ml-auto">
      <div className="flex items-center gap-2">
        <ThemeToggle />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              aria-label={`Open account menu for ${displayName}`}
              className="flex h-10 max-w-[58vw] items-center gap-2 rounded-lg bg-panel-2 px-1.5 text-left transition-colors duration-150 hover:bg-panel focus-visible:outline-2 focus-visible:outline-brand sm:max-w-xs sm:px-2"
            >
              <UserAvatar
                identity={identity}
                name={displayName}
                size="md"
                className="transition-transform duration-150 in-data-[state=open]:scale-105"
              />
              <span className="hidden min-w-0 text-left sm:block">
                <span className="block max-w-36 truncate text-xs font-semibold leading-tight">{displayName}</span>
                <span className="block truncate text-(length:--term-text-2xs) leading-tight text-text-faint">{accountLabel}</span>
              </span>
              <span className="shrink-0 text-text-muted">
                <ChevronDown size={12} strokeWidth={2.5} aria-hidden />
              </span>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-64 rounded-xl p-0 text-xs shadow-xl sm:w-72">
            <div className="bg-panel-2/50 px-3 py-2.5 sm:px-4 sm:py-3.5">
              <div className="flex items-center gap-2.5 sm:gap-3">
                <UserAvatar identity={identity} name={displayName} size="lg" />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold text-text">{displayName}</div>
                  <div className="truncate text-(length:--term-text-2xs) text-text-faint">{email}</div>
                </div>
                {isAdmin && (
                  <span className="shrink-0 rounded bg-brand-soft px-1.5 py-0.5 text-(length:--term-text-2xs) font-semibold uppercase text-brand">
                    Admin
                  </span>
                )}
              </div>
              <div className="mt-2 flex items-center gap-2 border-t border-border-soft pt-1.5 sm:mt-2.5 sm:pt-2">
                <span className="text-(length:--term-text-2xs) uppercase tracking-wide text-text-faint">
                  {accountNo ? "Account" : "Access"}
                </span>
                <span className="truncate text-(length:--term-text-2xs) font-medium text-text">{accountLabel}</span>
              </div>
            </div>

            <div className="p-1 sm:p-1.5">
              <MenuGroupLabel>Workspace</MenuGroupLabel>
              <AccountMenuLink href="/account" label="My account" icon={<UserRound size={14} strokeWidth={2} aria-hidden />} />
              <AccountMenuLink href="/trade/AUDCAD" label="Trading terminal" icon={<CandlestickChart size={14} strokeWidth={2} aria-hidden />} />
              {isAdmin && (
                <>
                  <MenuGroupLabel>Operations</MenuGroupLabel>
                  <AccountMenuLink href="/admin" label="Admin console" icon={<Shield size={14} strokeWidth={2} aria-hidden />} />
                </>
              )}
              <MenuGroupLabel>Account</MenuGroupLabel>
              <AccountMenuLink href="/account?tab=messages" label="Messages" icon={<MessageSquare size={14} strokeWidth={2} aria-hidden />} />
              <AccountMenuLink href="/account?tab=settings" label="Settings" icon={<Settings size={14} strokeWidth={2} aria-hidden />} />
            </div>

            <div className="p-1 sm:p-1.5">
              <DropdownMenuItem
                variant="destructive"
                className="group gap-2.5 rounded-md px-2.5 py-1.5 text-xs text-down transition-colors duration-150 hover:bg-down/10 focus:bg-down/10 focus:text-down sm:gap-3 sm:px-3 sm:py-2"
                onSelect={() => {
                  void signOut({ redirect: false }).then(() => {
                    window.location.assign("/login");
                  });
                }}
              >
                <LogOut size={14} strokeWidth={2} aria-hidden />
                <span className="font-medium">Sign out</span>
              </DropdownMenuItem>
            </div>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}

function MenuGroupLabel({ children }: { children: ReactNode }) {
  return (
    <div className="px-2.5 pb-0.5 pt-1.5 text-(length:--term-text-2xs) font-semibold uppercase tracking-wider text-text-faint first:pt-1 sm:px-3 sm:pb-1 sm:pt-2.5 first:sm:pt-1.5">
      {children}
    </div>
  );
}

function AccountMenuLink({ href, label, icon }: { href: string; label: string; icon: ReactNode }) {
  return (
    <DropdownMenuItem
      asChild
      className="group gap-2.5 rounded-md px-2.5 py-1.5 text-xs text-text transition-colors duration-150 hover:bg-panel-2 focus:bg-panel-2 focus:text-text sm:gap-3 sm:px-3 sm:py-2"
    >
      <Link href={href}>
        <span className="text-text-muted transition-colors duration-150 group-hover:text-text">{icon}</span>
        <span className="font-medium">{label}</span>
      </Link>
    </DropdownMenuItem>
  );
}
