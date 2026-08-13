/**
 * Hub — process-local market and position engine.
 *
 * The application currently runs as a single stateful process: open positions
 * are mirrored in memory while PostgreSQL remains the durable source of truth.
 * Per-user mutation locks serialize order, close, deposit/withdraw and stop-out
 * operations. Do not horizontally scale this engine until positions/order
 * execution are moved behind a distributed service or database-backed queue.
 */
import { createHash } from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma, withSerializableRetry } from "../db";
import { userMutationMutex } from "../locks";
import { isUserBlocked } from "../reconciliation";
import { loadTradingRiskPolicy } from "../riskPolicy";
import { resolveUserSettings } from "../userSettings";
import {
  appendAuditEvent,
  ensureSystemAccount,
  money,
  postLedgerTransaction,
  refreshLedgerProjections,
  reverseLedgerTransaction,
  userLedgerBalances,
} from "../ledger";
import { ForexSimulator } from "./forexSimulator";
import { getFeedClient, type FeedClient } from "./feedClient";
import { seedCandleHistory } from "./candleFetcher";
import { getAlphavantageFeed, type AlphaVantageFeed } from "./alphavantageFeed";
import { seedAlphavantageCandles } from "./alphavantageCandles";
import { getGenericFeed, type GenericFeed } from "./genericFeed";
import { getMarketDataMode } from "./marketDataMode";
import {
  computeMetrics,
  marginFor,
  markPosition,
  openPosition,
  accrueSwap,
  type InstrumentCfg,
  type Position,
} from "./positionEngine";
import type {
  AccountMetricsView,
  Candle,
  CandleInterval,
  InstrumentCategory,
  InstrumentView,
  PositionSide,
  PositionType,
  PositionView,
  Quote,
} from "./types";

const { Decimal } = Prisma;

interface InstrumentState {
  symbol: string;
  digits: number;
  pipSize: number;
  pipValue: number;
  contractSize: number;
  marginPerLot: number;
  commissionPerLot: number;
  swapLongPipsPerDay: number;
  swapShortPipsPerDay: number;
  name: string;
  category: InstrumentCategory;
  base: string;
  quote: string;
  sim: ForexSimulator;
}

const SIM_PARAMS_BY_CATEGORY: Record<InstrumentCategory, { volatility: number; reversion: number }> = {
  FOREX: { volatility: 0.08, reversion: 0.03 },
  COMMODITY: { volatility: 0.15, reversion: 0.02 },
  INDEX: { volatility: 0.18, reversion: 0.015 },
  CRYPTO: { volatility: 0.6, reversion: 0.005 },
  STOCK: { volatility: 0.22, reversion: 0.02 },
};

const DEFAULT_TICK_MS = 1_000;
const DEFAULT_PERSIST_EVERY_TICKS = 5;
const STOP_OUT_LEVEL = 50;
const MAX_STOP_OUT_CLOSES_PER_PASS = 100;
const MIN_POSITION_LOTS = 0.01;
const DEFAULT_MAX_POSITION_LOTS = 100;

export interface OpenPositionInput {
  userId: string;
  symbol: string;
  side: PositionSide;
  volume: number;
  type: PositionType;
  strikeRate: number | null;
  expiryMinutes: number | null;
  stopLoss: number | null;
  takeProfit: number | null;
  idempotencyKey: string;
}

export interface OpenPositionResult {
  position: PositionView;
  metrics: AccountMetricsView;
}

export type BroadcastFn = (message: HubEmission) => void;

export type HubEmission =
  | { kind: "quote"; quote: Quote }
  | { kind: "candle"; symbol: string; interval: CandleInterval; candle: Candle }
  | { kind: "position"; userId: string; position: PositionView }
  | { kind: "account"; userId: string; account: AccountMetricsView }
  | { kind: "instruments"; instruments: InstrumentView[] };

interface CloseRequest {
  userId: string;
  positionId: string;
  cfg: InstrumentCfg;
  reason: string;
}

class Hub {
  private instruments = new Map<string, InstrumentState>();
  private openPositions = new Map<string, Position[]>();
  private broadcast: BroadcastFn = () => undefined;
  private tickTimer: NodeJS.Timeout | null = null;
  private tickRunning = false;
  private tickCount = 0;
  private initPromise: Promise<void> | null = null;
  private feedClient: FeedClient | null = null;
  private avFeed: AlphaVantageFeed | null = null;
  private genericFeed: GenericFeed | null = null;
  private projectionRefreshes = new Map<string, Promise<AccountMetricsView>>();

  setBroadcaster(fn: BroadcastFn): void {
    this.broadcast = fn;
  }

  isReady(): boolean {
    return this.instruments.size > 0;
  }

  listInstruments(): InstrumentState[] {
    return Array.from(this.instruments.values());
  }

  getInstrument(symbol: string): InstrumentState | undefined {
    return this.instruments.get(symbol.toUpperCase());
  }

  /** List all open positions for a user (from the in-memory engine state). */
  listOpenPositions(userId: string): Position[] {
    return this.openPositions.get(userId) ?? [];
  }

  instrumentView(state: InstrumentState): InstrumentView {
    const quote = state.sim.getQuote();
    return {
      symbol: state.symbol,
      name: state.name,
      category: state.category,
      base: state.base,
      quote: state.quote,
      digits: state.digits,
      pipSize: state.pipSize,
      pipValue: state.pipValue,
      contractSize: state.contractSize,
      marginPerLot: state.marginPerLot,
      commissionPerLot: state.commissionPerLot,
      bid: quote.bid,
      ask: quote.ask,
      mid: quote.mid,
      changePct: quote.changePct,
    };
  }

  /** Idempotently load durable state and start market services. */
  async init(): Promise<void> {
    if (this.initPromise) return this.initPromise;
    this.initPromise = this.initialize();
    try {
      await this.initPromise;
    } catch (error) {
      this.initPromise = null;
      throw error;
    }
  }

