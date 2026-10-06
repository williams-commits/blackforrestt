import type { CandleInterval } from "../engine/types";

export const VALID_INTERVALS = new Set<CandleInterval>(["1m", "5m", "15m", "1h", "4h", "1d"]);
export const MAX_SUBSCRIPTIONS = 10;
export const MAX_MESSAGES_PER_MINUTE = 120;
export const MESSAGE_WINDOW_MS = 60_000;
export const MAX_PAYLOAD_BYTES = 16 * 1024;

export type ClientMessage =
  | { type: "ping" }
  | { type: "account_subscribe" }
  | { type: "account_unsubscribe" }
  | { type: "subscribe"; symbol: string; interval: CandleInterval }
  | { type: "unsubscribe"; symbol: string };

export interface MessageBudgetState {
  windowStartedAt: number;
  messagesInWindow: number;
}

export type RawClientPayload = string | Buffer | ArrayBuffer | readonly Buffer[];

function payloadText(raw: RawClientPayload): string {
  if (typeof raw === "string") return raw;
  if (Buffer.isBuffer(raw)) return raw.toString("utf8");
  if (raw instanceof ArrayBuffer) return Buffer.from(raw).toString("utf8");
  return Buffer.concat(raw).toString("utf8");
}

/**
 * Consume one message from a fixed one-minute client budget.
 * Returns true only after the configured allowance has been exceeded.
 */
export function consumeMessageBudget(
  state: MessageBudgetState,
  now = Date.now(),
): boolean {
  if (now - state.windowStartedAt >= MESSAGE_WINDOW_MS) {
    state.windowStartedAt = now;
    state.messagesInWindow = 0;
  }
  state.messagesInWindow += 1;
  return state.messagesInWindow > MAX_MESSAGES_PER_MINUTE;
}

/** Parse and normalize one bounded WebSocket client command. */
export function parseClientMessage(raw: RawClientPayload): ClientMessage | null {
  let value: unknown;
  try {
    value = JSON.parse(payloadText(raw));
  } catch {
    return null;
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  if (record.type === "ping") return { type: "ping" };
  if (record.type === "account_subscribe") return { type: "account_subscribe" };
  if (record.type === "account_unsubscribe") return { type: "account_unsubscribe" };

  if (record.type === "subscribe") {
    if (typeof record.symbol !== "string" || typeof record.interval !== "string") return null;
    const symbol = record.symbol.trim().toUpperCase();
    if (!/^[A-Z0-9/_-]{2,30}$/.test(symbol)) return null;
    if (!VALID_INTERVALS.has(record.interval as CandleInterval)) return null;
    return { type: "subscribe", symbol, interval: record.interval as CandleInterval };
  }

  if (record.type === "unsubscribe") {
    if (typeof record.symbol !== "string") return null;
    const symbol = record.symbol.trim().toUpperCase();
    if (!/^[A-Z0-9/_-]{2,30}$/.test(symbol)) return null;
    return { type: "unsubscribe", symbol };
  }
  return null;
}
