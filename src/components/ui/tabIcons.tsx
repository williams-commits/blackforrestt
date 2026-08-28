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
  Activity,
  ArrowDownToLine,
  ArrowLeftRight,
  ArrowRight,
  ArrowUpFromLine,
  BadgeCheck,
  Ban,
  Bell,
  BookOpenText,
  CandlestickChart,
  Check,
  CheckCheck,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  CircleCheck,
  CircleX,
  ClipboardCheck,
  Clock,
  Copy,
  CreditCard,
  Database,
  Download,
  Ellipsis,
  Eye,
  EyeOff,
  FileBarChart,
  FileDown,
  FileText,
  Filter,
  Flame,
  Globe,
  GraduationCap,
  Headphones,
  HeartPulse,
  History,
  IdCard,
  Info,
  KeyRound,
  Landmark,
  LayoutDashboard,
  LayoutGrid,
  LifeBuoy,
  ListTree,
  Lock,
  LogOut,
  LucideIcon,
  Menu,
  MessageSquare,
  Moon,
  Pause,
  Play,
  Plus,
  Receipt,
  RefreshCw,
  RotateCcw,
  Scale,
  ScrollText,
  Search,
  Send,
  Settings,
  Shield,
  ShieldAlert,
  ShieldCheck,
  ShieldOff,
  ShieldPlus,
  SlidersHorizontal,
  SquarePen,
  Sun,
  Table,
  Target,
  TrendingDown,
  Trash2,
  TrendingUp,
  TriangleAlert,
  Trophy,
  Umbrella,
  Upload,
  User,
  UserPlus,
  Users,
  UsersRound,
  Wallet,
  X,
  Zap,
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

/** Shared UI glyphs — one export per concept so surfaces stay consistent. */
export const UI_ICONS = {
  // Navigation & disclosure
  chevronDown: ChevronDown,
  chevronUp: ChevronUp,
  chevronLeft: ChevronLeft,
  chevronRight: ChevronRight,
  ellipsis: Ellipsis,
  menu: Menu,
  close: X,
  external: ArrowRight,
  // Status & feedback
  check: Check,
  checkDouble: CheckCheck,
  circleCheck: CircleCheck,
  circleX: CircleX,
  info: Info,
  warning: TriangleAlert,
  clock: Clock,
  refresh: RefreshCw,
  undo: RotateCcw,
  // Domain
  user: User,
  users: Users,
  file: FileText,
  download: Download,
  upload: Upload,
  copy: Copy,
  search: Search,
  send: Send,
  filter: Filter,
  edit: SquarePen,
  shield: Shield,
  shieldCheck: ShieldCheck,
  lock: Lock,
  landmark: Landmark,
  umbrella: Umbrella,
  globe: Globe,
  sun: Sun,
  moon: Moon,
  eye: Eye,
  eyeOff: EyeOff,
  plus: Plus,
  history: History,
  target: Target,
  trophy: Trophy,
  trendingDown: TrendingDown,
  receipt: Receipt,
  database: Database,
  zap: Zap,
  activity: Activity,
  sliders: SlidersHorizontal,
  table: Table,
  layoutGrid: LayoutGrid,
  chartLine: Activity,
  graduation: GraduationCap,
  headphones: Headphones,
  fileDown: FileDown,
} as const;
