"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { useForexStore } from "@/lib/store";
import { fmtNum, getFormatLocale } from "@/lib/format";
import { ConnectionDot } from "./ConnectionDot";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
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
}

/**
 * AccountBar — the top metrics strip: account number, then Balance / Credit /
 * Margin / Equity / Margin Level / Free / P/L across the bar.
 *
 * The right side is a single user avatar/name trigger that opens a dropdown
 * panel containing quick actions (Deposit, Account, Reports, Admin) and sign
 * out — instead of cluttering the header with inline links.
 */
export function AccountBar({ wsStatus, onOpenAssets, depositUiEnabled = true, disabledPaymentMethods = [], walletAddresses = [] }: Props) {
  const account = useForexStore((s) => s.account);
  const { data: session } = useSession();
  const router = useRouter();
  const [clock, setClock] = useState("");
  const [walletOpen, setWalletOpen] = useState(false);
  const [walletMode, setWalletMode] = useState<"deposit" | "withdraw">("deposit");
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuPos, setMenuPos] = useState({ top: 0, right: 10 });
  const menuRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const tick = () => {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone.split("/").pop()?.replace(/_/g, " ") ?? "";
      setClock(`${new Date().toLocaleTimeString(getFormatLocale(), { hour12: false })} ${tz}`);
    };
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, []);

  // Position the dropdown relative to the trigger button (for portal).
  function openMenu() {
    if (triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      setMenuPos({ top: rect.bottom, right: window.innerWidth - rect.right });
    }
    setMenuOpen(true);
  }

  // Close dropdown on outside click.
  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      // Check both the trigger area and the portal'd dropdown.
      if (
        menuRef.current && !menuRef.current.contains(target) &&
        triggerRef.current && !triggerRef.current.contains(target)
      ) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [menuOpen]);

  // Close on scroll/resize (position would be stale).
  useEffect(() => {
    if (!menuOpen) return;
    const close = () => setMenuOpen(false);
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => {
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, [menuOpen]);

  const floating = account?.floatingPl ?? 0;
  const floatingUp = floating >= 0;
  const userName = session?.user?.name ?? session?.user?.email ?? "dev trader";
  const initial = userName[0]?.toUpperCase() ?? "U";

  return (
    <header className="relative z-40 flex min-h-11 shrink-0 flex-wrap items-center bg-canvas border-b border-border sm:flex-nowrap">
      {/* Logo + TRADE label */}
      <div className="flex items-center gap-2.5 px-3 shrink-0 border-r border-border h-full">
        <Logo />
        <span className="text-[10px] font-semibold text-brand bg-brand-soft px-1.5 py-0.5 rounded">TRADE</span>
      </div>

      {/* Assets button — opens the instrument picker modal */}
      {onOpenAssets && (
        <button
          type="button"
          onClick={onOpenAssets}
          className="flex items-center gap-1.5 px-3 h-full text-[11px] font-medium text-text-muted hover:text-text hover:bg-panel-2 border-r border-border transition-colors shrink-0"
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

      {/* Metrics strip — mobile shows priority metrics + horizontal scroll for the rest */}
      <div className="order-3 flex w-full items-center gap-3 overflow-x-auto border-t border-border px-3 py-1.5 sm:order-0 sm:w-auto sm:gap-4 sm:border-t-0 sm:py-0 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
        <Metric label="ACCOUNT" value={account?.accountNo ?? "—"} className="hidden lg:flex" />
        <Metric label="BALANCE" value={fmtUsd(account?.balance)} />
        <Metric label="EQUITY" value={fmtUsd(account?.equity)} />
        <Metric label="FREE" value={fmtUsd(account?.free)} />
        <Metric
          label="P/L"
          value={`${floating >= 0 ? "+" : ""}${fmtNum(floating, 2)}`}
          valueClass={floatingUp ? "text-up" : "text-down"}
        />
        <Metric label="CREDIT" value={fmtUsd(account?.credit)} className="hidden md:flex" />
        <Metric label="MARGIN" value={fmtUsd(account?.margin)} className="hidden md:flex" />
        <Metric
          label="MARGIN LEVEL"
          value={account?.marginLevel != null ? `${fmtNum(account.marginLevel, 2)}%` : "—"}
          className="hidden md:flex"
        />
      </div>

      {/* Connection + clock + theme toggle (kept inline, compact) */}
      <div className="ml-auto flex shrink-0 items-center gap-2 px-2 sm:px-3">
        <ConnectionDot status={wsStatus} />
        <span className="text-[11px] text-text-muted tnum hidden lg:inline">{clock}</span>
        <ThemeToggle className="h-8 w-8" />
      </div>

      {/* User dropdown trigger */}
      <div className="relative shrink-0 border-l border-border">
        <button
          type="button"
          ref={triggerRef}
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          aria-label="Open account menu"
          onClick={() => (menuOpen ? setMenuOpen(false) : openMenu())}
          className="flex items-center gap-2 h-11 px-3 hover:bg-panel-2 transition-colors"
        >
          <span className="w-7 h-7 rounded-full bg-brand-soft flex items-center justify-center text-brand font-semibold text-xs">
            {initial}
          </span>
          <span className="text-xs font-medium hidden sm:inline max-w-[120px] truncate">{userName}</span>
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            className={`text-text-muted transition-transform ${menuOpen ? "rotate-180" : ""}`}
          >
            <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>

      {/* Dropdown panel — rendered via portal to escape header's overflow clipping */}
      {menuOpen && typeof document !== "undefined" && createPortal(
        <div
          ref={menuRef}
          className="fixed w-64 bg-canvas border border-border rounded-b-lg shadow-xl z-9999 overflow-hidden animate-[fadeIn_0.12s_ease-out]"
          style={{ top: menuPos.top, right: menuPos.right }}
        >
          {/* User header */}
          <div className="px-4 py-3 border-b border-border bg-panel-2/50">
            <div className="flex items-center gap-2.5">
              <span className="w-9 h-9 rounded-full bg-brand-soft flex items-center justify-center text-brand font-semibold">
                {initial}
              </span>
              <div className="min-w-0">
                <div className="text-xs font-semibold truncate">{userName}</div>
                <div className="text-[10px] text-text-faint truncate">{session?.user?.email}</div>
              </div>
            </div>
            <div className="flex items-center gap-2 mt-2">
              <span className="text-[9px] text-text-faint uppercase">Account</span>
              <span className="text-[10px] tnum font-medium">{account?.accountNo ?? "—"}</span>
              {session?.user?.role === "admin" && (
                <span className="ml-auto text-[8px] px-1.5 py-0.5 rounded bg-brand-soft text-brand font-semibold uppercase">Admin</span>
              )}
            </div>
          </div>

          {/* Quick actions */}
          <div className="py-1">
            {depositUiEnabled && (
              <MenuItem
                onClick={() => { setMenuOpen(false); setWalletMode("deposit"); setWalletOpen(true); }}
                icon={<DepositIcon />}
                label="Deposit"
                hint="Fund your account"
              />
            )}
            <MenuItem
              onClick={() => { setMenuOpen(false); setWalletMode("withdraw"); setWalletOpen(true); }}
              icon={<WithdrawIcon />}
              label="Withdraw"
              hint="Request a payout"
            />
            <MenuLink href="/account" onClick={() => setMenuOpen(false)} icon={<AccountIcon />} label="My Account" />
            <MenuLink href="/reports" onClick={() => setMenuOpen(false)} icon={<ReportsIcon />} label="Trade Reports" />
            <MenuLink href="/account?tab=settings" onClick={() => setMenuOpen(false)} icon={<SettingsIcon />} label="Settings" />
            {session?.user?.role === "admin" && (
              <MenuLink href="/admin" onClick={() => setMenuOpen(false)} icon={<AdminIcon />} label="Admin Console" />
            )}
          </div>

          {/* Sign out */}
          <div className="border-t border-border py-1">
            {session?.user ? (
              <MenuItem
                onClick={() => { setMenuOpen(false); signOut({ callbackUrl: "/login" }); }}
                icon={<SignOutIcon />}
                label="Sign out"
                danger
              />
            ) : (
              <MenuLink href="/login" onClick={() => setMenuOpen(false)} icon={<SignOutIcon />} label="Sign in" />
            )}
          </div>
        </div>,
        document.body,
      )}

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
      <span className="text-[10px] text-text-faint leading-none mb-0.5">{label}</span>
      <span className={`text-[12px] tnum leading-none font-medium ${valueClass}`}>{value}</span>
    </div>
  );
}

function fmtUsd(v: number | null | undefined): string {
  if (v == null || !isFinite(v)) return "—";
  return v.toLocaleString(getFormatLocale(), { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// ── Dropdown menu primitives ─────────────────────────────────────────────────

function MenuItem({
  onClick,
  icon,
  label,
  hint,
  danger,
}: {
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  hint?: string;
  danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-4 py-2 text-left text-xs transition-colors cursor-pointer ${
        danger ? "text-down hover:bg-down/10" : "text-text hover:bg-panel-2"
      }`}
    >
      <span className={danger ? "text-down" : "text-text-muted"}>{icon}</span>
      <span className="flex-1">
        <span className="font-medium block">{label}</span>
        {hint && <span className="text-[9px] text-text-faint">{hint}</span>}
      </span>
    </button>
  );
}

function MenuLink({
  href,
  onClick,
  icon,
  label,
}: {
  href: string;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className="w-full flex items-center gap-3 px-4 py-2 text-xs text-text hover:bg-panel-2 transition-colors"
    >
      <span className="text-text-muted">{icon}</span>
      <span className="font-medium">{label}</span>
    </Link>
  );
}

// ── Icons ────────────────────────────────────────────────────────────────────

const ic = "w-3.5 h-3.5";

function DepositIcon() {
  return (
    <svg className={ic} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 5v14M5 12h14" strokeLinecap="round" />
    </svg>
  );
}
function WithdrawIcon() {
  return (
    <svg className={ic} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M5 12h14" strokeLinecap="round" />
    </svg>
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
function AdminIcon() {
  return (
    <svg className={ic} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 2l9 4v6c0 5-3.8 9.3-9 10-5.2-.7-9-5-9-10V6l9-4z" strokeLinejoin="round" />
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
