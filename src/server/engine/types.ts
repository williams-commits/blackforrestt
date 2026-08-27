/**
 * Forex engine + wire types.
 *
 * Describes the in-memory representations used by the simulator/position engine
 * and the JSON payloads exchanged over the WebSocket.
 */

export type PositionType = "CFD" | "STRIKE";
export type PositionSide = "BUY" | "SELL";
export type PositionStatus = "OPEN" | "CLOSED";
export type CandleInterval = "1m" | "5m" | "15m" | "1h" | "4h" | "1d";

export interface Candle {
  time: number; // unix seconds (candle open time)
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

/** Live quote for an instrument. */
export interface Quote {
  symbol: string;
  bid: number;
  ask: number;
  // Mid = (bid + ask) / 2, the chart/mark price.
  mid: number;
  time: number; // unix ms
  // 24h rolling stats.
  open24h: number;
  high24h: number;
  low24h: number;
  changePct: number;
}

/** Instrument metadata + live quote, as seen by the client. */
export type InstrumentCategory = "FOREX" | "COMMODITY" | "INDEX" | "CRYPTO" | "STOCK";

export interface InstrumentView {
  symbol: string;
  name: string;
  category: InstrumentCategory;
  base: string;
  quote: string;
  digits: number;
  pipSize: number;
  pipValue: number;
  contractSize: number;
  marginPerLot: number;
  commissionPerLot: number;
  bid: number;
  ask: number;
  mid: number;
  changePct: number;
}

/** A position snapshot sent over the wire. */
export interface PositionView {
  id: string;
  symbol: string;
  type: PositionType;
  side: PositionSide;
  volume: number;
  openRate: number;
  strikeRate: number | null;
  currentRate: number;
  pips: number;
  stopLoss: number | null;
  takeProfit: number | null;
  swap: number;
  commission: number;
  tradingCommission: number;
  profit: number;
  adminPnlAdjustment: number;
  netProfit: number;
  status: PositionStatus;
  openedAt: number; // unix ms
  openedTill: number | null; // unix ms, null for CFD
  closedAt?: number | null; // unix ms, set when CLOSED
  closeReason?: string | null;
}

/** Account metrics sent over the wire. */
export interface AccountMetricsView {
  accountNo: string | null;
  balance: number;
  credit: number;
  equity: number;
  margin: number;
  marginLevel: number | null;
  free: number;
  floatingPl: number;
}

// ── Wire (WebSocket) protocol ────────────────────────────────────────────────

export type WsClientMessage =
  | { type: "subscribe"; symbol: string; interval: CandleInterval }
  | { type: "unsubscribe"; symbol: string }
  | { type: "account_subscribe" }
  | { type: "account_unsubscribe" }
  | { type: "ping" };

export type WsServerMessage =
  | { type: "snapshot"; snapshot: SubscribeSnapshot }
  | { type: "account_snapshot"; account: AccountMetricsView; positions: PositionView[] }
  | { type: "quote"; quote: Quote }
  | { type: "candle"; symbol: string; interval: CandleInterval; candle: Candle }
  | { type: "position"; position: PositionView }
  | { type: "account"; account: AccountMetricsView; reason?: "ledger" }
  | { type: "activity"; counts: ActivityBadgeCounts }
  | { type: "instruments"; instruments: InstrumentView[] }
  | { type: "pong" };

/** Live badge counts pushed over the WebSocket the instant activity happens
 *  (message sent, notification created) — clients apply them directly
 *  instead of waiting for the polling fallback. `messages` is the
 *  customer-view count (operator→user); `operatorMessages` is the support
 *  team inbox count (customer→operator, team-wide). */
export interface ActivityBadgeCounts {
  notifications: number;
  messages: number;
  operatorMessages: number;
  supportCases: number;
}

export interface SubscribeSnapshot {
  symbol: string;
  interval: CandleInterval;
  candles: Candle[];
  quote: Quote | null;
  instruments: InstrumentView[];
  account: AccountMetricsView | null;
  positions: PositionView[];
}

export const INTERVAL_SECONDS: Record<CandleInterval, number> = {
  "1m": 60,
  "5m": 300,
  "15m": 900,
  "1h": 3600,
  "4h": 14400,
  "1d": 86400,
};
