export const TRADE_SYMBOL_REDIRECTS: Record<string, string> = {
  BTCUSDT: "BTCUSD",
  MATICUSD: "POLUSD",
  VIX: "VIXY",
};

export function getTradeSymbolRedirect(symbol: string): string | undefined {
  return TRADE_SYMBOL_REDIRECTS[symbol.toUpperCase()];
}
