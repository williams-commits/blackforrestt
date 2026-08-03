/**
 * ForexSimulator — generates a believable live quote for one instrument.
 *
 * On each tick it:
 *   1. Advances the mid price via a mean-reverting random walk (forex pairs
 *      trade in ranges far more than equities/crypto, so we revert to base).
 *   2. Snaps to the instrument's digit precision and derives a bid/ask spread.
 *   3. Aggregates the tick into per-interval OHLCV candles.
 *   4. Rolls 24h statistics (open/high/low/change%).
 *
 * The simulator owns only *market* data. Positions + account math live in the
 * position engine.
 */
import type { Candle, CandleInterval, Quote } from "./types";
import { INTERVAL_SECONDS } from "./types";

export interface InstrumentConfig {
  symbol: string;
  basePrice: number;
  digits: number;
  // Half-spread in price units (bid = mid - spread, ask = mid + spread).
  spread: number;
  // Annualized volatility for the random walk.
  volatility: number;
  // Mean-reversion strength toward basePrice (0 = none, 1 = snap).
  reversion: number;
}

function pow10(n: number): number {
  return Math.pow(10, n);
}

/** A tiny, fast PRNG (mulberry32) for deterministic simulation when seeded. */
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function gaussian(rng: () => number): number {
  let u = 0;
  let v = 0;
  while (u === 0) u = rng();
  while (v === 0) v = rng();
  return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
}

export class ForexSimulator {
  readonly symbol: string;
  readonly digits: number;
  readonly tickSize: number; // smallest representable price step (10^-digits)
  readonly spread: number;

  private mid: number;
  private base: number;
  private vol: number;
  private reversion: number;
  private rng: () => number;

  private candles: Record<CandleInterval, Candle[]> = {
    "1m": [],
    "5m": [],
    "15m": [],
    "1h": [],
    "4h": [],
    "1d": [],
  };
  private current: Record<CandleInterval, Candle | null> = {
    "1m": null,
    "5m": null,
    "15m": null,
    "1h": null,
    "4h": null,
    "1d": null,
  };

  private open24h: number;
  private high24h: number;
  private low24h: number;
  private windowStartMs: number;

  // ── Live feed support ────────────────────────────────────────────────────
  // When a live trade price arrives via setPrice(), the simulator switches
  // from the random walk to "live mode" for this instrument. If no live price
  // arrives within LIVE_TIMEOUT_MS, it falls back to simulation.
  private lastLiveMs = 0;
  private static readonly LIVE_TIMEOUT_MS = 15_000; // 15s without a tick → simulate

  constructor(cfg: InstrumentConfig) {
    this.symbol = cfg.symbol;
    this.digits = cfg.digits;
    this.tickSize = pow10(-cfg.digits);
    this.spread = cfg.spread;
    this.mid = cfg.basePrice;
    this.base = cfg.basePrice;
    this.vol = cfg.volatility;
    this.reversion = cfg.reversion;

    // Deterministic PRNG seed: derive from symbol + optional MARKET_SEED env.
    // This ensures the SAME synthetic candle history every restart (until the
    // live feed or DB persistence takes over). Without this, every process
    // restart would produce a completely different chart.
    const seedRaw = process.env.MARKET_SEED;
    const symbolHash = hashString(cfg.symbol);
    const seed = seedRaw ? parseInt(seedRaw, 10) ^ symbolHash : symbolHash;
    this.rng = mulberry32(Math.abs(seed) || 1);

    this.open24h = cfg.basePrice;
    this.high24h = cfg.basePrice;
    this.low24h = cfg.basePrice;
    this.windowStartMs = Date.now();

    // Seed synthetic history immediately (will be replaced by DB data in init).
    this.seedHistory();
  }

  // ── Live feed injection ───────────────────────────────────────────────────

  /**
   * Inject a real trade price from the live feed. Snaps to tick size and
   * updates 24h rolling stats. The next tick() will skip the random walk and
   * use this price instead.
   */
  setPrice(price: number): void {
    if (!isFinite(price) || price <= 0) return;
    this.mid = round(price, this.tickSize);
    this.lastLiveMs = Date.now();
    this.high24h = Math.max(this.high24h, this.mid);
    this.low24h = Math.min(this.low24h, this.mid);
  }

  /** Whether this instrument currently has a live feed (recent price received). */
  get isLive(): boolean {
    return this.lastLiveMs > 0 && Date.now() - this.lastLiveMs < ForexSimulator.LIVE_TIMEOUT_MS;
  }

  /**
   * Replace synthetic candle history with real OHLC data from the Finnhub REST
   * API. Only replaces the requested interval; others keep their seeded history.
   */
  seedCandles(interval: CandleInterval, realCandles: Candle[]): void {
    if (!realCandles || realCandles.length === 0) return;
    this.candles[interval] = realCandles.slice(-1000);
    this.current[interval] = realCandles[realCandles.length - 1] ?? null;
    // Sync mid to the latest real close.
    const last = realCandles[realCandles.length - 1];
    this.mid = round(last.close, this.tickSize);
    if (this.lastLiveMs === 0) {
      this.open24h = last.open;
      this.high24h = last.high;
      this.low24h = last.low;
    }
  }

