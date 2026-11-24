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
  BNBUSD: "bnb.png",
  TRXUSD: "trx.png",
  TONUSD: "ton.png",
  SHIBUSD: "shib.png",
  XLMUSD: "xlm.jpg",
  ETCUSD: "etc.png",
  FILUSD: "fil.png",
  ICPUSD: "icp.png",
  NEARUSD: "near.jpg",
  APTUSD: "apt.png",
  SUIUSD: "sui.png",
  AAVEUSD: "aave.png",
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
  US2000: "us2000.png",
  VIXY: "vixy.svg",
  VIX: "vix.png",
  WHEATUSD: "wheat.png",
  SUGARUSD: "sugar.png",
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
  ANT: "ant.png",
  AI: "ai.png",
  PLTR: "pltr.png",
  SOUN: "soun.png",
  BBAI: "bbai.png",
  PATH: "path.jpg",
  NBIS: "nbis.png",
  CRWV: "crwv.png",
  TEM: "tem.png",
  AVGO: "avgo.png",
  ARM: "arm.png",
  TSM: "tsm.png",
  MU: "mu.png",
  MRVL: "mrvl.png",
  QCOM: "qcom.png",
  ASML: "asml.png",
  AMAT: "amat.png",
  LRCX: "lrcx.png",
  SMCI: "smci.png",
  DELL: "dell.png",
  HPE: "hpe.png",
  VRT: "vrt.png",
  ANET: "anet.png",
  SNPS: "snps.png",
  CDNS: "cdns.png",
  IBM: "ibm.png",
  INTC: "intc.png",
  ORCL: "orcl.png",
  CRM: "crm.png",
  NOW: "now.png",
  SNOW: "snow.png",
  ADBE: "adbe.png",
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
