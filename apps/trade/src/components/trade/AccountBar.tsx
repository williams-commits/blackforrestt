"use client";

import { ArrowDownToLine, ArrowUpFromLine, CandlestickChart, ChartNoAxesCombined, ChevronDown, Ellipsis, LogOut, Menu, Settings, Shield, Sun, User } from "lucide-react";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { useForexStore } from "@/lib/store";
import { fmtNum, getFormatLocale } from "@/lib/format";
import { TradeSearchButton } from "@/components/GlobalSearchPalette";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { TerminalNotifications } from "./TerminalNotifications";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useTheme } from "@/components/ThemeProvider";
import { Logo } from "./Logo";
import { WalletModal } from "@/components/account/WalletModal";
import { WorkspaceNavigation } from "@/components/WorkspaceNavigation";
import type { SocketStatus } from "@/lib/ws/client";
import type { WalletAddressEntry } from "@/server/userSettings";
import type { InstrumentView } from "@/lib/types";
import { InstrumentMarketStatus } from "./InstrumentMarketStatus";
import { UserAvatar } from "@/components/ui/UserAvatar";

interface Props {
  instrument: InstrumentView;
  marketDataMode: string;
  wsStatus: SocketStatus;
  onOpenInstrumentSwitcher: () => void;
  depositUiEnabled?: boolean;
  disabledPaymentMethods?: string[];
  walletAddresses?: WalletAddressEntry[];
  /** Equity/margin ratio that marks the margin warning (user settings → env default 125). */
  marginWarningPercent?: number;
}

/** Responsive trading menubar with instrument status, key account metrics,
 *  and account actions; secondary metrics stay available in the overflow menu. */