  private async initialize(): Promise<void> {
    const rows = await prisma.instrument.findMany({ where: { active: true } });
    if (rows.length === 0) {
      throw new Error("No active instruments found. Run database migrations and seed data.");
    }

    this.instruments.clear();
    this.openPositions.clear();

    const symbols: string[] = [];
    for (const row of rows) {
      const params = SIM_PARAMS_BY_CATEGORY[row.category] ?? SIM_PARAMS_BY_CATEGORY.FOREX;
      const state: InstrumentState = {
        symbol: row.symbol,
        digits: row.digits,
        pipSize: Number(row.pipSize),
        pipValue: Number(row.pipValue),
        contractSize: Number(row.contractSize),
        marginPerLot: Number(row.marginPerLot),
        commissionPerLot: Number(row.commissionPerLot),
        swapLongPipsPerDay: Number(row.swapLongPips),
        swapShortPipsPerDay: Number(row.swapShortPips),
        name: row.name,
        category: row.category,
        base: row.base,
        quote: row.quote,
        sim: new ForexSimulator({
          symbol: row.symbol,
          basePrice: Number(row.basePrice),
          digits: row.digits,
          spread: 2 * Number(row.pipSize),
          volatility: params.volatility,
          reversion: params.reversion,
        }),
      };
      this.instruments.set(row.symbol, state);
      symbols.push(row.symbol);
    }

    const allOpen = await prisma.position.findMany({ where: { status: "OPEN" } });
    for (const databasePosition of allOpen) {
      if (!this.instruments.has(databasePosition.symbol)) {
        console.warn(`Ignoring open position ${databasePosition.id}: inactive/unknown symbol ${databasePosition.symbol}.`);
        continue;
      }
      const positions = this.openPositions.get(databasePosition.userId) ?? [];
      positions.push(this.toPosition(databasePosition));
      this.openPositions.set(databasePosition.userId, positions);
    }

    console.log(
      `⚙️ Hub initialized with ${this.instruments.size} instruments and ${allOpen.length} durable open positions.`,
    );

    this.startTicking();
    this.startLiveFeed(symbols);
    void this.seedHistory(symbols);
  }

  async shutdown(): Promise<void> {
    if (this.tickTimer) {
      clearInterval(this.tickTimer);
      this.tickTimer = null;
    }
    this.feedClient?.stop();
    this.feedClient = null;
    this.avFeed?.stop();
    this.avFeed = null;
    this.genericFeed?.stop();
    this.genericFeed = null;
    await this.persistOpenPositions();
  }

  private startLiveFeed(symbols: string[]): void {
    const mode = getMarketDataMode();
    const onPrice = (symbol: string, price: number) => this.setLivePrice(symbol, price);
    if (mode === "alphavantage") {
      this.avFeed = getAlphavantageFeed(onPrice);
      this.avFeed.start(symbols);
    } else if (mode === "tickerlayer" || mode === "sifting" || mode === "lse") {
      this.genericFeed = getGenericFeed(onPrice);
      this.genericFeed.start(symbols);
    } else {
      this.feedClient = getFeedClient(onPrice);
      this.feedClient.start(symbols);
    }
  }

  private async seedHistory(symbols: string[]): Promise<void> {
    const mode = getMarketDataMode();
    const onCandles = (symbol: string, interval: CandleInterval, candles: Candle[]) => {
      const state = this.instruments.get(symbol);
      if (!state) return;
      state.sim.seedCandles(interval, candles);
      const latest = candles[candles.length - 1];
      if (latest) this.broadcast({ kind: "candle", symbol, interval, candle: latest });
    };
    try {
      if (mode === "alphavantage") {
        await seedAlphavantageCandles(symbols, onCandles);
      } else {
        await seedCandleHistory(symbols, onCandles);
      }
    } catch (error) {
      console.warn("Historical candle seeding failed; simulated history remains active.", error);
    }
  }

  setLivePrice(symbol: string, price: number): void {
    this.instruments.get(symbol)?.sim.setPrice(price);
  }

  private startTicking(): void {
    if (this.tickTimer) return;
    const configured = Number(process.env.MARKET_TICK_MS ?? DEFAULT_TICK_MS);
    const intervalMs = Number.isFinite(configured) ? Math.max(250, configured) : DEFAULT_TICK_MS;
    this.tickTimer = setInterval(() => void this.tickAll(), intervalMs);
    this.tickTimer.unref?.();
  }

  /**
   * One serialized market pass. The old implementation launched async closes,
   * metric writes and persistence without awaiting them, allowing overlapping
   * ticks to double-settle positions and saturate PostgreSQL.
   */
  private async tickAll(): Promise<void> {
    if (this.tickRunning) return;
    this.tickRunning = true;
    const changedUsers = new Set<string>();
    const closeRequests: CloseRequest[] = [];

    try {
      // Advance each market once, then mark every open position once. The
      // previous nested instrument × position scan was O(I × P) per tick.
      for (const state of this.instruments.values()) this.tickMarket(state);
      await this.markOpenPositions(changedUsers, closeRequests);

      for (const request of closeRequests) {
        await userMutationMutex.runExclusive(request.userId, async () => {
          const closed = await this.closePositionInternal(
            request.userId,
            request.positionId,
            request.cfg,
            request.reason,
            false,
          );
          if (closed) changedUsers.add(request.userId);
        });
      }

      await this.stopOutPass(changedUsers);

      this.tickCount += 1;

      // Every 5 ticks (~5s), broadcast the full instrument list with live
      // prices to every connected client. This ensures the watchlist, trade
      // panel, and market-status banner stay fresh even if a per-symbol
      // subscription races during StrictMode double-invoke in development.
      if (this.tickCount % 5 === 0) {
        this.broadcast({
          kind: "instruments",
          instruments: this.listInstruments().map((state) => this.instrumentView(state)),
        });
      }

      const persistEvery = Math.max(
        1,
        Number(process.env.POSITION_PERSIST_EVERY_TICKS ?? DEFAULT_PERSIST_EVERY_TICKS) ||
          DEFAULT_PERSIST_EVERY_TICKS,
      );
      const shouldPersist = this.tickCount % persistEvery === 0;

      // Read all changed users in batches and broadcast live metrics. Durable
      // projections are checkpointed with positions instead of issuing one
      // read + one write per user every second.
      await this.recomputeAndBroadcastMetricsBatch(changedUsers, shouldPersist);

      if (shouldPersist) await this.persistOpenPositions();
    } catch (error) {
      console.error("Market tick failed:", error);
    } finally {
      this.tickRunning = false;
    }
  }

  private tickMarket(state: InstrumentState): void {
    const { updatedIntervals } = state.sim.tick();
    const quote = state.sim.getQuote();
    this.broadcast({ kind: "quote", quote });

    for (const interval of updatedIntervals) {
      const latest = state.sim.getCandles(interval, 1)[0];
      if (latest) this.broadcast({ kind: "candle", symbol: state.symbol, interval, candle: latest });
    }
  }

