/**
 * PositionEngine — forex position math: pip/PnL computation, stop-loss /
 * take-profit triggering, STRIKE settlement at expiry, and account-metric
 * derivation.
 *
 * Prices remain quote numbers, but every quantity that represents account
 * money is calculated and retained as Prisma.Decimal.
 */
import { Prisma } from "@prisma/client";
import type { PositionSide, PositionType } from "./types";

const { Decimal } = Prisma;

export interface InstrumentCfg {
  symbol: string;
  digits: number;
  pipSize: Prisma.Decimal;
  pipValue: Prisma.Decimal; // value of 1 pip per 1.0 lot, in account currency
  marginPerLot: Prisma.Decimal; // margin per 1.0 lot, in account currency
  commissionPerLot: Prisma.Decimal; // commission per lot round-turn
  // Overnight swap (financing) rate in pips per lot per day, by side.
  swapLongPipsPerDay: Prisma.Decimal;
  swapShortPipsPerDay: Prisma.Decimal;
}

export interface Position {
  id: string;
  symbol: string;
  type: PositionType;
  side: PositionSide;
  volume: number; // lots
  openRate: number;
  strikeRate: number | null;
  currentRate: number;
  stopLoss: number | null;
  takeProfit: number | null;
  swap: Prisma.Decimal;
  commission: Prisma.Decimal;
  tradingCommission: Prisma.Decimal;
  profit: Prisma.Decimal;
  adminPnlAdjustment: Prisma.Decimal;
  netProfit: Prisma.Decimal;
  openedAtMs: number;
  openedTillMs: number | null;
  // Timestamp swap was last accrued up to (ms). Used to prorate the daily swap.
  lastSwapMs?: number;
}

export interface OpenInput {
  userId: string;
  instrument: InstrumentCfg;
  side: PositionSide;
  volume: number;
  type: PositionType;
  // STRIKE: the strike rate. If null, defaults to current market.
  strikeRate: number | null;
  // STRIKE: expiry in minutes from now. Null for CFD.
  expiryMinutes: number | null;
  stopLoss: number | null;
  takeProfit: number | null;
  marketRate: number;
}

export interface OpenResult {
  position: Position;
  // Margin to lock (account currency).
  margin: Prisma.Decimal;
  // Commission + trading commission charged at open (account currency).
  commissionTotal: Prisma.Decimal;
}

/**
 * Number of pips between entry and current rate, signed by direction.
 * Positive = in profit for the given side.
 */
export function pipsBetween(
  side: PositionSide,
  openRate: number,
  currentRate: number,
  pipSize: Prisma.Decimal,
): Prisma.Decimal {
  const open = priceDecimal(openRate);
  const current = priceDecimal(currentRate);
  const diff = side === "BUY" ? current.sub(open) : open.sub(current);
  return diff.div(pipSize);
}

/** Gross profit (account currency) = pips × pipValue × volume(lots). */
export function grossProfit(
  pips: Prisma.Decimal,
  pipValue: Prisma.Decimal,
  volume: number,
): Prisma.Decimal {
  return monetary(pips.mul(pipValue).mul(quantityDecimal(volume)));
}

/** Margin required for a position. */
export function marginFor(
  volume: number,
  marginPerLot: Prisma.Decimal,
): Prisma.Decimal {
  return monetary(quantityDecimal(volume).mul(marginPerLot));
}

/** Commission charged (commission per lot × volume), split into two line items. */
export function commissionFor(
  volume: number,
  commissionPerLot: Prisma.Decimal,
): { commission: Prisma.Decimal; trading: Prisma.Decimal } {
  const total = monetary(quantityDecimal(volume).mul(commissionPerLot));
  // Show as two halves to match the reference table's two commission columns.
  const commission = monetary(total.div(2));
  return { commission, trading: monetary(total.sub(commission)) };
}

/** Create a new Position from an OpenInput (does NOT persist). */
export function openPosition(input: OpenInput): OpenResult {
  const { instrument, side, volume, type, marketRate } = input;
  const openRate = type === "STRIKE" && input.strikeRate != null ? input.strikeRate : marketRate;
  const now = Date.now();
  const openedTillMs = type === "STRIKE" && input.expiryMinutes != null ? now + input.expiryMinutes * 60_000 : null;
  const { commission, trading } = commissionFor(volume, instrument.commissionPerLot);
  const margin = marginFor(volume, instrument.marginPerLot);

  const position: Position = {
    id: "", // assigned by caller (DB id)
    symbol: instrument.symbol,
    type,
    side,
    volume,
    openRate: round(openRate, instrument),
    strikeRate: input.strikeRate != null ? round(input.strikeRate, instrument) : null,
    currentRate: round(openRate, instrument),
    stopLoss: input.stopLoss,
    takeProfit: input.takeProfit,
    swap: monetary(0),
    commission,
    tradingCommission: trading,
    // PnL starts at the spread cost (open rate vs market), recomputed each tick.
    profit: monetary(0),
    adminPnlAdjustment: monetary(0),
    netProfit: monetary(commission.add(trading).neg()),
    openedAtMs: now,
    openedTillMs,
    lastSwapMs: now,
  };
  return { position, margin, commissionTotal: monetary(commission.add(trading)) };
}

/**
 * Recompute a position's floating PnL at a new mark rate.
 * Returns the updated position and whether it should close (SL/TP/STRIKE expiry).
 */
export interface MarkResult {
  position: Position;
  shouldClose: boolean;
  closeReason?: "STOP_LOSS" | "TAKE_PROFIT" | "EXPIRY";
  realized: Prisma.Decimal; // realized net PnL if closed
}

