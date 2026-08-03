/**
 * Generic REST-polling price feed for providers that use a simple REST quote
 * endpoint (TickerLayer, Sifting, London Strategic Edge). Each provider maps
 * our internal symbol to its own convention and exposes a quote endpoint that
 * returns a numeric last-price.
 *
 * Same PriceCallback contract as the Finnhub FeedClient and AlphaVantageFeed.
 * Polls one instrument per cycle, cycling through all instruments. The
 * simulator fills gaps for instruments that haven't been polled recently.
 */
import { getMarketDataMode, requireFeedKey, type MarketDataMode } from "./marketDataMode";
import type { InstrumentCategory } from "./types";

export type PriceCallback = (symbol: string, price: number) => void;

const POLL_INTERVAL_MS = 12_000;
const RATE_LIMIT_BACKOFF_MS = 60_000;
const TIMEOUT_MS = 10_000;

// ── Provider config ─────────────────────────────────────────────────────────

interface ProviderConfig {
  baseUrl: string;
  /** Build the full quote URL for a symbol, or null if the provider can't serve it. */
  buildQuoteUrl: (symbol: string) => string | null;
  /** Extract the numeric price from the response JSON. */
  extractPrice: (body: unknown) => number | null;
}

/** Translate our symbol to the provider's convention. Returns the ticker the provider expects. */
function translateSymbol(symbol: string, mode: MarketDataMode): { ticker: string; endpoint: string } | null {
  // All three providers accept standard tickers for stocks/ETFs/crypto.
  // For forex, the convention varies; we do best-effort mapping.
  const cat = inferCategory(symbol);
  if (mode === "tickerlayer") {
    if (cat === "FOREX" || cat === "COMMODITY") {
      // TickerLayer: /forex/quote/{symbol} with OANDA-style or standard pairs
      const pair = forexToPair(symbol);
      return pair ? { ticker: pair, endpoint: "forex" } : null;
    }
    if (cat === "CRYPTO") return { ticker: symbol, endpoint: "crypto" };
    return { ticker: etfProxy(symbol), endpoint: "stock" };
  }
  if (mode === "sifting") {
    if (cat === "FOREX" || cat === "COMMODITY") {
      const pair = forexToPair(symbol);
      return pair ? { ticker: pair, endpoint: "forex" } : null;
    }
    if (cat === "CRYPTO") return { ticker: symbol, endpoint: "crypto" };
    return { ticker: etfProxy(symbol), endpoint: "stock" };
  }
  if (mode === "lse") {
    if (cat === "FOREX" || cat === "COMMODITY") {
      const pair = forexToPair(symbol);
      return pair ? { ticker: pair, endpoint: "fx" } : null;
    }
    if (cat === "CRYPTO") return { ticker: symbol, endpoint: "crypto" };
    return { ticker: etfProxy(symbol), endpoint: "equity" };
  }
  return null;
}

const PROVIDERS: Record<string, ProviderConfig> = {
  tickerlayer: {
    baseUrl: "https://api.tickerlayer.com",
    buildQuoteUrl: (symbol) => {
      const translated = translateSymbol(symbol, "tickerlayer");
      if (!translated) return null;
      return `https://api.tickerlayer.com/${translated.endpoint}/quote/${encodeURIComponent(translated.ticker)}`;
    },
    extractPrice: (body) => {
      const b = body as Record<string, unknown>;
      const price = b["price"] ?? b["last_price"] ?? b["bid"];
      return typeof price === "number" ? price : price != null ? Number(price) : null;
    },
  },
  sifting: {
    baseUrl: "https://api.sifting.io/v1",
    buildQuoteUrl: (symbol) => {
      const translated = translateSymbol(symbol, "sifting");
      if (!translated) return null;
      return `https://api.sifting.io/v1/last/quote/${translated.endpoint}/${encodeURIComponent(translated.ticker)}`;
    },
    extractPrice: (body) => {
      const b = body as Record<string, unknown>;
      // Sifting returns { bid, ask, ... } or { last_price, ... }
      const bid = b["bid"];
      const ask = b["ask"];
      if (typeof bid === "number" && typeof ask === "number") return (bid + ask) / 2;
      const price = b["last_price"] ?? b["price"] ?? b["p"];
      return typeof price === "number" ? price : price != null ? Number(price) : null;
    },
  },
  lse: {
    baseUrl: "https://api.londonstrategicedge.com/vault",
    buildQuoteUrl: (symbol) => {
      const translated = translateSymbol(symbol, "lse");
      if (!translated) return null;
      return `https://api.londonstrategicedge.com/vault/${translated.endpoint}/quote?symbol=${encodeURIComponent(translated.ticker)}`;
    },
    extractPrice: (body) => {
      const b = body as Record<string, unknown>;
      const price = b["price"] ?? b["last"] ?? b["close"] ?? b["bid"];
      return typeof price === "number" ? price : price != null ? Number(price) : null;
    },
  },
};

// ── Symbol helpers ─────────────────────────────────────────────────────────