  /** Mark each open position exactly once per market pass: O(P), not O(I × P). */
  private async markOpenPositions(
    changedUsers: Set<string>,
    closeRequests: CloseRequest[],
  ): Promise<void> {
    for (const [userId, positions] of this.openPositions) {
      // Resolve user settings ONCE per user per tick (cached 5s inside).
      let userSpreadMarkup = 0;
      let userPnlPercent = 0;
      try {
        const userSettings = await resolveUserSettings(userId);
        userSpreadMarkup = userSettings.pnl.spreadMarkupPips;
        userPnlPercent = userSettings.pnl.pnlAdjustmentPercent;
      } catch {
        /* settings resolution failure — use base rates */
      }

      for (let index = 0; index < positions.length; index += 1) {
        const position = positions[index];
        const state = this.instruments.get(position.symbol);
        if (!state) continue;

        const cfg = this.cfg(state);
        let markRate = state.sim.rateFor(position.side === "BUY" ? "SELL" : "BUY");
        const pnlPercent = userPnlPercent;

        // Apply spread markup for this user.
        if (userSpreadMarkup > 0) {
          const pipShift = Number(cfg.pipSize) * userSpreadMarkup;
          markRate = position.side === "BUY" ? markRate - pipShift : markRate + pipShift;
        }

        const withSwap = accrueSwap(position, cfg);
        const marked = markPosition(withSwap, markRate, cfg);

        // Apply P/L percentage adjustment. The adjustment must be RECOMPUTED
        // from gross profit each tick (not accumulated) to prevent exponential
        // compounding. We derive gross from (profit - priorAdminAdjustment),
        // then set adminPnlAdjustment = gross * pct/100 and rebuild profit/net.
        if (pnlPercent !== 0) {
          const priorAdjustment = new Prisma.Decimal(position.adminPnlAdjustment);
          const grossProfit = new Prisma.Decimal(marked.position.profit).sub(priorAdjustment);
          const newAdjustment = grossProfit.mul(pnlPercent / 100);
          marked.position.adminPnlAdjustment = newAdjustment;
          marked.position.profit = grossProfit.add(newAdjustment);
          marked.position.netProfit = new Prisma.Decimal(marked.position.netProfit).sub(priorAdjustment).add(newAdjustment);
        }

        positions[index] = marked.position;
        changedUsers.add(userId);

        if (marked.shouldClose) {
          closeRequests.push({
            userId,
            positionId: marked.position.id,
            cfg,
            reason: marked.closeReason ?? "SYSTEM",
          });
        } else {
          this.broadcast({ kind: "position", userId, position: this.toView(marked.position, cfg) });
        }
      }
    }
  }

  /** Persist live marks in bounded retry-safe transactions; closed rows are never overwritten. */
  private async persistOpenPositions(): Promise<void> {
    const positions = Array.from(this.openPositions.values()).flat();
    const chunkSize = 25;

    for (let offset = 0; offset < positions.length; offset += chunkSize) {
      const chunk = positions.slice(offset, offset + chunkSize);
      try {
        await withSerializableRetry(
          async (tx) => {
            for (const position of chunk) {
              await tx.position.updateMany({
                where: { id: position.id, status: "OPEN" },
                data: {
                  currentRate: decimal(position.currentRate),
                  swap: decimal(position.swap),
                  profit: decimal(position.profit),
                  adminPnlAdjustment: decimal(position.adminPnlAdjustment),
                  netProfit: decimal(position.netProfit),
                  swapAccruedAt: new Date(position.lastSwapMs ?? Date.now()),
                },
              });
            }
          },
          { operation: `open-position checkpoint ${Math.floor(offset / chunkSize) + 1}` },
        );
      } catch (error) {
        console.warn("Failed to persist an open-position batch after retries:", error);
      }
    }
  }

  private async stopOutPass(changedUsers: Set<string>): Promise<void> {
    for (const userId of Array.from(this.openPositions.keys())) {
      await userMutationMutex.runExclusive(userId, async () => {
        let guard = 0;
        while (guard < MAX_STOP_OUT_CLOSES_PER_PASS) {
          const positions = this.openPositions.get(userId) ?? [];
          if (positions.length === 0) break;

          const metrics = await this.calculateMetrics(userId);
          if (metrics.margin <= 0 || (metrics.marginLevel ?? Number.POSITIVE_INFINITY) >= STOP_OUT_LEVEL) {
            break;
          }

          const worst = positions.reduce((candidate, position) =>
            position.netProfit.lessThan(candidate.netProfit) ? position : candidate,
          );
          const state = this.instruments.get(worst.symbol);
          if (!state) break;

          const cfg = this.cfg(state);
          const rate = state.sim.rateFor(worst.side === "BUY" ? "SELL" : "BUY");
          const index = positions.findIndex((position) => position.id === worst.id);
          if (index < 0) break;
          positions[index] = markPosition(accrueSwap(worst, cfg), rate, cfg).position;

          console.warn(
            `Stop-out closing ${worst.symbol} ${worst.side}; margin level ${metrics.marginLevel?.toFixed(1)}%.`,
          );
          const closed = await this.closePositionInternal(userId, worst.id, cfg, "STOP_OUT", false);
          if (!closed) break;
          changedUsers.add(userId);
          guard += 1;
        }
      });
    }
  }

