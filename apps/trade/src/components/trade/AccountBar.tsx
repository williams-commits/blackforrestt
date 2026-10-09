"use client";

import { FileText, LogOut, Minus, Plus, Settings, Shield, Sun, User } from "lucide-react";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { useForexStore } from "@/lib/store";
import { fmtNum, getFormatLocale } from "@/lib/format";
import { ConnectionDot } from "./ConnectionDot";
import { TradeSearchButton } from "@/components/GlobalSearchPalette";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
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
  onOpenAssets?: () => void;
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
export function AccountBar({ wsStatus, onOpenAssets, depositUiEnabled = true, disabledPaymentMethods = [], walletAddresses = [], marginWarningPercent = 125 }: Props) {
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
    <header className="relative z-40 flex min-h-11 shrink-0 flex-wrap items-center bg-canvas border-b border-border sm:flex-nowrap">
      {/* Logo — the TRADE badge is desktop-only; on the phone it just repeated
          where the user already is. */}
      <div className="flex items-center gap-2.5 px-3 shrink-0 h-full">
        <Logo inverted={theme === "dim"} />
        <span className="hidden sm:inline-block text-(length:--term-text-2xs) font-semibold text-brand bg-brand-soft px-1.5 py-0.5 rounded">TRADE</span>
      </div>

      {/* Assets button — md+ only. On phones the chart header already has an
          assets entry point; a second one here only crowded the top row. */}
      {onOpenAssets && (
        <button
          type="button"
          onClick={onOpenAssets}
          className="hidden md:flex items-center gap-1.5 px-3 h-full text-(length:--term-text-xs) font-medium text-text-muted hover:text-text hover:bg-panel-2 border-r border-border transition-colors shrink-0"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="3" width="7" height="7" rx="1" />
            <rect x="14" y="3" width="7" height="7" rx="1" />
            <rect x="3" y="14" width="7" height="7" rx="1" />
            <rect x="14" y="14" width="7" height="7" rx="1" />
          </svg>
          Assets
        </button>
      )}

      {/* Metrics strip — phones get a compact 2×3 grid: every key account
          metric (margin and margin level included) visible at once with
          consistent columns; sm+ keeps the single dense row. */}
      <div className="order-3 grid w-full grid-cols-3 gap-x-3 gap-y-1.5 border-t border-border px-3 py-2 sm:order-0 sm:flex sm:w-auto sm:items-center sm:gap-4 sm:border-t-0 sm:py-0">
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
        <ConnectionDot status={wsStatus} />
        <span className="text-(length:--term-text-xs) text-text-muted tnum hidden lg:inline">{clock}</span>
        <span className="hidden sm:block">
          <ThemeToggle className="h-8 w-8" />
        </span>
      </div>

      {/* User dropdown — Radix primitive (same as the account portal menu):
          keyboard nav, typeahead, collision-aware placement, focus restore. */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-label="Open account menu"
            className="flex h-11 items-center gap-2 px-2.5 transition-colors hover:bg-panel-2 sm:px-3 in-data-[state=open]:bg-panel-2"
          >
            <span className="w-7 h-7 rounded-full bg-brand-soft flex items-center justify-center text-brand font-semibold text-xs">
              {initial}
            </span>
            <span className="text-xs font-medium max-w-23 sm:max-w-30 truncate">{userName}</span>
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              aria-hidden="true"
              className="text-text-muted transition-transform in-data-[state=open]:rotate-180"
            >
              <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-64 rounded-lg border border-border bg-canvas p-0 text-xs shadow-xl">
          {/* User header */}
          <div className="border-b border-border bg-panel-2/50 px-4 py-3">
            <div className="flex items-center gap-2.5">
              <span className="w-9 h-9 rounded-full bg-brand-soft flex items-center justify-center text-brand font-semibold">
                {initial}
              </span>
              <div className="min-w-0">
                <div className="text-xs font-semibold truncate">{userName}</div>
                <div className="text-(length:--term-text-2xs) text-text-faint truncate">{session?.user?.email}</div>
              </div>
            </div>
            <div className="flex items-center gap-2 mt-2">
              <span className="text-(length:--term-text-2xs) text-text-faint uppercase">Account</span>
              <span className="text-(length:--term-text-2xs) tnum font-medium">{account?.accountNo ?? "—"}</span>
              {session?.user?.role === "admin" && (
                <span className="ml-auto text-(length:--term-text-2xs) px-1.5 py-0.5 rounded bg-brand-soft text-brand font-semibold uppercase">Admin</span>
              )}
            </div>
          </div>

          {/* Quick actions */}
          <div className="py-1">
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
            <MenuLink href="/account" icon={<AccountIcon />} label="My Account" />
            <MenuLink href="/reports" icon={<ReportsIcon />} label="Trade Reports" />
            <MenuLink href="/account?tab=settings" icon={<SettingsIcon />} label="Settings" />
            {session?.user?.role === "admin" && (
              <MenuLink href="/admin" icon={<AdminIcon />} label="Admin Console" />
            )}
          </div>

          {/* Theme control — the header keeps its toggle from sm up; on phones
              this is where dim mode lives. */}
          <div className="flex items-center gap-3 border-t border-border px-4 py-2 text-xs text-text">
            <span className="text-text-muted"><ThemeIcon /></span>
            <span className="flex-1 font-medium">Dim mode</span>
            <ThemeToggle className="h-7 w-7" />
          </div>

          {/* Sign out */}
          <div className="border-t border-border py-1">
            {session?.user ? (
              <DropdownMenuItem
                variant="destructive"
                className="gap-3 rounded-none px-4 py-2 text-xs text-down focus:bg-down/10 focus:text-down"
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
      className="gap-3 rounded-none px-4 py-2 text-xs text-text focus:bg-panel-2 focus:text-text"
      onSelect={onSelect}
    >
      <span className="text-text-muted">{icon}</span>
      <span className="flex-1">
        <span className="font-medium block">{label}</span>
        {hint && <span className="text-(length:--term-text-2xs) text-text-faint">{hint}</span>}
      </span>
    </DropdownMenuItem>
  );
}

function MenuLink({ href, icon, label }: { href: string; icon: React.ReactNode; label: string }) {
  return (
    <DropdownMenuItem asChild className="gap-3 rounded-none px-4 py-2 text-xs text-text focus:bg-panel-2 focus:text-text">
      <Link href={href}>
        <span className="text-text-muted">{icon}</span>
        <span className="font-medium">{label}</span>
      </Link>
    </DropdownMenuItem>
  );
}

// ── Icons ────────────────────────────────────────────────────────────────────

const ic = "w-3.5 h-3.5";

function DepositIcon() {
  return <Plus size={14} strokeWidth={2} aria-hidden className={ic} />;
}
function WithdrawIcon() {
  return <Minus size={14} strokeWidth={2} aria-hidden className={ic} />;
}
function AccountIcon() {
  return <User size={14} strokeWidth={2} aria-hidden className={ic} />;
}
function ReportsIcon() {
  return <FileText size={14} strokeWidth={2} aria-hidden className={ic} />;
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