  /** Pre-populate candles per interval so the chart isn't empty on load. */
  private seedHistory() {
    const now = Math.floor(Date.now() / 1000);
    for (const interval of Object.keys(this.candles) as CandleInterval[]) {
      const secs = INTERVAL_SECONDS[interval];
      const count = 300;
      const start = now - secs * count;
      // Each interval walks independently from basePrice, anchored by reversion.
      let p = this.base;
      const sigma = this.vol * Math.sqrt(secs / (365 * 24 * 3600));
      for (let i = 0; i < count; i++) {
        const time = start + i * secs;
        const open = p;
        const shock = sigma * gaussian(this.rng);
        const revert = (this.base - p) * this.reversion * (secs / (3600));
        p = Math.max(p + p * shock + revert, this.tickSize);
        const high = Math.max(open, p) * (1 + Math.abs(gaussian(this.rng)) * sigma * 0.4);
        const low = Math.min(open, p) * (1 - Math.abs(gaussian(this.rng)) * sigma * 0.4);
        const c: Candle = {
          time,
          open: round(open, this.tickSize),
          high: round(high, this.tickSize),
          low: round(low, this.tickSize),
          close: round(p, this.tickSize),
          volume: 100 * (0.5 + this.rng()),
        };
        this.candles[interval].push(c);
      }
      this.current[interval] = this.candles[interval][this.candles[interval].length - 1] ?? null;
    }
    const last1m = this.candles["1m"][this.candles["1m"].length - 1];
    this.mid = round(last1m ? last1m.close : this.base, this.tickSize);
    this.open24h = this.mid;
    this.high24h = this.mid;
    this.low24h = this.mid;
  }

  /** Advance one tick (called by the hub on its interval). */
  tick(): { updatedIntervals: CandleInterval[] } {
    const nowSec = Math.floor(Date.now() / 1000);
    const nowMs = Date.now();

    // Only run the random walk if we DON'T have a recent live price.
    // When in live mode, mid is already set by setPrice() from the feed.
    if (!this.isLive) {
      // Mean-reverting random walk (Ornstein-Uhlenbeck-ish) per second.
      const dt = 1 / (365 * 24 * 3600);
      const sigma = this.vol * Math.sqrt(dt);
      const shock = this.mid * sigma * gaussian(this.rng);
      const revert = (this.base - this.mid) * this.reversion * (1 / 3600);
      this.mid = round(Math.max(this.mid + shock + revert, this.tickSize), this.tickSize);
    }

    // Aggregate into candles (runs in both live and sim modes).
    const updated: CandleInterval[] = [];
    for (const interval of Object.keys(this.candles) as CandleInterval[]) {
      const secs = INTERVAL_SECONDS[interval];
      const bucket = Math.floor(nowSec / secs) * secs;
      let cur = this.current[interval];
      if (!cur || cur.time !== bucket) {
        const open = cur ? cur.close : this.mid;
        cur = {
          time: bucket,
          open,
          high: Math.max(open, this.mid),
          low: Math.min(open, this.mid),
          close: this.mid,
          volume: 0,
        };
        this.candles[interval].push(cur);
        const max = 1000;
        if (this.candles[interval].length > max) {
          this.candles[interval].splice(0, this.candles[interval].length - max);
        }
        this.current[interval] = cur;
      } else {
        cur.high = Math.max(cur.high, this.mid);
        cur.low = Math.min(cur.low, this.mid);
        cur.close = this.mid;
      }
      cur.volume += 1 + this.rng() * 3;
      updated.push(interval);
    }

    // 24h stats.
    this.high24h = Math.max(this.high24h, this.mid);
    this.low24h = Math.min(this.low24h, this.mid);
    if (nowMs - this.windowStartMs > 24 * 3600 * 1000) {
      this.open24h = this.mid;
      this.high24h = this.mid;
      this.low24h = this.mid;
      this.windowStartMs = nowMs;
    }

    return { updatedIntervals: updated };
  }

  getQuote(): Quote {
    const bid = round(this.mid - this.spread / 2, this.tickSize);
    const ask = round(this.mid + this.spread / 2, this.tickSize);
    const changePct = this.open24h > 0 ? ((this.mid - this.open24h) / this.open24h) * 100 : 0;
    return {
      symbol: this.symbol,
      bid,
      ask,
      mid: this.mid,
      time: Date.now(),
      open24h: this.open24h,
      high24h: this.high24h,
      low24h: this.low24h,
      changePct,
    };
  }

  getCandles(interval: CandleInterval, limit = 300): Candle[] {
    const arr = this.candles[interval];
    return arr.slice(Math.max(0, arr.length - limit));
  }

  /** Current market rate for a given side (the price a new position fills at). */
  rateFor(side: PositionSideLike): number {
    const q = this.getQuote();
    // BUY fills at ask, SELL fills at bid.
    return side === "BUY" ? q.ask : q.bid;
  }

  get markPrice(): number {
    return this.mid;
  }
}

type PositionSideLike = "BUY" | "SELL";

function round(v: number, step: number): number {
  const inv = 1 / step;
  return Math.round(v * inv) / inv;
}

/** Simple string hash → 32-bit int (for deterministic per-symbol seeding). */
function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