  async openPositionReq(input: OpenPositionInput): Promise<OpenPositionResult> {
    return userMutationMutex.runExclusive(input.userId, async () => {
      const reconciliationBlock = await isUserBlocked(input.userId, "TRADE");
      if (reconciliationBlock) {
        throw new TradingError(
          "Trading is blocked while an account discrepancy is under reconciliation review.",
          "BLOCKED",
        );
      }
      const symbol = input.symbol.trim().toUpperCase();
      const state = this.instruments.get(symbol);
      if (!state) throw new TradingError(`Unknown instrument: ${symbol}`, "VALIDATION");

      // Resolve per-user/group settings (trading enabled, category access, max lots).
      const policy = await loadTradingRiskPolicy();
      const userSettings = await resolveUserSettings(input.userId);
      if (!userSettings.trading.enabled) {
        throw new TradingError("Trading is currently disabled for this account.", "BLOCKED");
      }
      if (!userSettings.trading.allowedCategories.includes(state.category)) {
        throw new TradingError(`Trading ${state.category} instruments is not enabled for this account.`, "BLOCKED");
      }
      const effectiveMaxLots = Math.min(userSettings.trading.maxOrderLots, policy.maxOrderLots);
      if (input.volume > effectiveMaxLots) {
        throw new TradingError(`Order volume exceeds the ${effectiveMaxLots}-lot limit.`, "BLOCKED");
      }
      const executableQuote = state.sim.getQuote();
      if (Date.now() - executableQuote.time > policy.maxQuoteAgeMs) {
        throw new TradingError("The executable quote is stale. Wait for market data to recover.", "BLOCKED");
      }

      // Apply spread markup per user/group + commission override.
      const spreadMarkupPips = userSettings.pnl.spreadMarkupPips;
      const effectiveAsk = spreadMarkupPips > 0
        ? executableQuote.ask + Number(state.pipSize) * spreadMarkupPips
        : executableQuote.ask;
      const effectiveBid = spreadMarkupPips > 0
        ? executableQuote.bid - Number(state.pipSize) * spreadMarkupPips
        : executableQuote.bid;

      const cfg = this.cfg(state);
      // Override commission rate if user/group has a custom rate.
      if (userSettings.pnl.commissionPerLotOverride != null) {
        cfg.commissionPerLot = new Decimal(userSettings.pnl.commissionPerLotOverride);
      }

      const entryRate = input.side === "BUY" ? effectiveAsk : effectiveBid;
      this.validateOpenInput(input, entryRate);
      const requestFingerprint = fingerprintOpenRequest(input);

      const replay = await prisma.position.findUnique({
        where: {
          userId_idempotencyKey: {
            userId: input.userId,
            idempotencyKey: input.idempotencyKey,
          },
        },
      });
      if (replay) {
        if (replay.requestFingerprint !== requestFingerprint) {
          throw new TradingError("Idempotency key is already in use.", "CONFLICT");
        }
        const replayedPosition = this.toPosition(replay);
        const view = { ...this.toView(replayedPosition, cfg), status: replay.status };
        return { position: view, metrics: await this.calculateMetrics(input.userId) };
      }

      const opened = openPosition({
        userId: input.userId,
        instrument: cfg,
        side: input.side,
        volume: input.volume,
        type: input.type,
        strikeRate: input.strikeRate,
        expiryMinutes: input.expiryMinutes,
        stopLoss: input.stopLoss,
        takeProfit: input.takeProfit,
        marketRate: entryRate,
      });

      // Immediately mark at the opposite dealing side so the UI and account
      // reflect spread cost from the moment the position opens.
      // Apply spread markup to the re-mark rate too (consistent with open).
      const baseCloseSide = state.sim.rateFor(input.side === "BUY" ? "SELL" : "BUY");
      const closeSideRate = spreadMarkupPips > 0
        ? (input.side === "BUY" ? baseCloseSide - Number(state.pipSize) * spreadMarkupPips : baseCloseSide + Number(state.pipSize) * spreadMarkupPips)
        : baseCloseSide;
      const position = markPosition(opened.position, closeSideRate, cfg).position;
      const requiredCash = opened.margin.add(opened.commissionTotal);

      const persisted = await withSerializableRetry(
        async (tx) => {
          await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`position:${input.userId}:${input.idempotencyKey}`}))`;
          const concurrentReplay = await tx.position.findUnique({
            where: {
              userId_idempotencyKey: {
                userId: input.userId,
                idempotencyKey: input.idempotencyKey,
              },
            },
          });
          if (concurrentReplay) {
            if (concurrentReplay.requestFingerprint !== requestFingerprint) {
              throw new TradingError("Idempotency key is already in use.", "CONFLICT");
            }
            return { record: concurrentReplay, replayed: true };
          }

          const balances = await userLedgerBalances(tx, input.userId, "USD");
          if (balances.available.lessThan(requiredCash)) {
            throw new TradingError("Insufficient free margin.", "INSUFFICIENT_FUNDS");
          }

          const created = await tx.position.create({
            data: {
              userId: input.userId,
              symbol,
              type: input.type,
              side: input.side,
              volume: new Decimal(position.volume.toFixed(4)),
              openRate: decimal(position.openRate),
              strikeRate: position.strikeRate != null ? decimal(position.strikeRate) : null,
              currentRate: decimal(position.currentRate),
              stopLoss: position.stopLoss != null ? decimal(position.stopLoss) : null,
              takeProfit: position.takeProfit != null ? decimal(position.takeProfit) : null,
              swap: decimal(position.swap),
              commission: decimal(position.commission),
              tradingCommission: decimal(position.tradingCommission),
              profit: decimal(position.profit),
              adminPnlAdjustment: decimal(position.adminPnlAdjustment),
              netProfit: decimal(position.netProfit),
              status: "OPEN",
              openedAt: new Date(position.openedAtMs),
              openedTill: position.openedTillMs != null ? new Date(position.openedTillMs) : null,
              swapAccruedAt: new Date(position.lastSwapMs ?? position.openedAtMs),
              idempotencyKey: input.idempotencyKey,
              requestFingerprint,
            },
          });
          await postLedgerTransaction(tx, {
            reference: `MARGIN_RESERVATION:${created.id}`,
            kind: "MARGIN_RESERVATION",
            description: `${symbol} margin reservation`,
            userId: input.userId,
            sourceType: "Position",
            sourceId: created.id,
            lines: [
              { accountId: balances.accounts.available.id, direction: "DEBIT", amount: opened.margin, asset: "USD" },
              { accountId: balances.accounts.margin.id, direction: "CREDIT", amount: opened.margin, asset: "USD" },
            ],
          });
          if (opened.commissionTotal.greaterThan(0)) {
            const commissionRevenue = await ensureSystemAccount(tx, "COMMISSION_REVENUE");
            await postLedgerTransaction(tx, {
              reference: `COMMISSION:${created.id}`,
              kind: "COMMISSION",
              description: `${symbol} opening commission`,
              userId: input.userId,
              sourceType: "Position",
              sourceId: created.id,
              lines: [
                { accountId: balances.accounts.available.id, direction: "DEBIT", amount: opened.commissionTotal, asset: "USD" },
                { accountId: commissionRevenue.id, direction: "CREDIT", amount: opened.commissionTotal, asset: "USD" },
              ],
            });
            await tx.transaction.create({
              data: {
                userId: input.userId,
                type: "COMMISSION",
                status: "COMPLETED",
                amount: opened.commissionTotal.neg(),
                asset: "USD",
                description: `${symbol} opening commission`,
                reference: `COMMISSION-${created.id}`,
              },
            });
          }
          await refreshLedgerProjections(tx, input.userId, "USD");
          await appendAuditEvent(tx, {
            actorId: input.userId,
            action: "POSITION_OPENED",
            entityType: "Position",
            entityId: created.id,
            metadata: {
              symbol,
              side: input.side,
              type: input.type,
              volume: input.volume.toString(),
              margin: opened.margin.toFixed(8),
              commission: opened.commissionTotal.toFixed(8),
              simulation: true,
            },
          });
          return { record: created, replayed: false };
        },
        { operation: `open position ${input.userId}:${input.idempotencyKey}` },
      );

      if (persisted.replayed) {
        const replayedPosition = this.toPosition(persisted.record);
        const replayedView = {
          ...this.toView(replayedPosition, cfg),
          status: persisted.record.status,
        };
        return {
          position: replayedView,
          metrics: await this.calculateMetrics(input.userId),
        };
      }

      position.id = persisted.record.id;
      const positions = this.openPositions.get(input.userId) ?? [];
      positions.push(position);
      this.openPositions.set(input.userId, positions);

      const metrics = await this.recomputeAndBroadcastMetrics(input.userId);
      const view = this.toView(position, cfg);
      this.broadcast({ kind: "position", userId: input.userId, position: view });
      return { position: view, metrics };
    });
  }

  /** Simulation-only dealer control. Adjusts floating P/L and records the operator reason. */
  async adminAdjustPositionPnl(input: {
    actorId: string;
    positionId: string;
    targetProfit: number;
    reason: string;
  }): Promise<OpenPositionResult> {
    if (!Number.isFinite(input.targetProfit) || Math.abs(input.targetProfit) > 1_000_000) {
      throw new TradingError("Target P/L must be a finite amount between -1,000,000 and 1,000,000.", "VALIDATION");
    }
    const reason = input.reason.trim();
    if (reason.length < 5 || reason.length > 500) {
      throw new TradingError("An operator reason between 5 and 500 characters is required.", "VALIDATION");
    }

    const durable = await prisma.position.findUnique({
      where: { id: input.positionId },
      select: { userId: true, status: true, symbol: true },
    });
    if (!durable || durable.status !== "OPEN") {
      throw new TradingError("The position is not open.", "CONFLICT");
    }

    return userMutationMutex.runExclusive(durable.userId, async () => {
      const positions = this.openPositions.get(durable.userId) ?? [];
      const index = positions.findIndex((position) => position.id === input.positionId);
      if (index < 0) throw new TradingError("The open position is not loaded by the execution engine.", "CONFLICT");
      const current = positions[index];
      const state = this.instruments.get(current.symbol);
      if (!state) throw new TradingError("The position instrument is unavailable.", "CONFLICT");
      const cfg = this.cfg(state);
      const targetProfit = money(input.targetProfit);
      const unadjustedProfit = current.profit.sub(current.adminPnlAdjustment);
      const adjustment = money(targetProfit.sub(unadjustedProfit));
      const candidate = markPosition(
        { ...current, adminPnlAdjustment: adjustment },
        current.currentRate,
        cfg,
      ).position;

      await withSerializableRetry(
        async (tx) => {
          const update = await tx.position.updateMany({
            where: { id: input.positionId, userId: durable.userId, status: "OPEN" },
            data: {
              adminPnlAdjustment: adjustment,
              profit: candidate.profit,
              netProfit: candidate.netProfit,
              currentRate: decimal(candidate.currentRate),
            },
          });
          if (update.count !== 1) throw new TradingError("The position changed before the adjustment was applied.", "CONFLICT");
          await refreshLedgerProjections(tx, durable.userId, "USD", undefined, { writeWallet: false });
          await appendAuditEvent(tx, {
            actorId: input.actorId,
            action: "POSITION_PNL_ADJUSTED",
            entityType: "Position",
            entityId: input.positionId,
            metadata: {
              userId: durable.userId,
              symbol: current.symbol,
              previousAdjustment: current.adminPnlAdjustment.toFixed(8),
              targetProfit: targetProfit.toFixed(8),
              adjustment: adjustment.toFixed(8),
              resultingProfit: candidate.profit.toFixed(8),
              resultingNetProfit: candidate.netProfit.toFixed(8),
              reason,
              simulation: true,
            },
          });
        },
        { operation: `admin P/L adjustment ${input.positionId}` },
      );

      positions[index] = candidate;
      const view = this.toView(candidate, cfg);
      this.broadcast({ kind: "position", userId: durable.userId, position: view });
      const metrics = await this.recomputeAndBroadcastMetrics(durable.userId);
      return { position: view, metrics };
    });
  }

  /** Simulation-only dealer control. Closes an open position with an audited operator reason. */
  async adminClosePosition(input: {
    actorId: string;
    positionId: string;
    reason: string;
  }): Promise<OpenPositionResult> {
    const reason = input.reason.trim();
    if (reason.length < 5 || reason.length > 500) {
      throw new TradingError("An operator reason between 5 and 500 characters is required.", "VALIDATION");
    }
    const durable = await prisma.position.findUnique({
      where: { id: input.positionId },
      select: { userId: true, status: true },
    });
    if (!durable || durable.status !== "OPEN") throw new TradingError("The position is not open.", "CONFLICT");

    return userMutationMutex.runExclusive(durable.userId, async () => {
      const positions = this.openPositions.get(durable.userId) ?? [];
      const index = positions.findIndex((position) => position.id === input.positionId);
      if (index < 0) throw new TradingError("The open position is not loaded by the execution engine.", "CONFLICT");
      const current = positions[index];
      const state = this.instruments.get(current.symbol);
      if (!state) throw new TradingError("The position instrument is unavailable.", "CONFLICT");
      const cfg = this.cfg(state);
      const closeRate = state.sim.rateFor(current.side === "BUY" ? "SELL" : "BUY");
      positions[index] = markPosition(accrueSwap(current, cfg), closeRate, cfg).position;
      const closed = await this.closePositionInternal(
        durable.userId,
        input.positionId,
        cfg,
        "ADMIN",
        true,
        input.actorId,
        reason,
      );
      if (!closed) throw new TradingError("The position was already closed.", "CONFLICT");
      return closed;
    });
  }

  async closePositionReq(userId: string, positionId: string): Promise<OpenPositionResult | null> {
    return userMutationMutex.runExclusive(userId, async () => {
      const positions = this.openPositions.get(userId);
      const index = positions?.findIndex((position) => position.id === positionId) ?? -1;
      if (!positions || index < 0) return null;

      const current = positions[index];
      const state = this.instruments.get(current.symbol);
      if (!state) return null;
      const cfg = this.cfg(state);
      const closeRate = state.sim.rateFor(current.side === "BUY" ? "SELL" : "BUY");
      positions[index] = markPosition(accrueSwap(current, cfg), closeRate, cfg).position;
      return this.closePositionInternal(userId, positionId, cfg, "MANUAL", true, userId, null);
    });
  }

  /** Caller must hold the user's mutation lock. */
  private async closePositionInternal(
    userId: string,
    positionId: string,
    cfg: InstrumentCfg,
    reason: string,
    recomputeAfter: boolean,
    actorId: string | null = null,
    operatorNote: string | null = null,
  ): Promise<OpenPositionResult | null> {
    const positions = this.openPositions.get(userId);
    const index = positions?.findIndex((position) => position.id === positionId) ?? -1;
    if (!positions || index < 0) return null;
    const position = positions[index];

    const margin = marginFor(position.volume, cfg.marginPerLot);
    const allInNet = position.netProfit;
    const closedAt = new Date();

    const closed = await withSerializableRetry(
      async (tx) => {
        const update = await tx.position.updateMany({
          where: { id: positionId, userId, status: "OPEN" },
          data: {
            status: "CLOSED",
            currentRate: decimal(position.currentRate),
            swap: decimal(position.swap),
            profit: decimal(position.profit),
            netProfit: decimal(allInNet),
            swapAccruedAt: new Date(position.lastSwapMs ?? closedAt.getTime()),
            closeReason: reason,
            closedAt,
          },
        });
        if (update.count !== 1) return false;

        let balances = await userLedgerBalances(tx, userId, "USD");
        const marginReservation = await tx.ledgerTransaction.findUnique({
          where: { reference: `MARGIN_RESERVATION:${positionId}` },
          select: { id: true },
        });
        if (marginReservation) {
          await reverseLedgerTransaction(tx, {
            originalReference: `MARGIN_RESERVATION:${positionId}`,
            reversalReference: `MARGIN_RELEASE:${positionId}`,
            description: `${position.symbol} margin release`,
            createdBy: actorId ?? userId,
          });
        } else {
          if (balances.margin.lessThan(margin)) {
            throw new Error(`Margin ledger is inconsistent for position ${positionId}.`);
          }
          await postLedgerTransaction(tx, {
            reference: `MARGIN_RELEASE:${positionId}`,
            kind: "REVERSAL",
            description: `${position.symbol} migrated margin release`,
            userId,
            sourceType: "Position",
            sourceId: positionId,
            metadata: { migratedOpeningBalance: true },
            lines: [
              { accountId: balances.accounts.margin.id, direction: "DEBIT", amount: margin, asset: "USD" },
              { accountId: balances.accounts.available.id, direction: "CREDIT", amount: margin, asset: "USD" },
            ],
          });
        }

        balances = await userLedgerBalances(tx, userId, "USD");
        if (!position.profit.isZero()) {
          const contra = await ensureSystemAccount(
            tx,
            position.profit.isPositive() ? "TRADING_PNL_EXPENSE" : "TRADING_PNL_REVENUE",
          );
          const amount = position.profit.abs();
          await postLedgerTransaction(tx, {
            reference: `TRADING_PNL:${positionId}`,
            kind: "TRADING_PNL",
            description: `${position.symbol} ${reason.toLowerCase()} realized P&L`,
            userId,
            sourceType: "Position",
            sourceId: positionId,
            metadata: { closeReason: reason },
            lines: position.profit.isPositive()
              ? [
                  { accountId: contra.id, direction: "DEBIT", amount, asset: "USD" },
                  { accountId: balances.accounts.available.id, direction: "CREDIT", amount, asset: "USD" },
                ]
              : [
                  { accountId: balances.accounts.available.id, direction: "DEBIT", amount, asset: "USD" },
                  { accountId: contra.id, direction: "CREDIT", amount, asset: "USD" },
                ],
          });
          await tx.transaction.create({
            data: {
              userId,
              type: "TRADE_PNL",
              status: "COMPLETED",
              amount: position.profit,
              asset: "USD",
              description: `${position.symbol} ${reason.toLowerCase()} settlement`,
              reference: `PNL-${positionId}`,
            },
          });
        }

        if (!position.swap.isZero()) {
          const contra = await ensureSystemAccount(
            tx,
            position.swap.isPositive() ? "SWAP_EXPENSE" : "SWAP_REVENUE",
          );
          const amount = position.swap.abs();
          await postLedgerTransaction(tx, {
            reference: `SWAP:${positionId}`,
            kind: "SWAP",
            description: `${position.symbol} accrued swap settlement`,
            userId,
            sourceType: "Position",
            sourceId: positionId,
            lines: position.swap.isPositive()
              ? [
                  { accountId: contra.id, direction: "DEBIT", amount, asset: "USD" },
                  { accountId: balances.accounts.available.id, direction: "CREDIT", amount, asset: "USD" },
                ]
              : [
                  { accountId: balances.accounts.available.id, direction: "DEBIT", amount, asset: "USD" },
                  { accountId: contra.id, direction: "CREDIT", amount, asset: "USD" },
                ],
          });
          await tx.transaction.create({
            data: {
              userId,
              type: "SWAP",
              status: "COMPLETED",
              amount: position.swap,
              asset: "USD",
              description: `${position.symbol} accrued swap`,
              reference: `SWAP-${positionId}`,
            },
          });
        }

        balances = await userLedgerBalances(tx, userId, "USD");
        if (balances.available.isNegative()) {
          const protection = balances.available.abs();
          const protectionExpense = await ensureSystemAccount(tx, "NEGATIVE_BALANCE_EXPENSE");
          await postLedgerTransaction(tx, {
            reference: `NEGATIVE_BALANCE_PROTECTION:${positionId}`,
            kind: "NEGATIVE_BALANCE_PROTECTION",
            description: `${position.symbol} negative balance protection`,
            userId,
            sourceType: "Position",
            sourceId: positionId,
            lines: [
              { accountId: protectionExpense.id, direction: "DEBIT", amount: protection, asset: "USD" },
              { accountId: balances.accounts.available.id, direction: "CREDIT", amount: protection, asset: "USD" },
            ],
          });
          await tx.transaction.create({
            data: {
              userId,
              type: "NEGATIVE_BALANCE_PROTECTION",
              status: "COMPLETED",
              amount: protection,
              asset: "USD",
              description: "Negative balance protection",
              reference: `NBP-${positionId}`,
            },
          });
        }

        await refreshLedgerProjections(tx, userId, "USD");
        await appendAuditEvent(tx, {
          actorId,
          action: "POSITION_CLOSED",
          entityType: "Position",
          entityId: positionId,
          metadata: {
            symbol: position.symbol,
            reason,
            profit: position.profit.toFixed(8),
            swap: position.swap.toFixed(8),
            netProfit: allInNet.toFixed(8),
            simulation: true,
            operatorNote,
          },
        });
        return true;
      },
      { operation: `close position ${positionId}` },
    );

    if (!closed) {
      // Durable state already says closed: remove the stale in-memory mirror.
      positions.splice(index, 1);
      return null;
    }

    positions.splice(index, 1);
    const closedView: PositionView = { ...this.toView(position, cfg), status: "CLOSED" };
    this.broadcast({ kind: "position", userId, position: closedView });

    const metrics = recomputeAfter
      ? await this.recomputeAndBroadcastMetrics(userId)
      : await this.calculateMetrics(userId);
    return { position: closedView, metrics };
  }

  private async recomputeAndBroadcastMetrics(userId: string): Promise<AccountMetricsView> {
    // Open/close transactions already persisted the projection. Reading the
    // committed values here avoids a second contending wallet upsert.
    const metrics = await this.calculateMetrics(userId);
    this.broadcast({ kind: "account", userId, account: metrics });
    return metrics;
  }

  private metricsFromBase(
    userId: string,
    balance: Prisma.Decimal,
    credit: Prisma.Decimal,
    available: Prisma.Decimal,
    accountNo: string | null,
  ): AccountMetricsView {
    const positions = this.openPositions.get(userId) ?? [];
    const margins = positions.map((position) => {
      const state = this.instruments.get(position.symbol);
      return state
        ? marginFor(position.volume, new Decimal(state.marginPerLot.toString()))
        : money(0);
    });
    const calculated = computeMetrics({ balance, credit, available, positions, margins });
    return {
      accountNo,
      balance: Number(calculated.balance),
      credit: Number(calculated.credit),
      equity: Number(calculated.equity),
      margin: Number(calculated.margin),
      marginLevel: calculated.marginLevel == null ? null : Number(calculated.marginLevel),
      free: Number(calculated.free),
      floatingPl: Number(calculated.floatingPl),
    };
  }

  private floatingForUser(userId: string): Prisma.Decimal {
    return money(
      (this.openPositions.get(userId) ?? []).reduce(
        (total, position) => total.add(position.profit).add(position.swap),
        money(0),
      ),
    );
  }

  /** Batch metric projection for the market tick to avoid N+1 database reads. */
  private async recomputeAndBroadcastMetricsBatch(
    userIds: Set<string>,
    persist: boolean,
  ): Promise<void> {
    const ids = Array.from(userIds);
    if (ids.length === 0) return;

    const rows: Array<{
      userId: string;
      balance: Prisma.Decimal;
      credit: Prisma.Decimal;
      user: { accountNo: string | null };
    }> = [];
    const readChunkSize = 500;
    for (let offset = 0; offset < ids.length; offset += readChunkSize) {
      rows.push(
        ...(await prisma.accountMetrics.findMany({
          where: { userId: { in: ids.slice(offset, offset + readChunkSize) } },
          select: {
            userId: true,
            balance: true,
            credit: true,
            user: { select: { accountNo: true } },
          },
        })),
      );
    }

    const rowByUser = new Map(rows.map((row) => [row.userId, row]));
    const missingIds = ids.filter((id) => !rowByUser.has(id));
    const missingUsers = missingIds.length
      ? await prisma.user.findMany({
          where: { id: { in: missingIds } },
          select: { id: true, accountNo: true },
        })
      : [];
    const missingAccountNo = new Map(missingUsers.map((user) => [user.id, user.accountNo]));
    const wallets = await prisma.wallet.findMany({
      where: { userId: { in: ids }, asset: "USD" },
      select: { userId: true, free: true },
    });
    const availableByUser = new Map(wallets.map((wallet) => [wallet.userId, wallet.free]));

    const outputs = ids.map((userId) => {
      const row = rowByUser.get(userId);
      return {
        userId,
        metrics: this.metricsFromBase(
          userId,
          row?.balance ?? money(0),
          row?.credit ?? money(0),
          availableByUser.get(userId) ?? money(0),
          row?.user.accountNo ?? missingAccountNo.get(userId) ?? null,
        ),
      };
    });

    for (const { userId, metrics } of outputs) {
      this.broadcast({ kind: "account", userId, account: metrics });
    }
    if (!persist) return;

    const writeChunkSize = 25;
    for (let offset = 0; offset < outputs.length; offset += writeChunkSize) {
      const chunk = outputs.slice(offset, offset + writeChunkSize);
      await withSerializableRetry(
        async (tx) => {
          for (const { userId } of chunk) {
            await refreshLedgerProjections(tx, userId, "USD", this.floatingForUser(userId), { writeWallet: false });
          }
        },
        { operation: "market metric projection batch" },
      );
    }
  }

  private async calculateMetrics(userId: string): Promise<AccountMetricsView> {
    const [metricsRow, wallet] = await Promise.all([
      prisma.accountMetrics.findUnique({
        where: { userId },
        select: {
          balance: true,
          credit: true,
          user: { select: { accountNo: true } },
        },
      }),
      prisma.wallet.findUnique({
        where: { userId_asset: { userId, asset: "USD" } },
        select: { free: true },
      }),
    ]);

    if (metricsRow) {
      return this.metricsFromBase(
        userId,
        metricsRow.balance,
        metricsRow.credit,
        wallet?.free ?? money(0),
        metricsRow.user.accountNo,
      );
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { accountNo: true },
    });
    return this.metricsFromBase(userId, money(0), money(0), money(0), user?.accountNo ?? null);
  }

  /** Read live account metrics without writing projection rows. */
  async readAccountMetrics(userId: string): Promise<AccountMetricsView> {
    return this.calculateMetrics(userId);
  }

  /** Publish the latest committed account projection to authenticated clients. */
  async publishAccountMetrics(userId: string): Promise<AccountMetricsView> {
    const metrics = await this.calculateMetrics(userId);
    this.broadcast({ kind: "account", userId, account: metrics });
    return metrics;
  }

  /** Persist one user's projection with conflict retry and per-user coalescing. */
  async recomputeMetrics(userId: string): Promise<AccountMetricsView> {
    const active = this.projectionRefreshes.get(userId);
    if (active) return active;

    const refresh = (async () => {
      await withSerializableRetry(
        (tx) => refreshLedgerProjections(tx, userId, "USD", this.floatingForUser(userId)),
        { operation: `account projection refresh for ${userId}` },
      );
      return this.calculateMetrics(userId);
    })().finally(() => {
      if (this.projectionRefreshes.get(userId) === refresh) {
        this.projectionRefreshes.delete(userId);
      }
    });
    this.projectionRefreshes.set(userId, refresh);
    return refresh;
  }

  async accountSnapshot(userId: string): Promise<{ account: AccountMetricsView; positions: PositionView[] }> {
    const positions = (this.openPositions.get(userId) ?? []).flatMap((position) => {
      const instrument = this.instruments.get(position.symbol);
      return instrument ? [this.toView(position, this.cfg(instrument))] : [];
    });
    return { account: await this.calculateMetrics(userId), positions };
  }

  snapshot(symbol: string, interval: CandleInterval, userId: string | null) {
    const state = this.instruments.get(symbol);
    const positions = (userId ? this.openPositions.get(userId) ?? [] : []).flatMap((position) => {
      const instrument = this.instruments.get(position.symbol);
      return instrument ? [this.toView(position, this.cfg(instrument))] : [];
    });
    return {
      symbol,
      interval,
      candles: state?.sim.getCandles(interval, 300) ?? [],
      quote: state?.sim.getQuote() ?? null,
      instruments: this.listInstruments().map((instrument) => this.instrumentView(instrument)),
      positions,
      account: null as AccountMetricsView | null,
    };
  }

  private validateOpenInput(input: OpenPositionInput, entryRate: number): void {
    const maxLots = Number(process.env.MAX_POSITION_LOTS ?? DEFAULT_MAX_POSITION_LOTS);
    const effectiveMax = Number.isFinite(maxLots) && maxLots > 0 ? maxLots : DEFAULT_MAX_POSITION_LOTS;
    if (!Number.isFinite(input.volume) || input.volume < MIN_POSITION_LOTS || input.volume > effectiveMax) {
      throw new TradingError(
        `Volume must be between ${MIN_POSITION_LOTS} and ${effectiveMax} lots.`,
        "VALIDATION",
      );
    }
    if (decimalPlaces(input.volume) > 4) {
      throw new TradingError("Volume supports at most four decimal places.", "VALIDATION");
    }

    for (const [name, value] of [
      ["stop loss", input.stopLoss],
      ["take profit", input.takeProfit],
      ["strike rate", input.strikeRate],
    ] as const) {
      if (value != null && (!Number.isFinite(value) || value <= 0)) {
        throw new TradingError(`Invalid ${name}.`, "VALIDATION");
      }
    }

    if (input.type === "STRIKE") {
      if (input.expiryMinutes == null || !Number.isInteger(input.expiryMinutes) || input.expiryMinutes < 1 || input.expiryMinutes > 1_440) {
        throw new TradingError("Strike expiry must be between 1 and 1,440 minutes.", "VALIDATION");
      }
      if (input.stopLoss != null || input.takeProfit != null) {
        throw new TradingError("Strike positions do not accept stop-loss or take-profit levels.", "VALIDATION");
      }
      return;
    }

    if (input.expiryMinutes != null || input.strikeRate != null) {
      throw new TradingError("CFD positions do not accept strike or expiry fields.", "VALIDATION");
    }

    if (input.side === "BUY") {
      if (input.stopLoss != null && input.stopLoss >= entryRate) {
        throw new TradingError("Buy stop loss must be below the entry price.", "VALIDATION");
      }
      if (input.takeProfit != null && input.takeProfit <= entryRate) {
        throw new TradingError("Buy take profit must be above the entry price.", "VALIDATION");
      }
    } else {
      if (input.stopLoss != null && input.stopLoss <= entryRate) {
        throw new TradingError("Sell stop loss must be above the entry price.", "VALIDATION");
      }
      if (input.takeProfit != null && input.takeProfit >= entryRate) {
        throw new TradingError("Sell take profit must be below the entry price.", "VALIDATION");
      }
    }
  }

  private cfg(state: InstrumentState): InstrumentCfg {
    return {
      symbol: state.symbol,
      digits: state.digits,
      pipSize: new Decimal(state.pipSize.toString()),
      pipValue: new Decimal(state.pipValue.toString()),
      marginPerLot: new Decimal(state.marginPerLot.toString()),
      commissionPerLot: new Decimal(state.commissionPerLot.toString()),
      swapLongPipsPerDay: new Decimal(state.swapLongPipsPerDay.toString()),
      swapShortPipsPerDay: new Decimal(state.swapShortPipsPerDay.toString()),
    };
  }

  private toPosition(position: {
    id: string;
    symbol: string;
    type: PositionType;
    side: PositionSide;
    volume: Prisma.Decimal;
    openRate: Prisma.Decimal;
    strikeRate: Prisma.Decimal | null;
    currentRate: Prisma.Decimal;
    stopLoss: Prisma.Decimal | null;
    takeProfit: Prisma.Decimal | null;
    swap: Prisma.Decimal;
    commission: Prisma.Decimal;
    tradingCommission: Prisma.Decimal;
    profit: Prisma.Decimal;
    adminPnlAdjustment: Prisma.Decimal;
    netProfit: Prisma.Decimal;
    openedAt: Date;
    openedTill: Date | null;
    swapAccruedAt: Date;
  }): Position {
    return {
      id: position.id,
      symbol: position.symbol,
      type: position.type,
      side: position.side,
      volume: Number(position.volume),
      openRate: Number(position.openRate),
      strikeRate: position.strikeRate != null ? Number(position.strikeRate) : null,
      currentRate: Number(position.currentRate),
      stopLoss: position.stopLoss != null ? Number(position.stopLoss) : null,
      takeProfit: position.takeProfit != null ? Number(position.takeProfit) : null,
      swap: money(position.swap),
      commission: money(position.commission),
      tradingCommission: money(position.tradingCommission),
      profit: money(position.profit),
      adminPnlAdjustment: money(position.adminPnlAdjustment),
      netProfit: money(position.netProfit),
      openedAtMs: position.openedAt.getTime(),
      openedTillMs: position.openedTill?.getTime() ?? null,
      lastSwapMs: position.swapAccruedAt.getTime(),
    };
  }

  private toView(position: Position, cfg: InstrumentCfg): PositionView {
    const entry = position.type === "STRIKE" && position.strikeRate != null
      ? position.strikeRate
      : position.openRate;
    const priceMove =
      position.side === "BUY"
        ? new Decimal(position.currentRate.toString()).sub(entry.toString())
        : new Decimal(entry.toString()).sub(position.currentRate.toString());
    const pips = Number(priceMove.div(cfg.pipSize));
    return {
      id: position.id,
      symbol: position.symbol,
      type: position.type,
      side: position.side,
      volume: position.volume,
      openRate: position.openRate,
      strikeRate: position.strikeRate,
      currentRate: position.currentRate,
      pips,
      stopLoss: position.stopLoss,
      takeProfit: position.takeProfit,
      swap: Number(position.swap),
      commission: Number(position.commission),
      tradingCommission: Number(position.tradingCommission),
      profit: Number(position.profit),
      adminPnlAdjustment: Number(position.adminPnlAdjustment),
      netProfit: Number(position.netProfit),
      status: "OPEN",
      openedAt: position.openedAtMs,
      openedTill: position.openedTillMs,
    };
  }
}

export type TradingErrorCode = "VALIDATION" | "INSUFFICIENT_FUNDS" | "CONFLICT" | "BLOCKED";

export class TradingError extends Error {
  constructor(message: string, readonly code: TradingErrorCode) {
    super(message);
    this.name = "TradingError";
  }
}

function decimal(value: Prisma.Decimal.Value): Prisma.Decimal {
  return money(value);
}

function fingerprintOpenRequest(input: OpenPositionInput): string {
  return createHash("sha256")
    .update(
      JSON.stringify({
        symbol: input.symbol.trim().toUpperCase(),
        side: input.side,
        volume: input.volume.toString(),
        type: input.type,
        strikeRate: input.strikeRate?.toString() ?? null,
        expiryMinutes: input.expiryMinutes,
        stopLoss: input.stopLoss?.toString() ?? null,
        takeProfit: input.takeProfit?.toString() ?? null,
      }),
    )
    .digest("hex");
}

function decimalPlaces(value: number): number {
  const text = value.toString().toLowerCase();
  if (text.includes("e-")) return Number(text.split("e-")[1] ?? 0);
  return text.includes(".") ? text.split(".")[1].length : 0;
}

const hubGlobal = globalThis as typeof globalThis & {
  __blckforest_hub?: Hub;
};

export const hub: Hub = hubGlobal.__blckforest_hub ?? new Hub();
// Always cache on globalThis. The custom server (server.ts) and the Next.js
// bundled API routes resolve this module through different import paths, so
// without a shared global each bundle gets its own instance: server.ts
// initializes one (45 instruments), the route handler gets a fresh empty one,
// and hub.isReady() returns false forever → /api/health stays 503 → Caddy's
// service_healthy dependency never resolves → ports 80/443 never open.
hubGlobal.__blckforest_hub = hub;