export function AccountBar({
  instrument,
  marketDataMode,
  wsStatus,
  onOpenInstrumentSwitcher,
  depositUiEnabled = true,
  disabledPaymentMethods = [],
  walletAddresses = [],
  marginWarningPercent = 125,
}: Props) {
  const account = useForexStore((s) => s.account);
  const { data: session } = useSession();
  const { theme } = useTheme();
  const router = useRouter();
  const [clock, setClock] = useState("");
  const [walletOpen, setWalletOpen] = useState(false);
  const [walletMode, setWalletMode] = useState<"deposit" | "withdraw">("deposit");

  useEffect(() => {
    const tick = () => {
      setClock(new Date().toLocaleTimeString(getFormatLocale(), {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
      }));
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
  const userName = session?.user?.name ?? session?.user?.email ?? "Trader";
  const userIdentity = session?.user?.id ?? session?.user?.email ?? userName;
  const showAdmin = session?.user?.role === "admin";

  return (
    <header className="relative z-40 grid shrink-0 grid-cols-[auto_minmax(0,1fr)_auto] grid-rows-[minmax(2.5rem,auto)_auto_auto] items-center gap-x-1 border-b border-border-soft bg-canvas px-2 py-1 shadow-panel md:grid-rows-[minmax(3rem,auto)_auto] lg:flex lg:min-h-12 lg:flex-nowrap lg:gap-2 lg:px-3">
      <div className="col-start-1 row-start-1 flex shrink-0 items-center gap-1">
        <WorkspaceMenu symbol={instrument.symbol} showAdmin={showAdmin} />
        <div className="flex items-center gap-2">
          <Logo inverted={theme === "dim"} />
          <WorkspaceNavigation
            current="trade"
            showAdmin={showAdmin}
            className="hidden shrink-0 xl:flex"
          />
        </div>
      </div>

      <div className="col-span-3 row-start-2 min-w-0 md:col-start-2 md:col-span-1 md:row-start-1 lg:col-auto lg:row-auto">
        <InstrumentMarketStatus
          instrument={instrument}
          marketDataMode={marketDataMode}
          wsStatus={wsStatus}
          clock={clock || "--:--:--"}
          onOpenInstrumentSwitcher={onOpenInstrumentSwitcher}
        />
      </div>

      <div className="col-span-3 row-start-3 grid w-full min-w-0 grid-cols-[repeat(3,minmax(0,1fr))_auto] items-center gap-1.5 border-t border-border-soft bg-panel px-2 py-1.5 md:row-start-2 lg:col-auto lg:row-auto lg:w-auto lg:flex-none lg:gap-1.5 lg:border-0 lg:bg-transparent lg:p-0">
        <Metric label="BALANCE" value={fmtUsd(account?.balance)} className={metricCardClass} />
        <Metric label="EQUITY" value={fmtUsd(account?.equity)} className={metricCardClass} />
        <Metric
          label="P/L"
          value={`${floating >= 0 ? "+" : ""}${fmtNum(floating, 2)}`}
          valueClass={floatingUp ? "text-up" : "text-down"}
          className={metricCardClass}
        />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              aria-label="Show more account metrics"
              title="More account metrics"
              className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-canvas text-text-muted transition-colors hover:bg-panel-2 hover:text-text focus-visible:outline-2 focus-visible:outline-brand lg:bg-panel"
            >
              <Ellipsis size={18} strokeWidth={2} aria-hidden />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-72 p-3 text-xs">
            <div className="flex items-start justify-between gap-3">
              <div>
                <DropdownMenuLabel className="px-0 py-0 text-(length:--term-text-2xs) uppercase tracking-wide text-text-faint">
                  Account details
                </DropdownMenuLabel>
                <p className="mt-1 text-sm font-semibold text-text">Additional metrics</p>
              </div>
              <span className="rounded-md bg-panel px-2 py-1 text-(length:--term-text-2xs) font-semibold tabular-nums text-text-muted">
                #{account?.accountNo ?? "—"}
              </span>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <Metric label="FREE" value={fmtUsd(account?.free)} className="rounded-lg bg-panel px-2.5 py-2" />
              <Metric
                label="MARGIN"
                value={fmtUsd(account?.margin)}
                valueClass={marginTight ? "text-down" : ""}
                className="rounded-lg bg-panel px-2.5 py-2"
              />
              <Metric
                label="MARGIN LEVEL"
                value={account?.marginLevel != null ? `${fmtNum(account.marginLevel, 2)}%` : "—"}
                valueClass={account?.marginLevel == null ? "text-text-faint" : marginTight ? "text-down" : ""}
                className="rounded-lg bg-panel px-2.5 py-2"
              />
              <Metric
                label="CREDIT"
                value={fmtUsd(account?.credit)}
                title="Outstanding repayable advance, already included in balance."
                className="rounded-lg bg-panel px-2.5 py-2"
              />
            </div>
            <p className="mt-3 text-(length:--term-text-2xs) leading-relaxed text-text-muted">
              Balance, equity and P/L remain visible for quick decisions.
            </p>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="col-start-3 row-start-1 ml-auto flex shrink-0 items-center gap-1 sm:gap-1.5 lg:col-auto lg:row-auto lg:ml-auto">
        <TradeSearchButton className="bg-panel" />
        <TerminalNotifications />
        <span className="hidden sm:block">
          <ThemeToggle className="bg-panel" />
        </span>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              aria-label="Open account menu"
              className="flex h-9 items-center gap-2 rounded-lg bg-panel-2 px-1.5 transition-colors duration-150 hover:bg-panel focus-visible:outline-2 focus-visible:outline-brand sm:h-10 sm:px-2"
            >
              <UserAvatar
                identity={userIdentity}
                name={userName}
                size="md"
                className="transition-transform duration-150 in-data-[state=open]:scale-105"
              />
              <span className="hidden min-w-0 text-left xl:block">
                <span className="block max-w-28 truncate text-xs font-semibold leading-tight">{userName}</span>
                <span className="block text-(length:--term-text-2xs) tnum leading-tight text-text-faint">{account?.accountNo ?? "—"}</span>
              </span>
              <span className="hidden sm:block"><ChevronMenuIcon /></span>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-64 rounded-xl p-0 text-xs shadow-xl sm:w-72">
            <div className="bg-panel-2/50 px-3 py-2.5 sm:px-4 sm:py-3.5">
              <div className="flex items-center gap-2.5 sm:gap-3">
                <UserAvatar identity={userIdentity} name={userName} size="lg" />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold">{userName}</div>
                  <div className="truncate text-(length:--term-text-2xs) text-text-faint">{session?.user?.email}</div>
                </div>
                {showAdmin && (
                  <span className="shrink-0 rounded bg-brand-soft px-1.5 py-0.5 text-(length:--term-text-2xs) font-semibold uppercase text-brand">Admin</span>
                )}
              </div>
              <div className="mt-2 flex items-center gap-2 border-t border-border-soft pt-1.5 sm:mt-2.5 sm:pt-2">
                <span className="text-(length:--term-text-2xs) uppercase tracking-wide text-text-faint">Account</span>
                <span className="text-(length:--term-text-2xs) tnum font-medium">{account?.accountNo ?? "—"}</span>
              </div>
            </div>

            <div className="p-1 sm:p-1.5">
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
              {showAdmin && (
                <>
                  <MenuGroupLabel>Operations</MenuGroupLabel>
                  <MenuLink href="/admin" icon={<AdminIcon />} label="Admin Console" />
                </>
              )}
            </div>

            <div className="flex items-center gap-2 bg-panel-2/40 px-3 py-1.5 text-xs text-text sm:hidden sm:gap-3 sm:px-4 sm:py-2">
              <span className="text-text-muted"><ThemeIcon /></span>
              <span className="flex-1 font-medium">Dim mode</span>
              <ThemeToggle className="bg-canvas" />
            </div>

            <div className="p-1 sm:p-1.5">
              {session?.user ? (
                <DropdownMenuItem
                  variant="destructive"
                  className="gap-2.5 rounded-md px-2.5 py-1.5 text-xs text-down transition-colors duration-150 hover:bg-down/10 focus:bg-down/10 focus:text-down sm:gap-3 sm:px-3 sm:py-2"
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
      </div>

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
  title,
  valueClass = "",
  className = "",
}: {
  label: string;
  value: string;
  title?: string;
  valueClass?: string;
  className?: string;
}) {
  return (
    <div title={title} className={`flex flex-col justify-center gap-0 shrink-0 leading-tight ${className}`}>
      <span className="mb-0.5 text-[9px] font-medium uppercase leading-none tracking-wide text-text-faint">{label}</span>
      <span className={`truncate text-[11px] font-semibold leading-none tnum sm:text-xs ${valueClass}`}>{value}</span>
    </div>
  );
}

function WorkspaceMenu({ symbol, showAdmin }: { symbol: string; showAdmin: boolean }) {
  return (
    <div className="hidden md:block xl:hidden">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-label="Open workspace navigation"
            className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-panel text-text-muted transition-colors hover:bg-panel-2 hover:text-text focus-visible:outline-2 focus-visible:outline-brand"
          >
            <Menu size={16} strokeWidth={2} aria-hidden />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-56">
          <DropdownMenuLabel>Workspace</DropdownMenuLabel>
          <MenuLink href="/markets" icon={<ChartNoAxesCombined size={14} strokeWidth={2} aria-hidden />} label="Markets" />
          <MenuLink href={`/trade/${encodeURIComponent(symbol)}`} icon={<CandlestickChart size={14} strokeWidth={2} aria-hidden />} label="Trade terminal" />
          <MenuLink href="/account" icon={<AccountIcon />} label="Account" />
          {showAdmin && <MenuLink href="/admin" icon={<AdminIcon />} label="Admin console" />}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

function fmtUsd(v: number | null | undefined): string {
  if (v == null || !isFinite(v)) return "—";
  return v.toLocaleString(getFormatLocale(), { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const metricCardClass = "h-10 min-w-0 shrink-0 rounded-lg bg-canvas px-2 py-1 lg:bg-panel-2";

// ── Dropdown menu helpers (Radix items with the terminal look) ───────────────

function MenuGroupLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-2.5 pb-0.5 pt-1.5 text-(length:--term-text-2xs) font-semibold uppercase tracking-wider text-text-faint first:pt-1 sm:px-3 sm:pb-1 sm:pt-2.5 first:sm:pt-1.5">
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
      className="group gap-2.5 rounded-md px-2.5 py-1.5 text-xs text-text transition-colors duration-150 hover:bg-panel-2 focus:bg-panel-2 focus:text-text sm:gap-3 sm:px-3 sm:py-2"
      onSelect={onSelect}
    >
      <span className="text-text-muted transition-colors duration-150 group-hover:text-text">{icon}</span>
      <span className="flex-1">
        <span className="font-medium block">{label}</span>
        {hint && <span className="text-(length:--term-text-2xs) text-text-faint max-sm:hidden">{hint}</span>}
      </span>
    </DropdownMenuItem>
  );
}

function MenuLink({ href, icon, label }: { href: string; icon: React.ReactNode; label: string }) {
  return (
    <DropdownMenuItem asChild className="group gap-2.5 rounded-md px-2.5 py-1.5 text-xs text-text transition-colors duration-150 hover:bg-panel-2 focus:bg-panel-2 focus:text-text sm:gap-3 sm:px-3 sm:py-2">
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
function ChevronMenuIcon() {
  return <ChevronDown size={12} strokeWidth={2.5} aria-hidden className="shrink-0 text-text-muted" />;
}
function SignOutIcon() {
  return <LogOut size={14} strokeWidth={2} aria-hidden className={ic} />;
}
