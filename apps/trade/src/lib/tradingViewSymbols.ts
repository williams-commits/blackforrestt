import type { CandleInterval, InstrumentCategory } from "./types";

const TRADINGVIEW_INTERVALS: Record<CandleInterval, string> = {
  "1m": "1",
  "5m": "5",
  "15m": "15",
  "1h": "60",
  "4h": "240",
  "1d": "D",
};

export function tradingViewIntervalFor(interval: CandleInterval): string {
  return TRADINGVIEW_INTERVALS[interval];
}

const SYMBOL_OVERRIDES: Record<string, string> = {
  US30: "OANDA:US30USD",
  NAS100: "OANDA:NAS100USD",
  SPX500: "OANDA:SPX500USD",
  GER40: "OANDA:DE30EUR",
  UK100: "OANDA:UK100GBP",
  FRA40: "EURONEXT:PX1",
  JPN225: "OANDA:JP225USD",
  VIXY: "CBOE:VIXY",
  WTIUSD: "TVC:USOIL",
  XBRUSD: "TVC:UKOIL",
  NGUSD: "OANDA:NATGASUSD",
  HGUSD: "OANDA:XCUUSD",
  POLUSD: "BINANCE:POLUSDT",
  CORNUSD: "AMEX:CORN",
  WEATUSD: "AMEX:WEAT",
  SOYBUSD: "AMEX:SOYB",
  JPM: "NYSE:JPM",
};

export function tradingViewSymbolFor(
  symbol: string,
  category: InstrumentCategory,
): string | null {
  const normalized = symbol.toUpperCase();
  const override = SYMBOL_OVERRIDES[normalized];
  if (override) return override;

  if (category === "FOREX" && /^[A-Z]{6}$/.test(normalized)) {
    return `OANDA:${normalized}`;
  }
  if (category === "COMMODITY" && /^(XAU|XAG|XPT|XPD)USD$/.test(normalized)) {
    return `OANDA:${normalized}`;
  }
  if (category === "CRYPTO" && /^[A-Z0-9]+USD$/.test(normalized)) {
    const asset = normalized.slice(0, -3);
    return `BINANCE:${asset}USDT`;
  }
  if (category === "STOCK" && /^[A-Z.]+$/.test(normalized)) {
    return `NASDAQ:${normalized}`;
  }

  return null;
}
