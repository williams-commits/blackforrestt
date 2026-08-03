/** Client-side shared types for the forex broker UI. */

export type PositionType = "CFD" | "STRIKE";
export type PositionSide = "BUY" | "SELL";
export type PositionStatus = "OPEN" | "CLOSED";
export type CandleInterval = "1m" | "5m" | "15m" | "1h" | "4h" | "1d";

export interface Candle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface Quote {
  symbol: string;
  bid: number;
  ask: number;
  mid: number;
  time: number;
  open24h: number;
  high24h: number;
  low24h: number;
  changePct: number;
}

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
  openedAt: number;
  openedTill: number | null;
  closedAt?: number | null;
  closeReason?: string | null;
}

export const TIMEFRAMES: CandleInterval[] = ["1m", "5m", "15m", "1h", "4h", "1d"];
