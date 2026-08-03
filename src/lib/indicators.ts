/**
 * Pure technical-analysis helpers operating on candle arrays. No dependencies.
 * Candle shape: { time, open, high, low, close, volume } (time in unix seconds).
 */

export interface Candle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

/** Simple moving average of the close over the last `period` candles. */
export function sma(candles: Candle[], period: number): number | null {
  if (candles.length < period || period <= 0) return null;
  let sum = 0;
  for (let i = candles.length - period; i < candles.length; i += 1) {
    sum += candles[i].close;
  }
  return sum / period;
}

/** Exponential moving average of the close across the series (seeded with SMA). */
export function ema(candles: Candle[], period: number): number | null {
  if (candles.length < period || period <= 0) return null;
  const k = 2 / (period + 1);
  let prev = sma(candles.slice(0, period), period) ?? 0;
  for (let i = period; i < candles.length; i += 1) {
    prev = candles[i].close * k + prev * (1 - k);
  }
  return prev;
}

/**
 * Relative Strength Index (Wilder's smoothing) over the last `period` candles.
 * Returns a value in [0, 100], or null if there is insufficient data.
 */
export function rsi(candles: Candle[], period = 14): number | null {
  if (candles.length <= period || period <= 0) return null;
  let gains = 0;
  let losses = 0;
  for (let i = candles.length - period; i < candles.length; i += 1) {
    const diff = candles[i].close - candles[i - 1].close;
    if (diff >= 0) gains += diff;
    else losses -= diff;
  }
  if (losses === 0) return 100;
  const rs = gains / losses / period * period; // equivalent average ratio
  return 100 - 100 / (1 + rs);
}

/** Average True Range over the last `period` candles (volatility measure). */
export function atr(candles: Candle[], period = 14): number | null {
  if (candles.length <= period || period <= 0) return null;
  let sum = 0;
  for (let i = candles.length - period; i < candles.length; i += 1) {
    const high = candles[i].high;
    const low = candles[i].low;
    const prevClose = candles[i - 1].close;
    const tr = Math.max(high - low, Math.abs(high - prevClose), Math.abs(low - prevClose));
    sum += tr;
  }
  return sum / period;
}

/** Recent swing support (min low) and resistance (max high) over the window. */
export function supportResistance(
  candles: Candle[],
  window = 50,
): { support: number | null; resistance: number | null } {
  const slice = candles.slice(-window);
  if (slice.length === 0) return { support: null, resistance: null };
  let support = Infinity;
  let resistance = -Infinity;
  for (const candle of slice) {
    if (candle.low < support) support = candle.low;
    if (candle.high > resistance) resistance = candle.high;
  }
  return { support: Number.isFinite(support) ? support : null, resistance: Number.isFinite(resistance) ? resistance : null };
}

/** Derive a coarse directional bias from SMA fast/slow and RSI. */
export function bias(fast: number | null, slow: number | null, rsiValue: number | null): "bullish" | "bearish" | "neutral" {
  if (fast == null || slow == null) return "neutral";
  if (fast > slow && (rsiValue == null || rsiValue < 70)) return "bullish";
  if (fast < slow && (rsiValue == null || rsiValue > 30)) return "bearish";
  return "neutral";
}

// ── Series-returning versions for chart rendering ───────────────────────────

export interface SeriesPoint {
  time: number; // unix seconds
  value: number;
}

/** Rolling SMA series for chart rendering. Returns {time, value}[] skipping warmup. */
export function computeSMASeries(candles: Candle[], period: number): SeriesPoint[] {
  if (candles.length < period) return [];
  const result: SeriesPoint[] = [];
  let sum = 0;
  for (let i = 0; i < candles.length; i++) {
    sum += candles[i].close;
    if (i >= period) sum -= candles[i - period].close;
    if (i >= period - 1) result.push({ time: candles[i].time, value: sum / period });
  }
  return result;
}

/** Rolling EMA series for chart rendering. */
export function computeEMASeries(candles: Candle[], period: number): SeriesPoint[] {
  if (candles.length < period) return [];
  const k = 2 / (period + 1);
  const result: SeriesPoint[] = [];
  let prev = candles.slice(0, period).reduce((s, c) => s + c.close, 0) / period;
  result.push({ time: candles[period - 1].time, value: prev });
  for (let i = period; i < candles.length; i++) {
    prev = candles[i].close * k + prev * (1 - k);
    result.push({ time: candles[i].time, value: prev });
  }
  return result;
}

