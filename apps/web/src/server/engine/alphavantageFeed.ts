/**
 * AlphaVantageFeed — REST-polling price feed (no WebSocket).
 *
 * Alpha Vantage's free tier allows 5 requests/min and 25 requests/day on
 * premium endpoints. To stay within limits, this client polls a small batch of
 * instruments on each cycle (12s interval, 1 request per instrument). Over a
 * full minute ~5 instruments get fresh real prices; the simulator's random
 * walk fills the gaps for the rest.
 *
 * Same PriceCallback contract as the Finnhub FeedClient so the hub is agnostic.
 */
import { avEntryFor } from "./alphavantageMap";
import { getMarketDataMode, requireAlphavantageKey } from "./marketDataMode";

const AV_BASE = "https://www.alphavantage.co/query";
const POLL_INTERVAL_MS = 12_000; // every 12s, poll one symbol
const RATE_LIMIT_BACKOFF_MS = 60_000; // if rate-limited, wait a minute

export type AvPriceCallback = (symbol: string, price: number) => void;

interface AvEntry {
  symbol: string;
  endpoint: "forex" | "crypto" | "stock";
  feedSymbol: string;
  feedQuote?: string;
}

export class AlphaVantageFeed {
  private symbols: AvEntry[] = [];
  private onPrice: AvPriceCallback;
  private pollTimer: NodeJS.Timeout | null = null;
  private currentIndex = 0;
  private rateLimited = false;
  private rateLimitTimer: NodeJS.Timeout | null = null;
  private intentionallyStopped = false;

  constructor(onPrice: AvPriceCallback) {
    this.onPrice = onPrice;
  }

  start(symbols: string[]): void {
    this.symbols = [];
    for (const sym of symbols) {
      const entry = avEntryFor(sym);
      if (entry) {
        this.symbols.push({ symbol: entry.symbol, endpoint: entry.endpoint, feedSymbol: entry.feedSymbol, feedQuote: entry.feedQuote });
      }
    }
    if (getMarketDataMode() === "simulation") {
      console.log("📈 MARKET_DATA_MODE=simulation — Alpha Vantage feed disabled.");
      return;
    }
    requireAlphavantageKey();
    if (this.pollTimer || this.intentionallyStopped) return;
    this.intentionallyStopped = false;
    console.log(`📈 Alpha Vantage feed started — polling ${this.symbols.length} instruments.`);
    // Immediately poll the first symbol, then start the interval.
    void this.pollNext();
    this.pollTimer = setInterval(() => void this.pollNext(), POLL_INTERVAL_MS);
  }

  stop(): void {
    this.intentionallyStopped = true;
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
    if (this.rateLimitTimer) {
      clearTimeout(this.rateLimitTimer);
      this.rateLimitTimer = null;
    }
  }

  private async pollNext(): Promise<void> {
    if (this.intentionallyStopped || this.rateLimited || this.symbols.length === 0) return;
    const apiKey = requireAlphavantageKey();
    const entry = this.symbols[this.currentIndex % this.symbols.length];
    this.currentIndex++;
    try {
      const price = await this.fetchPrice(entry, apiKey);
      if (price != null && Number.isFinite(price) && price > 0) {
        this.onPrice(entry.symbol, price);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (message.includes("429") || message.includes("rate limit") || message.includes("API call frequency")) {
        console.warn("📈 Alpha Vantage rate-limited — backing off for 60s.");
        this.rateLimited = true;
        this.rateLimitTimer = setTimeout(() => {
          this.rateLimited = false;
          this.rateLimitTimer = null;
        }, RATE_LIMIT_BACKOFF_MS);
      } else {
        // Non-rate-limit errors (network, parsing) — log and continue; simulator fills the gap.
        console.warn(`📈 Alpha Vantage poll failed for ${entry.symbol}:`, message);
      }
    }
  }

  private async fetchPrice(entry: AvEntry, apiKey: string): Promise<number | null> {
    const params = new URLSearchParams({ apikey: apiKey });
    if (entry.endpoint === "forex") {
      const [from, to] = entry.feedSymbol.split("/");
      params.set("function", "CURRENCY_EXCHANGE_RATE");
      params.set("from_currency", from);
      params.set("to_currency", to);
    } else if (entry.endpoint === "crypto") {
      params.set("function", "CURRENCY_EXCHANGE_RATE");
      params.set("from_currency", entry.feedSymbol);
      params.set("to_currency", entry.feedQuote ?? "USD");
    } else {
      params.set("function", "GLOBAL_QUOTE");
      params.set("symbol", entry.feedSymbol);
    }
    const url = `${AV_BASE}?${params.toString()}`;
    const response = await fetch(url, { signal: AbortSignal.timeout(10_000), cache: "no-store" });
    if (response.status === 429) throw new Error("429 rate limit");
    if (!response.ok) throw new Error(`AV returned ${response.status}`);
    const body = await response.json() as Record<string, unknown>;
    // CURRENCY_EXCHANGE_RATE response
    const cer = body["Realtime Currency Exchange Rate"] as Record<string, string> | undefined;
    if (cer && cer["5. Exchange Rate"]) {
      return Number(cer["5. Exchange Rate"]);
    }
    // GLOBAL_QUOTE response
    const gq = body["Global Quote"] as Record<string, string> | undefined;
    if (gq && gq["05. price"]) {
      return Number(gq["05. price"]);
    }
    // Note or Information messages (rate limit, demo key)
    if (body["Note"]) throw new Error(String(body["Note"]));
    if (body["Information"]) throw new Error(String(body["Information"]));
    return null;
  }
}

/** Process-level singleton — one Alpha Vantage feed per app instance. */
let _avFeed: AlphaVantageFeed | null = null;

export function getAlphavantageFeed(onPrice: AvPriceCallback): AlphaVantageFeed {
  if (!_avFeed) {
    _avFeed = new AlphaVantageFeed(onPrice);
  }
  return _avFeed;
}
