"use client";

import { ArrowDownToLine, ArrowUpFromLine, LogOut, Settings, Shield, Sun, User } from "lucide-react";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { useForexStore } from "@/lib/store";
import { fmtNum, getFormatLocale } from "@/lib/format";
import { ConnectionDot } from "./ConnectionDot";
import { TradeSearchButton } from "@/components/GlobalSearchPalette";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { TerminalNotifications } from "./TerminalNotifications";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useTheme } from "@/components/ThemeProvider";
import { Logo } from "./Logo";
import { WalletModal } from "@/components/account/WalletModal";
import type { SocketStatus } from "@/lib/ws/client";
import type { WalletAddressEntry } from "@/server/userSettings";

interface Props {
  wsStatus: SocketStatus;
  depositUiEnabled?: boolean;
  disabledPaymentMethods?: string[];
  walletAddresses?: WalletAddressEntry[];
  /** Equity/margin ratio that marks the margin warning (user settings → env default 125). */
  marginWarningPercent?: number;
}

/**
 * AccountBar — the top metrics strip: account number, then Balance / Credit /
 * Margin / Equity / Margin Level / Free / P/L across the bar.
 *
 * The right side is a single user avatar/name trigger that opens a dropdown
 * panel containing quick actions (Deposit, Account, Reports, Admin) and sign
 * out — instead of cluttering the header with inline links.
 */