export interface BollingerPoint {
  time: number;
  upper: number;
  middle: number;
  lower: number;
}

/** Bollinger Bands series: middle = SMA, upper/lower = ±stdDev * stddev. */
export function computeBollinger(candles: Candle[], period = 20, stdDev = 2): BollingerPoint[] {
  if (candles.length < period) return [];
  const result: BollingerPoint[] = [];
  for (let i = period - 1; i < candles.length; i++) {
    const window = candles.slice(i - period + 1, i + 1);
    const closes = window.map((c) => c.close);
    const mean = closes.reduce((s, v) => s + v, 0) / period;
    const variance = closes.reduce((s, v) => s + (v - mean) ** 2, 0) / period;
    const sd = Math.sqrt(variance);
    result.push({
      time: candles[i].time,
      middle: mean,
      upper: mean + stdDev * sd,
      lower: mean - stdDev * sd,
    });
  }
  return result;
}

/** Wilder-smoothed RSI series for chart rendering. Returns {time, value}[]. */
export function computeRSISeries(candles: Candle[], period = 14): SeriesPoint[] {
  if (candles.length <= period) return [];
  let avgGain = 0;
  let avgLoss = 0;
  // Seed with simple average of gains/losses over first `period` changes.
  for (let i = 1; i <= period; i++) {
    const diff = candles[i].close - candles[i - 1].close;
    if (diff >= 0) avgGain += diff;
    else avgLoss -= diff;
  }
  avgGain /= period;
  avgLoss /= period;
  const result: SeriesPoint[] = [];
  const rsi = (ag: number, al: number) => al === 0 ? 100 : 100 - 100 / (1 + ag / al);
  result.push({ time: candles[period].time, value: rsi(avgGain, avgLoss) });
  // Wilder smoothing for the rest.
  for (let i = period + 1; i < candles.length; i++) {
    const diff = candles[i].close - candles[i - 1].close;
    const gain = diff >= 0 ? diff : 0;
    const loss = diff < 0 ? -diff : 0;
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
    result.push({ time: candles[i].time, value: rsi(avgGain, avgLoss) });
  }
  return result;
}

export interface MACDPoint {
  time: number;
  macd: number;
  signal: number;
  histogram: number;
}

/** MACD series: macd = EMA(fast) - EMA(slow), signal = EMA(macd, signalPeriod). */
export function computeMACD(candles: Candle[], fast = 12, slow = 26, signalPeriod = 9): MACDPoint[] {
  if (candles.length < slow + signalPeriod) return [];
  const emaArr = (period: number): number[] => {
    const k = 2 / (period + 1);
    const arr: number[] = [];
    let prev = candles.slice(0, period).reduce((s, c) => s + c.close, 0) / period;
    arr[period - 1] = prev;
    for (let i = period; i < candles.length; i++) {
      prev = candles[i].close * k + prev * (1 - k);
      arr[i] = prev;
    }
    return arr;
  };
  const fastEma = emaArr(fast);
  const slowEma = emaArr(slow);
  const macdLine: (number | null)[] = candles.map((_, i) =>
    fastEma[i] != null && slowEma[i] != null ? fastEma[i]! - slowEma[i]! : null,
  );
  // Signal = EMA of the macdLine (only over non-null values).
  const macdValues = macdLine.map((v) => v ?? 0);
  const firstValid = slow - 1;
  const k = 2 / (signalPeriod + 1);
  let prevSignal = 0;
  const signalLine: (number | null)[] = new Array(candles.length).fill(null);
  let signalStarted = false;
  for (let i = firstValid; i < candles.length; i++) {
    if (!signalStarted) {
      // Seed signal with average of first `signalPeriod` MACD values.
      if (i - firstValid >= signalPeriod - 1) {
        let sum = 0;
        for (let j = firstValid; j <= i; j++) sum += macdValues[j];
        prevSignal = sum / signalPeriod;
        signalLine[i] = prevSignal;
        signalStarted = true;
      }
    } else {
      prevSignal = macdValues[i] * k + prevSignal * (1 - k);
      signalLine[i] = prevSignal;
    }
  }
  const result: MACDPoint[] = [];
  for (let i = 0; i < candles.length; i++) {
    if (macdLine[i] != null && signalLine[i] != null) {
      result.push({
        time: candles[i].time,
        macd: macdLine[i]!,
        signal: signalLine[i]!,
        histogram: macdLine[i]! - signalLine[i]!,
      });
    }
  }
  return result;
}
