/**
 * FeedClient — connects to the Finnhub WebSocket trade stream and pushes live
 * prices into the trading hub.
 *
 * Lifecycle:
 *   1. start(symbols) — opens wss://ws.finnhub.io?token=KEY and subscribes to
 *      every instrument's feed symbol.
 *   2. On each "trade" message, resolves the feed symbol back to our instrument
 *      symbol and calls onPrice(symbol, price).
 *   3. On close/error, reconnects with exponential backoff (up to 30s).
 *   4. Live input is used only when MARKET_DATA_MODE=finnhub. A credential by
 *      itself never changes simulation behavior.
 *
 * The Finnhub WS only sends trade prices (last price), not bid/ask. The hub's
 * simulator adds a dealing spread around the mid for quoting/fills.
 */
import WebSocket from "ws";
import { feedSymbolFor, symbolFromFeed } from "./symbolMap";
import { getMarketDataMode, requireFinnhubKey } from "./marketDataMode";

const FINNHUB_WS_URL = "wss://ws.finnhub.io";

interface FinnhubTrade {
  s: string; // feed symbol
  p: number; // last price
  t: number; // timestamp (ms)
  v: number; // volume
}

interface FinnhubTradeMessage {
  type: "trade";
  data: FinnhubTrade[];
}

export type PriceCallback = (symbol: string, price: number) => void;

export class FeedClient {
  private ws: WebSocket | null = null;
  private symbols: string[] = [];
  private onPrice: PriceCallback;
  private reconnectAttempts = 0;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private isStarting = false;
  private intentionallyClosed = false;
  private readonly lastTimestampBySymbol = new Map<string, number>();

  constructor(onPrice: PriceCallback) {
    this.onPrice = onPrice;
  }

  /** Subscribe to live prices for the given instrument symbols. No-op if no API key. */
  start(symbols: string[]): void {
    this.symbols = symbols;
    if (getMarketDataMode() === "simulation") {
      console.log("📡 MARKET_DATA_MODE=simulation — external trade feed disabled.");
      return;
    }
    requireFinnhubKey();
    if (this.isStarting || (this.ws && this.ws.readyState <= WebSocket.OPEN)) return;
    this.intentionallyClosed = false;
    this.isStarting = true;
    this.connect();
  }

  /** Gracefully stop and clean up. */
  stop(): void {
    this.intentionallyClosed = true;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.removeAllListeners();
      if (this.ws.readyState === WebSocket.OPEN) this.ws.close();
      this.ws = null;
    }
  }

  private connect(): void {
    const url = `${FINNHUB_WS_URL}?token=${requireFinnhubKey()}`;
    console.log("📡 Connecting to Finnhub WebSocket…");

    const ws = new WebSocket(url);
    this.ws = ws;

    ws.on("open", () => {
      this.isStarting = false;
      this.reconnectAttempts = 0;
      console.log("📡 Finnhub WS connected — subscribing to instruments…");

      // Subscribe to every instrument's feed symbol.
      let subscribed = 0;
      for (const symbol of this.symbols) {
        const feedSymbol = feedSymbolFor(symbol);
        if (!feedSymbol) continue;
        ws.send(JSON.stringify({ type: "subscribe", symbol: feedSymbol }));
        subscribed++;
      }
      console.log(`📡 Subscribed to ${subscribed} Finnhub symbols.`);
    });

    ws.on("message", (raw: WebSocket.RawData) => {
      try {
        const msg = JSON.parse(raw.toString()) as FinnhubTradeMessage;
        if (msg.type !== "trade" || !Array.isArray(msg.data)) return;

        // Use the newest valid trade per symbol. WebSocket batches are not
        // guaranteed to be sorted and stale trades must not move the market
        // backwards after a reconnect.
        const latestBySymbol = new Map<string, { price: number; timestamp: number }>();
        for (const trade of msg.data) {
          const ourSymbol = symbolFromFeed(trade.s);
          if (!ourSymbol || !Number.isFinite(trade.p) || trade.p <= 0 || !Number.isFinite(trade.t)) continue;
          const current = latestBySymbol.get(ourSymbol);
          if (!current || trade.t > current.timestamp) {
            latestBySymbol.set(ourSymbol, { price: trade.p, timestamp: trade.t });
          }
        }
        for (const [symbol, trade] of latestBySymbol) {
          const previousTimestamp = this.lastTimestampBySymbol.get(symbol) ?? 0;
          if (trade.timestamp < previousTimestamp) continue;
          this.lastTimestampBySymbol.set(symbol, trade.timestamp);
          this.onPrice(symbol, trade.price);
        }
      } catch {
        // Non-JSON or unexpected format — ignore.
      }
    });

    ws.on("error", (err: Error) => {
      console.warn(`📡 Finnhub WS error: ${err.message}`);
      // "close" will fire next and trigger reconnect.
    });

    ws.on("close", (code: number, reason: Buffer) => {
      this.ws = null;
      this.isStarting = false;
      if (this.intentionallyClosed) return;
      console.warn(`📡 Finnhub WS closed (code ${code}: ${reason.toString()}) — reconnecting…`);
      this.scheduleReconnect();
    });
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) return;
    this.reconnectAttempts++;
    // Exponential backoff: 1s, 2s, 4s, 8s, … capped at 30s.
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts - 1), 30_000);
    console.log(`📡 Reconnecting in ${(delay / 1000).toFixed(0)}s (attempt ${this.reconnectAttempts})…`);
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      if (!this.intentionallyClosed) this.connect();
    }, delay);
  }
}

/** Process-level singleton — one Finnhub connection per app instance. */
let _feedClient: FeedClient | null = null;

export function getFeedClient(onPrice: PriceCallback): FeedClient {
  if (!_feedClient) {
    _feedClient = new FeedClient(onPrice);
  }
  return _feedClient;
}
