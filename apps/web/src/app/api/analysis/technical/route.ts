import { NextResponse } from "next/server";
import { hub } from "@/server/engine/hub";
import type { CandleInterval } from "@/server/engine/types";
import { atr, bias, rsi, sma, supportResistance, type Candle } from "@/lib/indicators";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const INTERVALS: CandleInterval[] = ["1m", "5m", "15m", "1h", "4h", "1d"];

function isInterval(value: string | null): value is CandleInterval {
  return value !== null && (INTERVALS as readonly string[]).includes(value);
}

/**
 * GET /api/analysis/technical?symbol=EURUSD&interval=1h
 * Computes SMA(20/50), RSI(14), ATR(14), support/resistance, and a directional
 * bias from the live market engine's candle history for the instrument.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const symbolParam = url.searchParams.get("symbol")?.trim().toUpperCase() ?? "";
  const intervalParam = url.searchParams.get("interval") ?? "1h";
  const interval: CandleInterval = isInterval(intervalParam) ? intervalParam : "1h";

  if (!symbolParam) {
    return NextResponse.json({ error: "A symbol query parameter is required." }, { status: 400 });
  }
  if (!hub.isReady()) {
    return NextResponse.json({ error: "Market data is still starting. Retry shortly." }, { status: 503 });
  }

  const snapshot = hub.snapshot(symbolParam, interval, null);
  const candles = snapshot.candles as Candle[];
  const quote = snapshot.quote;
  if (candles.length < 20 || !quote) {
    return NextResponse.json({ error: "Not enough price history yet for this instrument." }, { status: 503 });
  }

  const fast = sma(candles, 20);
  const slow = sma(candles, 50);
  const rsiValue = rsi(candles, 14);
  const atrValue = atr(candles, 14);
  const { support, resistance } = supportResistance(candles, 50);
  const directional = bias(fast, slow, rsiValue);
  const price = quote.mid;

  return NextResponse.json({
    symbol: symbolParam,
    interval,
    price,
    changePct: quote.changePct,
    indicators: {
      sma20: fast,
      sma50: slow,
      rsi14: rsiValue,
      atr14: atrValue,
    },
    levels: { support, resistance },
    bias: directional,
    high24h: quote.high24h,
    low24h: quote.low24h,
    asOf: new Date().toISOString(),
  });
}