export function AccountBar({ wsStatus, depositUiEnabled = true, disabledPaymentMethods = [], walletAddresses = [], marginWarningPercent = 125 }: Props) {
  const account = useForexStore((s) => s.account);
  const { data: session } = useSession();
  const { theme } = useTheme();
  const router = useRouter();
  const [clock, setClock] = useState("");
  const [walletOpen, setWalletOpen] = useState(false);
  const [walletMode, setWalletMode] = useState<"deposit" | "withdraw">("deposit");

  useEffect(() => {
    const tick = () => {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone.split("/").pop()?.replace(/_/g, " ") ?? "";
      setClock(`${new Date().toLocaleTimeString(getFormatLocale(), { hour12: false })} ${tz}`);
    };
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, []);

  const floating = account?.floatingPl ?? 0;
  const floatingUp = floating >= 0;
  // Highlight margin metrics when margin level approaches call territory —
  // the warning band comes from resolved user settings (default 125%); below
  // 100% risks a margin call.
  const marginTight = account?.marginLevel != null && account.marginLevel > 0 && account.marginLevel < marginWarningPercent;
  const userName = session?.user?.name ?? session?.user?.email ?? "dev trader";
  const initial = userName[0]?.toUpperCase() ?? "U";

  return (
    <header className="relative z-40 flex min-h-11 shrink-0 flex-wrap items-center bg-canvas shadow-panel sm:flex-nowrap">
      {/* Logo — the TRADE badge is desktop-only; on the phone it just repeated
          where the user already is. */}
      <div className="flex items-center gap-2.5 px-3 shrink-0 h-full">
        <Logo inverted={theme === "dim"} />
        <span className="hidden sm:inline-block text-(length:--term-text-2xs) font-semibold text-brand bg-brand-soft px-1.5 py-0.5 rounded">TRADE</span>
      </div>

      {/* Metrics strip — phones get one compact horizontally-scrollable row
          (an intentional data strip: every key metric reachable, no vertical
          bulk); sm+ keeps the single dense row. */}
      <div className="order-3 flex w-full items-center gap-4 overflow-x-auto bg-panel px-3 py-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:order-0 sm:w-auto sm:gap-4 sm:overflow-visible sm:bg-transparent sm:py-0">
        <Metric label="ACCOUNT" value={account?.accountNo ?? "—"} className="hidden lg:flex" />
        <Metric label="BALANCE" value={fmtUsd(account?.balance)} />
        <Metric label="EQUITY" value={fmtUsd(account?.equity)} />
        <Metric label="FREE" value={fmtUsd(account?.free)} />
        <Metric
          label="P/L"
          value={`${floating >= 0 ? "+" : ""}${fmtNum(floating, 2)}`}
          valueClass={floatingUp ? "text-up" : "text-down"}
        />
        <Metric
          label="MARGIN"
          value={fmtUsd(account?.margin)}
          valueClass={marginTight ? "text-down font-semibold" : ""}
        />
        <Metric
          label="MARGIN LEVEL"
          value={account?.marginLevel != null ? `${fmtNum(account.marginLevel, 2)}%` : "—"}
          // No open position → the ratio is undefined; show a muted em dash so
          // it reads "not applicable" rather than a broken value.
          valueClass={account?.marginLevel == null ? "text-text-faint" : marginTight ? "text-down font-semibold" : ""}
        />
        <Metric label="CREDIT" value={fmtUsd(account?.credit)} className="hidden md:flex" />
      </div>

      {/* Connection + clock + search + theme toggle. The theme toggle lives in the user
          dropdown on phones — this row stays minimal: dot + search + avatar. */}
      <div className="ml-auto flex shrink-0 items-center gap-2 px-2 sm:px-3">
        <TradeSearchButton />
        <TerminalNotifications />
        <ConnectionDot status={wsStatus} />
        <span className="text-(length:--term-text-xs) text-text-muted tnum hidden lg:inline">{clock}</span>
        <span className="hidden sm:block">
          <ThemeToggle />
        </span>
      </div>

      {/* User dropdown — Radix primitive (same as the account portal menu):
          keyboard nav, typeahead, collision-aware placement, focus restore. */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-label="Open account menu"
            className="flex h-11 items-center gap-2.5 rounded-md px-2 transition-colors duration-150 hover:bg-panel-2 sm:px-2.5 in-data-[state=open]:bg-panel-2 focus-visible:outline-2 focus-visible:outline-brand"
          >
            <span className="flex w-8 h-8 shrink-0 items-center justify-center rounded-full bg-brand text-sm font-bold text-white shadow-sm ring-2 ring-brand/25 transition-transform duration-150 in-data-[state=open]:scale-105">
              {initial}
            </span>
            <span className="hidden min-w-0 text-left sm:block">
              <span className="block truncate text-xs font-semibold leading-tight">{userName}</span>
              <span className="block text-(length:--term-text-2xs) tnum leading-tight text-text-faint">{account?.accountNo ?? "—"}</span>
            </span>
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              aria-hidden="true"
              className="text-text-muted transition-transform duration-200 in-data-[state=open]:rotate-180"
            >
              <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-72 rounded-lg border border-border bg-canvas p-0 text-xs shadow-xl">
          {/* User header — premium avatar treatment */}
          <div className="bg-panel-2/50 px-4 py-3.5">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand text-base font-bold text-white shadow-sm ring-2 ring-brand/25">
                {initial}
              </span>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold">{userName}</div>
                <div className="truncate text-(length:--term-text-2xs) text-text-faint">{session?.user?.email}</div>
              </div>
              {session?.user?.role === "admin" && (
                <span className="shrink-0 rounded bg-brand-soft px-1.5 py-0.5 text-(length:--term-text-2xs) font-semibold uppercase text-brand">Admin</span>
              )}
            </div>
            <div className="mt-2.5 flex items-center gap-2 border-t border-border-soft pt-2">
              <span className="text-(length:--term-text-2xs) uppercase tracking-wide text-text-faint">Account</span>
              <span className="text-(length:--term-text-2xs) tnum font-medium">{account?.accountNo ?? "—"}</span>
            </div>
          </div>

          {/* Grouped actions */}
          <div className="p-1.5">
            <MenuGroupLabel>Money</MenuGroupLabel>
            {depositUiEnabled && (
              <MenuAction
                icon={<DepositIcon />}
                label="Deposit"
                hint="Fund your account"
                onSelect={() => { setWalletMode("deposit"); setWalletOpen(true); }}
              />
            )}
            <MenuAction
              icon={<WithdrawIcon />}
              label="Withdraw"
              hint="Request a payout"
              onSelect={() => { setWalletMode("withdraw"); setWalletOpen(true); }}
            />

            <MenuGroupLabel>Account</MenuGroupLabel>
            <MenuLink href="/account" icon={<AccountIcon />} label="My Account" />
            <MenuLink href="/account?tab=settings" icon={<SettingsIcon />} label="Settings" />
            {session?.user?.role === "admin" && (
              <>
                <MenuGroupLabel>Operations</MenuGroupLabel>
                <MenuLink href="/admin" icon={<AdminIcon />} label="Admin Console" />
              </>
            )}
          </div>

          {/* Theme control — the header keeps its toggle from sm up; on phones
              this is where dim mode lives. */}
          <div className="flex items-center gap-3 bg-panel-2/40 px-4 py-2 text-xs text-text">
            <span className="text-text-muted"><ThemeIcon /></span>
            <span className="flex-1 font-medium">Dim mode</span>
            <ThemeToggle />
          </div>

          {/* Sign out */}
          <div className="p-1.5">
            {session?.user ? (
              <DropdownMenuItem
                variant="destructive"
                className="gap-3 rounded-md px-3 py-2 text-xs text-down transition-colors duration-150 hover:bg-down/10 focus:bg-down/10 focus:text-down"
                onSelect={() => { void signOut({ redirect: false }).then(() => { window.location.assign("/login"); }); }}
              >
                <SignOutIcon />
                <span className="font-medium">Sign out</span>
              </DropdownMenuItem>
            ) : (
              <MenuLink href="/login" icon={<SignOutIcon />} label="Sign in" />
            )}
          </div>
        </DropdownMenuContent>
      </DropdownMenu>

      <WalletModal
        open={walletOpen}
        mode={walletMode}
        depositEnabled={depositUiEnabled}
        disabledMethods={disabledPaymentMethods as ("CARD" | "BANK_TRANSFER" | "CRYPTO")[]}
        walletAddresses={walletAddresses}
        onClose={() => setWalletOpen(false)}
        onDone={() => router.refresh()}
      />
    </header>
  );
}

function Metric({
  label,
  value,
  valueClass = "",
  className = "",
}: {
  label: string;
  value: string;
  valueClass?: string;
  className?: string;
}) {
  return (
    <div className={`flex flex-col gap-0 shrink-0 leading-tight ${className}`}>
      <span className="text-(length:--term-text-2xs) font-medium uppercase tracking-wide text-text-faint leading-none mb-0.5">{label}</span>
      <span className={`text-(length:--term-text-md) tnum leading-none font-semibold ${valueClass}`}>{value}</span>
    </div>
  );
}

function fmtUsd(v: number | null | undefined): string {
  if (v == null || !isFinite(v)) return "—";
  return v.toLocaleString(getFormatLocale(), { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// ── Dropdown menu helpers (Radix items with the terminal look) ───────────────

function MenuGroupLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-3 pb-1 pt-2.5 text-(length:--term-text-2xs) font-semibold uppercase tracking-wider text-text-faint first:pt-1.5">
      {children}
    </div>
  );
}

function MenuAction({
  icon,
  label,
  hint,
  onSelect,
}: {
  icon: React.ReactNode;
  label: string;
  hint?: string;
  onSelect: () => void;
}) {
  return (
    <DropdownMenuItem
      className="group gap-3 rounded-md px-3 py-2 text-xs text-text transition-colors duration-150 hover:bg-panel-2 focus:bg-panel-2 focus:text-text"
      onSelect={onSelect}
    >
      <span className="text-text-muted transition-colors duration-150 group-hover:text-text">{icon}</span>
      <span className="flex-1">
        <span className="font-medium block">{label}</span>
        {hint && <span className="text-(length:--term-text-2xs) text-text-faint">{hint}</span>}
      </span>
    </DropdownMenuItem>
  );
}

function MenuLink({ href, icon, label }: { href: string; icon: React.ReactNode; label: string }) {
  return (
    <DropdownMenuItem asChild className="group gap-3 rounded-md px-3 py-2 text-xs text-text transition-colors duration-150 hover:bg-panel-2 focus:bg-panel-2 focus:text-text">
      <Link href={href}>
        <span className="text-text-muted transition-colors duration-150 group-hover:text-text">{icon}</span>
        <span className="font-medium">{label}</span>
      </Link>
    </DropdownMenuItem>
  );
}

// ── Icons ────────────────────────────────────────────────────────────────────

const ic = "w-3.5 h-3.5";

function DepositIcon() {
  return <ArrowDownToLine size={14} strokeWidth={2} aria-hidden className={ic} />;
}
function WithdrawIcon() {
  return <ArrowUpFromLine size={14} strokeWidth={2} aria-hidden className={ic} />;
}
function AccountIcon() {
  return <User size={14} strokeWidth={2} aria-hidden className={ic} />;
}
function SettingsIcon() {
  return <Settings size={14} strokeWidth={2} aria-hidden className={ic} />;
}
function AdminIcon() {
  return <Shield size={14} strokeWidth={2} aria-hidden className={ic} />;
}
function ThemeIcon() {
  return <Sun size={14} strokeWidth={2} aria-hidden className={ic} />;
}
function SignOutIcon() {
  return <LogOut size={14} strokeWidth={2} aria-hidden className={ic} />;
}
