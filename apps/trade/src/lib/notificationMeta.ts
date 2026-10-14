import {
  ArrowDownToLine,
  ArrowUpFromLine,
  Bell,
  CandlestickChart,
  CircleAlert,
  MessageCircle,
  ShieldAlert,
  Undo2,
  type LucideIcon,
} from "lucide-react";

/** Shared notification taxonomy — one map drives the toast bridge, the
 *  notifications feed badges and the detail dialog, so every surface shows
 *  the same icon + tone per type (transactions-page style identity tiles). */
export interface NotificationMeta {
  icon: LucideIcon;
  tone: "up" | "down" | "warn" | "brand" | "muted";
  /** Feed heading for the type (short). */
  label: string;
}

const MAP: Record<string, NotificationMeta> = {
  TRADE_OPENED: { icon: CandlestickChart, tone: "warn", label: "Trade" },
  TRADE_CLOSED: { icon: CandlestickChart, tone: "up", label: "Trade" },
  PAYMENT_APPROVED: { icon: ArrowDownToLine, tone: "up", label: "Deposit" },
  PAYMENT_REJECTED: { icon: CircleAlert, tone: "down", label: "Payment" },
  PAYMENT_PREPARED: { icon: ArrowUpFromLine, tone: "brand", label: "Withdrawal" },
  PAYMENT_CANCELLED: { icon: Undo2, tone: "muted", label: "Payment" },
  PAYMENT_REVERSED: { icon: Undo2, tone: "muted", label: "Payment" },
  ADMIN_MESSAGE: { icon: MessageCircle, tone: "warn", label: "Message" },
  ADMIN_BROADCAST: { icon: MessageCircle, tone: "brand", label: "Announcement" },
  ADMIN_CHAT: { icon: MessageCircle, tone: "warn", label: "Message" },
  CUSTOMER_MESSAGE: { icon: MessageCircle, tone: "warn", label: "Message" },
  ACCOUNT_STATUS: { icon: ShieldAlert, tone: "down", label: "Account" },
};

const FALLBACK: NotificationMeta = { icon: Bell, tone: "muted", label: "Notification" };

export function notificationMeta(type: string): NotificationMeta {
  return MAP[type] ?? FALLBACK;
}

export const NOTIFICATION_TONE_CLASSES: Record<NotificationMeta["tone"], string> = {
  up: "bg-up/10 text-up",
  down: "bg-down/10 text-down",
  warn: "bg-(--term-warning-bg) text-(--term-warning-fg)",
  brand: "bg-primary/10 text-primary",
  muted: "bg-muted text-muted-foreground",
};

/** Icon-initial tile: colored circle + icon (or initials fallback). */
export function notificationTileClass(type: string): string {
  return NOTIFICATION_TONE_CLASSES[notificationMeta(type).tone];
}
