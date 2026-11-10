/**
 * Real instrument imagery — the shared symbol → asset map.
 *
 * Assets live under public/brands/gbfxs/markets/ (currency flags from
 * flagcdn, crypto coins, exchange/index marks, stock logos, and authored
 * emblems for unbranded commodities). Both ends consume this one map: the
 * shared InstrumentIcon (terminal, account portal, primary-brand landing)
 * and the gbfxs landing's InstrumentLogo. Anything unmapped falls back to
 * the inline SVG badges, so no instrument ever renders an empty slot.
 */

export const ASSET_DIR = "/brands/gbfxs/markets/";

/** ISO currency → round-cropped flag asset. */
export const CURRENCY_FLAGS: Record<string, string> = {
  USD: "us.png",
  EUR: "eu.png",
  GBP: "gb.png",
  JPY: "jp.png",
  AUD: "au.png",
  CAD: "ca.png",
  NZD: "nz.png",
  CHF: "ch.png",
};

/** Symbol → real logo / emblem asset. */
export const INSTRUMENT_IMAGES: Record<string, string> = {
  // Crypto
  BTCUSD: "btc.svg",
  ETHUSD: "eth.svg",
  SOLUSD: "solana.svg",
  XRPUSD: "xrp.png",
  ADAUSD: "ada.png",
  DOGEUSD: "doge.png",
  LINKUSD: "link.png",
  AVAXUSD: "avax.png",
  MATICUSD: "matic.png",
  POLUSD: "polygon.svg",
  LTCUSD: "litecoin.svg",
  BCHUSD: "bitcoincash.svg",
  DOTUSD: "polkadot.svg",
  UNIUSD: "uniswap.svg",
  ATOMUSD: "cosmos.svg",
  // Commodities
  XAUUSD: "xau.svg",
  XAGUSD: "xag.svg",
  WTIUSD: "wti.svg",
  XBRUSD: "xbr.svg",
  XPTUSD: "xpt.svg",
  XPDUSD: "xpd.svg",
  NGUSD: "ng.svg",
  HGUSD: "hg.svg",
  // Indices (exchange marks; country flags where no mark exists)
  US30: "us30.svg",
  NAS100: "nas100.svg",
  SPX500: "spx500.svg",
  GER40: "de.png",
  UK100: "gb.png",
  FRA40: "fr.png",
  JPN225: "nikkei225.svg",
  VIX: "vix.svg",
  VIXY: "vixy.svg",
  // Stocks
  AAPL: "apple.svg",
  MSFT: "microsoft.svg",
  NVDA: "nvidia.svg",
  TSLA: "tesla.svg",
  AMZN: "amazon.svg",
  GOOGL: "google.svg",
  META: "meta.svg",
  AMD: "amd.svg",
  JPM: "jpm.svg",
  CORNUSD: "corn.svg",
  WEATUSD: "weat.svg",
  SOYBUSD: "soyb.svg",
};

/** Asset for a symbol (uppercase), or null when unmapped. */
export function instrumentImage(symbol: string): string | null {
  return INSTRUMENT_IMAGES[symbol.toUpperCase()] ?? null;
}

/** Flag asset for an ISO currency code, or null when unmapped. */
export function currencyFlag(iso: string): string | null {
  return CURRENCY_FLAGS[iso.toUpperCase()] ?? null;
}
