import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { resolveUserId } from "@/server/db";
import { fetchCandles } from "@/server/engine/candleFetcher";
import { getMarketDataMode } from "@/server/engine/marketDataMode";
import { INTERVAL_SECONDS, type CandleInterval } from "@/server/engine/types";
import { consumeRateLimit, RateLimitedError } from "@/server/security/rateLimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const QuerySchema = z.object({
  symbol: z.string().trim().min(1).max(32).regex(/^[A-Za-z0-9._-]+$/).transform((value) => value.toUpperCase()),
  interval: z.enum(["1m", "5m", "15m", "1h", "4h", "1d"]),
  before: z.coerce.number().int().positive(),
  limit: z.coerce.number().int().min(1).max(2_000).default(1_000),
});

const HISTORY_WINDOW_SECONDS = 180 * 24 * 60 * 60;

/** GET /api/market/history — bounded, provider-backed older candle pages. */
export async function GET(req: Request) {
  const parsed = QuerySchema.safeParse(Object.fromEntries(new URL(req.url).searchParams));
  if (!parsed.success) {
    return NextResponse.json({ error: "Provide a valid symbol, interval, and candle cursor." }, { status: 400 });
  }

  const session = await auth();
  let userId: string;
  try {
    userId = await resolveUserId(session?.user?.id);
  } catch {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    await consumeRateLimit({
      scope: "market-history",
      identifier: userId,
      limit: 20,
      windowSeconds: 60,
    });
  } catch (error) {
    if (error instanceof RateLimitedError) {
      return NextResponse.json(
        { error: error.message },
        { status: 429, headers: { "Retry-After": String(error.retryAfterSeconds) } },
      );
    }
    console.error("Market history rate limit unavailable:", error);
    return NextResponse.json({ error: "Historical data is temporarily unavailable." }, { status: 503 });
  }

  if (getMarketDataMode() !== "finnhub") {
    return NextResponse.json({
      candles: [],
      historyAvailable: false,
      hasMore: false,
      message: "The configured market-data provider does not support older-candle retrieval.",
    });
  }

  const { symbol, interval, before, limit } = parsed.data;
  const now = Math.floor(Date.now() / 1000);
  const windowStart = now - HISTORY_WINDOW_SECONDS;
  const effectiveBefore = Math.min(before, now);
  const pageLimit = Math.min(limit, Math.ceil((effectiveBefore - windowStart) / INTERVAL_SECONDS[interval]));
  if (pageLimit <= 0) {
    return NextResponse.json({ candles: [], historyAvailable: true, hasMore: false, windowStart });
  }

  try {
    const fetched = await fetchCandles(symbol, interval as CandleInterval, pageLimit, effectiveBefore);
    if (!fetched) {
      return NextResponse.json({
        candles: [],
        historyAvailable: false,
        hasMore: false,
        message: "The configured market-data feed did not provide additional candles.",
      });
    }
    const candles = fetched.filter((candle) => candle.time >= windowStart && candle.time < effectiveBefore);
    return NextResponse.json({
      candles,
      historyAvailable: true,
      hasMore: candles.length > 0 && candles[0]!.time > windowStart,
      windowStart,
    });
  } catch (error) {
    console.error(`Historical candle fetch failed for ${symbol} ${interval}:`, error);
    return NextResponse.json({ error: "Historical candles could not be loaded from the market-data provider." }, { status: 503 });
  }
}
