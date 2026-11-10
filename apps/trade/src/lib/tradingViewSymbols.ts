import type { InstrumentCategory } from "./types";

const SYMBOL_OVERRIDES: Record<string, string> = {
  US30: "TVC:DJI",
  NAS100: "NASDAQ:NDX",
  SPX500: "SP:SPX",
  GER40: "XETR:DAX",
  UK100: "TVC:UKX",
  FRA40: "EURONEXT:PX1",
  JPN225: "TVC:NI225",
  VIX: "CBOE:VIX",
  WTIUSD: "TVC:USOIL",
  XBRUSD: "TVC:UKOIL",
  NGUSD: "TVC:NATGAS",
  HGUSD: "TVC:COPPER",
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