export function markPosition(pos: Position, markRate: number, instrument: InstrumentCfg, now = Date.now()): MarkResult {
  const updated: Position = { ...pos, currentRate: round(markRate, instrument) };
  const entry = pos.type === "STRIKE" && pos.strikeRate != null ? pos.strikeRate : pos.openRate;
  const pips = pipsBetween(pos.side, entry, markRate, instrument.pipSize);
  const profit = monetary(grossProfit(pips, instrument.pipValue, pos.volume).add(pos.adminPnlAdjustment));
  updated.profit = profit;
  updated.netProfit = monetary(
    profit.add(pos.swap).sub(pos.commission).sub(pos.tradingCommission),
  );

  let shouldClose = false;
  let closeReason: MarkResult["closeReason"];

  // Stop loss / take profit (only for CFD; STRIKE settles at expiry).
  if (pos.type === "CFD") {
    if (pos.stopLoss != null) {
      const hit = pos.side === "BUY" ? markRate <= pos.stopLoss : markRate >= pos.stopLoss;
      if (hit) {
        shouldClose = true;
        closeReason = "STOP_LOSS";
      }
    }
    if (!shouldClose && pos.takeProfit != null) {
      const hit = pos.side === "BUY" ? markRate >= pos.takeProfit : markRate <= pos.takeProfit;
      if (hit) {
        shouldClose = true;
        closeReason = "TAKE_PROFIT";
      }
    }
  }

  // STRIKE expiry settlement.
  if (pos.type === "STRIKE" && pos.openedTillMs != null && now >= pos.openedTillMs) {
    shouldClose = true;
    closeReason = "EXPIRY";
  }

  const realized = shouldClose ? updated.netProfit : monetary(0);
  return { position: updated, shouldClose, closeReason, realized };
}

/**
 * Recompute account metrics from balance + open positions.
 *   equity      = balance + credit + Σ unrealized profit/swap
 *   margin      = Σ margin locked by open positions
 *   marginLevel = equity / margin × 100  (null if margin == 0)
 *   free        = equity − margin
 */
export interface AccountInput {
  balance: Prisma.Decimal;
  credit: Prisma.Decimal;
  /** Ledger-derived client funds that are neither margin nor withdrawal reserved. */
  available: Prisma.Decimal;
  /**
   * Unrealized movement only. Commissions are booked into balance at order
   * open, so including netProfit here would double-charge them in equity.
   */
  positions: { profit: Prisma.Decimal; swap: Prisma.Decimal }[];
  margins: Prisma.Decimal[]; // margin per open position
}

export interface AccountOutput {
  balance: Prisma.Decimal;
  credit: Prisma.Decimal;
  equity: Prisma.Decimal;
  margin: Prisma.Decimal;
  marginLevel: Prisma.Decimal | null;
  free: Prisma.Decimal;
  floatingPl: Prisma.Decimal;
}

export function computeMetrics(input: AccountInput): AccountOutput {
  const floatingPl = monetary(
    input.positions.reduce(
      (sum, position) => sum.add(position.profit).add(position.swap),
      monetary(0),
    ),
  );
  const equity = monetary(input.balance.add(input.credit).add(floatingPl));
  const margin = monetary(
    input.margins.reduce((sum, amount) => sum.add(amount), monetary(0)),
  );
  const marginLevel = margin.greaterThan(0)
    ? equity.div(margin).mul(100).toDecimalPlaces(4, Decimal.ROUND_HALF_EVEN)
    : null;
  const free = monetary(input.available.add(input.credit).add(floatingPl));
  return { balance: input.balance, credit: input.credit, equity, margin, marginLevel, free, floatingPl };
}

/**
 * Accrue overnight swap (financing) on a position since its last accrual.
 * Swap is prorated by elapsed real time at a per-day pip rate × pip value ×
 * volume. Returns the position with updated swap + netProfit + lastSwapMs.
 * Called periodically by the hub (e.g. once per tick is fine; cost is tiny).
 */
export function accrueSwap(
  pos: Position,
  instrument: InstrumentCfg,
  now = Date.now(),
): Position {
  if (pos.type !== "CFD") return pos; // STRIKE trades don't accrue financing.
  const last = pos.lastSwapMs ?? pos.openedAtMs;
  const elapsedMilliseconds = now - last;
  if (elapsedMilliseconds <= 0) return pos;
  const elapsedDays = new Decimal(elapsedMilliseconds).div(86_400_000);
  const ratePips = pos.side === "BUY" ? instrument.swapLongPipsPerDay : instrument.swapShortPipsPerDay;
  // Swap is a cost (negative rate convention): charged to the holder. Keep
  // higher precision (4 dp) so sub-second accrual isn't rounded to zero.
  const swapDelta = monetary(
    ratePips
      .mul(instrument.pipValue)
      .mul(quantityDecimal(pos.volume))
      .mul(elapsedDays)
      .neg(),
  );
  const swap = monetary(pos.swap.add(swapDelta));
  return {
    ...pos,
    swap,
    netProfit: monetary(
      pos.profit.add(swap).sub(pos.commission).sub(pos.tradingCommission),
    ),
    lastSwapMs: now,
  };
}

function round(value: number, instrument: { digits: number }): number {
  const step = Math.pow(10, -instrument.digits);
  return Math.round(value / step) * step;
}
function priceDecimal(value: number): Prisma.Decimal {
  if (!Number.isFinite(value)) throw new Error("Price must be finite.");
  return new Decimal(value.toString());
}

function quantityDecimal(value: number): Prisma.Decimal {
  if (!Number.isFinite(value)) throw new Error("Quantity must be finite.");
  return new Decimal(value.toString());
}

function monetary(value: Prisma.Decimal.Value): Prisma.Decimal {
  return new Decimal(value).toDecimalPlaces(8, Decimal.ROUND_HALF_EVEN);
}
