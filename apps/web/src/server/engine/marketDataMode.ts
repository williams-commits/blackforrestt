export type MarketDataMode =
  | "simulation"
  | "finnhub"
  | "alphavantage"
  | "tickerlayer"
  | "sifting"
  | "lse";
export type FinnhubCandleMode = "auto" | "disabled" | "required";

export function getMarketDataMode(): MarketDataMode {
  const configured = (process.env.MARKET_DATA_MODE ?? "").trim().toLowerCase();
  if (configured === "") return "simulation";
  if (configured === "simulation" || configured === "finnhub" || configured === "alphavantage" || configured === "tickerlayer" || configured === "sifting" || configured === "lse") return configured;
  throw new Error(`Invalid MARKET_DATA_MODE: ${configured}`);
}

/**
 * auto: try Finnhub historical candles once and fall back without log spam.
 * disabled: use simulated history while retaining the optional live WebSocket.
 * required: historical-candle entitlement is a startup requirement.
 */
export function getFinnhubCandleMode(): FinnhubCandleMode {
  const configured = (process.env.FINNHUB_CANDLE_MODE ?? "auto").trim().toLowerCase();
  if (configured === "auto" || configured === "disabled" || configured === "required") return configured;
  throw new Error(`Invalid FINNHUB_CANDLE_MODE: ${configured}`);
}

export function requireFinnhubKey(): string {
  const key = process.env.FINNHUB_API_KEY?.trim();
  if (!key) throw new Error("FINNHUB_API_KEY is required when MARKET_DATA_MODE=finnhub.");
  return key;
}

export function requireAlphavantageKey(): string {
  const key = process.env.ALPHAVANTAGE_API_KEY?.trim();
  if (!key) throw new Error("ALPHAVANTAGE_API_KEY is required when MARKET_DATA_MODE=alphavantage.");
  return key;
}

/** Resolve the API key for any non-simulation provider. */
export function requireFeedKey(mode: MarketDataMode): string {
  if (mode === "finnhub") return requireFinnhubKey();
  if (mode === "alphavantage") return requireAlphavantageKey();
  if (mode === "tickerlayer") {
    const key = process.env.TICKERLAYER_API_KEY?.trim();
    if (!key) throw new Error("TICKERLAYER_API_KEY is required when MARKET_DATA_MODE=tickerlayer.");
    return key;
  }
  if (mode === "sifting") {
    const key = process.env.SIFTING_API_KEY?.trim();
    if (!key) throw new Error("SIFTING_API_KEY is required when MARKET_DATA_MODE=sifting.");
    return key;
  }
  if (mode === "lse") {
    const key = process.env.LSE_API_KEY?.trim();
    if (!key) throw new Error("LSE_API_KEY is required when MARKET_DATA_MODE=lse.");
    return key;
  }
  throw new Error(`No feed key for mode: ${mode}`);
}
