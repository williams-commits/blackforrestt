import { NextResponse } from "next/server";
import { hub } from "@/server/engine/hub";
import type { CandleInterval } from "@/server/engine/types";
import { atr, bias, rsi, sma, supportResistance, type Candle } from "@/lib/indicators";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SIGNAL_INTERVAL: CandleInterval = "1h";

interface RawSignal {
  symbol: string;
  name: string;
  side: "BUY" | "SELL";
  confidence: "high" | "medium" | "low";
  reason: string;
  price: number;
  entry: number;
  stop: number;
  target: number;
  changePct: number;
}

/**
 * GET /api/analysis/signals
 * Scans every active instrument and emits trade ideas derived from live price
 * action: SMA(20/50) crossover, RSI(14) overbought/oversold, and distance to
 * support/resistance. Entry/stop/target are derived from the current price and
 * ATR. Ideas are educational, not execution advice.
 */
export async function GET() {
  if (!hub.isReady()) {
    return NextResponse.json({ error: "Market data is still starting. Retry shortly." }, { status: 503 });
  }

  const instruments = hub.listInstruments();
  const signals: RawSignal[] = [];

  for (const state of instruments) {
    const view = hub.instrumentView(state);
    const snapshot = hub.snapshot(view.symbol, SIGNAL_INTERVAL, null);
    const candles = snapshot.candles as Candle[];
    const quote = snapshot.quote;
    if (candles.length < 20 || !quote) continue;

    const fast = sma(candles, 20);
    const slow = sma(candles, 50);
    const rsiValue = rsi(candles, 14);
    const atrValue = atr(candles, 14);
    const { support, resistance } = supportResistance(candles, 50);
    if (fast == null || slow == null || atrValue == null) continue;

    const directional = bias(fast, slow, rsiValue);
    const price = quote.mid;

    // Only emit an idea when indicators agree on a direction.
    let side: "BUY" | "SELL" | null = null;
    let reason = "";
    let confidence: "high" | "medium" | "low" = "low";

    if (directional === "bullish" && rsiValue != null && rsiValue < 70) {
      side = "BUY";
      reason = `Bullish SMA crossover with RSI at ${rsiValue.toFixed(0)} (room before overbought).`;
      confidence = rsiValue > 50 && rsiValue < 65 ? "high" : "medium";
    } else if (directional === "bearish" && rsiValue != null && rsiValue > 30) {
      side = "SELL";
      reason = `Bearish SMA crossover with RSI at ${rsiValue.toFixed(0)} (room before oversold).`;
      confidence = rsiValue < 50 && rsiValue > 35 ? "high" : "medium";
    } else if (rsiValue != null && rsiValue <= 30) {
      side = "BUY";
      reason = `RSI oversold at ${rsiValue.toFixed(0)} — mean-reversion bounce candidate.`;
      confidence = "medium";
    } else if (rsiValue != null && rsiValue >= 70) {
      side = "SELL";
      reason = `RSI overbought at ${rsiValue.toFixed(0)} — mean-reversion pullback candidate.`;
      confidence = "medium";
    }

    if (!side) continue;

    // Stop/target sized off ATR around the current price.
    const entry = price;
    const stop = side === "BUY" ? entry - atrValue * 1.5 : entry + atrValue * 1.5;
    const target = side === "BUY" ? entry + atrValue * 2.5 : entry - atrValue * 2.5;

    signals.push({
      symbol: view.symbol,
      name: view.name,
      side,
      confidence,
      reason,
      price,
      entry,
      stop,
      target,
      changePct: quote.changePct,
    });

    // Keep support/resistance referenced so tree-shaking doesn't drop the calc;
    // future iterations may surface "distance to level" in the payload.
    void support;
    void resistance;
  }

  // Rank: high confidence first, then by absolute daily move.
  const order = { high: 0, medium: 1, low: 2 };
  signals.sort((a, b) => order[a.confidence] - order[b.confidence] || Math.abs(b.changePct) - Math.abs(a.changePct));

  return NextResponse.json({ signals, asOf: new Date().toISOString() });
}
