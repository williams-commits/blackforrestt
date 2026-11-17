export const TRADE_SYMBOL_REDIRECTS: Record<string, string> = {
  BTCUSDT: "BTCUSD",
  XRPUSDT: "XRPUSD",
  WTI: "WTIUSD",
  MATICUSD: "POLUSD",
  VIX: "VIXY",
};

export function getTradeSymbolRedirect(symbol: string): string | undefined {
  return TRADE_SYMBOL_REDIRECTS[symbol.toUpperCase()];
}
