"use client";

/**
 * Central icon registry for tab strips and action menus — Lucide icons,
 * tree-shaken per import and rendered as inline SVG (CSP-safe: no external
 * files, no CDN; matches the repo's established inline-icon convention).
 *
 * Sizing/stroke is normalized here so every surface (admin sidebar, account
 * tabs, kebab menus) stays visually consistent, and icons inherit
 * `currentColor` — brand theming (Agile green / Black Forest orange) and
 * tone classes (destructive red, muted) apply automatically.
 */

import {
  ArrowDownToLine,
  ArrowLeftRight,
  ArrowUpFromLine,
  BadgeCheck,
  Ban,
  Bell,
  BookOpenText,
  CandlestickChart,
  CircleCheck,
  ClipboardCheck,
  CreditCard,
  FileBarChart,
  Flame,
  HeartPulse,
  IdCard,
  KeyRound,
  LayoutDashboard,
  LifeBuoy,
  ListTree,
  LogOut,
  MessageSquare,
  Pause,
  Play,
  RotateCcw,
  Scale,
  ScrollText,
  Settings,
  ShieldAlert,
  ShieldOff,
  ShieldPlus,
  Trash2,
  TrendingUp,
  UserPlus,
  Users,
  UsersRound,
  Wallet,
  type LucideIcon,
} from "lucide-react";

export type { LucideIcon };

/** The shared visual treatment for every tab/menu icon. */
export function TabIcon({ icon: Icon, size = 14 }: { icon: LucideIcon; size?: number }) {
  return <Icon aria-hidden size={size} strokeWidth={1.75} className="shrink-0" />;
}

/** Admin console module tabs (TAB_DEFINITIONS keys in AdminWorkspace). */
export const ADMIN_TAB_ICONS: Record<string, LucideIcon> = {
  overview: LayoutDashboard,
  users: Users,
  groups: UsersRound,
  kyc: IdCard,
  payments: CreditCard,
  ledger: BookOpenText,
  executions: CandlestickChart,
  reconciliation: Scale,
  support: LifeBuoy,
  messages: MessageSquare,
  instruments: ListTree,
  risk: ShieldAlert,
  audit: ScrollText,
  health: HeartPulse,
  changes: ClipboardCheck,
};

/** Account portal tabs (TABS keys in AccountShell). */
export const ACCOUNT_TAB_ICONS: Record<string, LucideIcon> = {
  overview: LayoutDashboard,
  positions: TrendingUp,
  transactions: ArrowLeftRight,
  payments: CreditCard,
  reports: FileBarChart,
  verification: BadgeCheck,
  notifications: Bell,
  messages: MessageSquare,
  support: LifeBuoy,
  referrals: UserPlus,
  settings: Settings,
};

/** Admin user kebab-menu actions (AdminUserActions). */
export const ADMIN_ACTION_ICONS = {
  notify: Bell,
  chat: MessageSquare,
  manageBalance: Wallet,
  settings: Settings,
  grantRole: ShieldPlus,
  revokeRole: ShieldOff,
  resetPassword: KeyRound,
  forceSignOut: LogOut,
  suspend: Pause,
  unsuspend: Play,
  block: Ban,
  unblock: CircleCheck,
  softDelete: Trash2,
  restore: RotateCcw,
  hardDelete: Flame,
} as const;

/** Wallet modal operation toggles. */
export const WALLET_ICONS = {
  deposit: ArrowDownToLine,
  withdraw: ArrowUpFromLine,
} as const;