function inferCategory(symbol: string): InstrumentCategory {
  if (/^(BTC|ETH|SOL|XRP|ADA|DOGE|LINK|AVAX|MATIC)USD$/.test(symbol)) return "CRYPTO";
  if (/^(AAPL|MSFT|NVDA|TSLA)$/.test(symbol)) return "STOCK";
  if (/^(US30|NAS100|SPX500|GER40|UK100|FRA40|JPN225|VIX)$/.test(symbol)) return "INDEX";
  if (/^(XAU|XAG|WTI|XBR|XPT|XPD|NG|HG)USD$/.test(symbol)) return "COMMODITY";
  return "FOREX";
}

/** Map our forex/commodity symbol to a slash pair (e.g. EURUSD → EUR/USD). */
function forexToPair(symbol: string): string | null {
  if (symbol.length !== 6) return null;
  return `${symbol.slice(0, 3)}/${symbol.slice(3)}`;
}

/** Map our commodity/index symbol to an ETF proxy ticker for stock endpoints. */
function etfProxy(symbol: string): string {
  const map: Record<string, string> = {
    US30: "DIA", NAS100: "QQQ", SPX500: "SPY", GER40: "EWG", UK100: "EWU",
    FRA40: "EWQ", JPN225: "EWJ", VIX: "VIXY",
    WTIUSD: "USO", XBRUSD: "BNO", XPTUSD: "PLT", XPDUSD: "PALL",
    NGUSD: "UNG", HGUSD: "CPER",
    XAUUSD: "GLD", XAGUSD: "SLV",
    AAPL: "AAPL", MSFT: "MSFT", NVDA: "NVDA", TSLA: "TSLA",
  };
  return map[symbol] ?? symbol;
}

// ── Feed client ─────────────────────────────────────────────────────────────

export class GenericFeed {
  private symbols: string[] = [];
  private categories: InstrumentCategory[] = [];
  private onPrice: PriceCallback;
  private pollTimer: NodeJS.Timeout | null = null;
  private currentIndex = 0;
  private rateLimited = false;
  private rateLimitTimer: NodeJS.Timeout | null = null;
  private intentionallyStopped = false;
  private mode: MarketDataMode;
  private provider: ProviderConfig | null;

  constructor(onPrice: PriceCallback) {
    this.onPrice = onPrice;
    this.mode = getMarketDataMode();
    this.provider = PROVIDERS[this.mode] ?? null;
  }

  start(symbols: string[]): void {
    this.symbols = symbols;
    this.categories = symbols.map(inferCategory);
    if (this.mode === "simulation" || !this.provider) {
      console.log(`📊 MARKET_DATA_MODE=${this.mode} — no REST polling provider active.`);
      return;
    }
    if (this.pollTimer || this.intentionallyStopped) return;
    this.intentionallyStopped = false;
    console.log(`📊 ${this.mode} feed started — polling ${symbols.length} instruments.`);
    void this.pollNext();
    this.pollTimer = setInterval(() => void this.pollNext(), POLL_INTERVAL_MS);
  }

  stop(): void {
    this.intentionallyStopped = true;
    if (this.pollTimer) { clearInterval(this.pollTimer); this.pollTimer = null; }
    if (this.rateLimitTimer) { clearTimeout(this.rateLimitTimer); this.rateLimitTimer = null; }
  }

  private async pollNext(): Promise<void> {
    if (this.intentionallyStopped || this.rateLimited || this.symbols.length === 0 || !this.provider) return;
    const apiKey = requireFeedKey(this.mode);
    const symbol = this.symbols[this.currentIndex % this.symbols.length];
    this.currentIndex++;
    try {
      const url = this.provider.buildQuoteUrl(symbol);
      if (!url) return;
      const headers: Record<string, string> = {};
      if (this.mode === "tickerlayer") headers["x-api-key"] = apiKey;
      else if (this.mode === "sifting") headers["X-API-Key"] = apiKey;
      else if (this.mode === "lse") headers["Authorization"] = `Bearer ${apiKey}`;
      const response = await fetch(url, { headers, signal: AbortSignal.timeout(TIMEOUT_MS), cache: "no-store" });
      if (response.status === 429) throw new Error("429 rate limit");
      if (!response.ok) throw new Error(`${this.mode} returned ${response.status}`);
      const body = await response.json();
      const price = this.provider.extractPrice(body);
      if (price != null && Number.isFinite(price) && price > 0) {
        this.onPrice(symbol, price);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (message.includes("429") || message.includes("rate limit")) {
        console.warn(`📊 ${this.mode} rate-limited — backing off for 60s.`);
        this.rateLimited = true;
        this.rateLimitTimer = setTimeout(() => { this.rateLimited = false; this.rateLimitTimer = null; }, RATE_LIMIT_BACKOFF_MS);
      } else {
        console.warn(`📊 ${this.mode} poll failed for ${symbol}:`, message);
      }
    }
  }
}

// ── Singleton ──────────────────────────────────────────────────────────────

let _genericFeed: GenericFeed | null = null;

export function getGenericFeed(onPrice: PriceCallback): GenericFeed {
  if (!_genericFeed) {
    _genericFeed = new GenericFeed(onPrice);
  }
  return _genericFeed;
}
