import { AV_SYMBOL_MAP } from "../src/server/engine/alphavantageMap.js";
import { FEED_SYMBOL_MAP } from "../src/server/engine/symbolMap.js";
import { translateSymbol } from "../src/server/engine/genericFeed.js";
import { tradingViewSymbolFor } from "../src/lib/tradingViewSymbols.js";

async function main(): Promise<void> {
  const instruments = Object.values(FEED_SYMBOL_MAP);
  const failures: string[] = [];
  let nextIndex = 0;
  const genericModes = ["tickerlayer", "sifting", "lse"] as const;

  async function verifyNext(): Promise<void> {
    while (nextIndex < instruments.length) {
      const instrument = instruments[nextIndex++];
      if (!instrument) return;
      const symbol = tradingViewSymbolFor(instrument.symbol, instrument.category);
      if (!symbol) {
        failures.push(`${instrument.symbol}: no TradingView symbol is configured`);
        continue;
      }

      const [exchange, ticker] = symbol.split(":");
      if (!exchange || !ticker) {
        failures.push(`${instrument.symbol}: invalid TradingView symbol "${symbol}"`);
        continue;
      }

      if (!AV_SYMBOL_MAP[instrument.symbol]) {
        failures.push(`${instrument.symbol}: no Alpha Vantage symbol is configured`);
        console.error(`[FAIL] ${instrument.symbol}: no Alpha Vantage symbol is configured`);
      }
      for (const mode of genericModes) {
        if (!translateSymbol(instrument.symbol, mode)) {
          failures.push(`${instrument.symbol}: no ${mode} symbol is configured`);
          console.error(`[FAIL] ${instrument.symbol}: no ${mode} symbol is configured`);
        }
      }

      const tickerPath = ticker.replaceAll("!", "%21");
      const url = `https://www.tradingview.com/symbols/${exchange}-${tickerPath}/`;

      try {
        const response = await fetch(url, {
          headers: { "User-Agent": "Mozilla/5.0" },
          signal: AbortSignal.timeout(15_000),
        });
        if (!response.ok) {
          failures.push(`${instrument.symbol}: ${symbol} returned HTTP ${response.status}`);
          console.error(`[FAIL] ${instrument.symbol} -> ${symbol} (HTTP ${response.status})`);
          continue;
        }

        const page = await response.text();
        if (!page.includes(symbol)) {
          failures.push(`${instrument.symbol}: page did not confirm exact TradingView symbol ${symbol}`);
          console.error(`[FAIL] ${instrument.symbol} -> ${symbol} (exact symbol not confirmed)`);
          continue;
        }
        console.log(`[OK] ${instrument.symbol} -> ${symbol} (HTTP ${response.status})`);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        failures.push(`${instrument.symbol}: ${symbol} request failed: ${message}`);
        console.error(`[FAIL] ${instrument.symbol} -> ${symbol} (${message})`);
      }
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(5, instruments.length) }, () => verifyNext()),
  );

  if (failures.length > 0) {
    console.error(`\n${failures.length} of ${instruments.length} TradingView symbols failed verification.`);
    process.exitCode = 1;
  } else {
    console.log(`\nAll ${instruments.length} configured TradingView symbols are available.`);
  }
}

void main().catch((error: unknown) => {
  console.error("TradingView symbol verification failed:", error);
  process.exitCode = 1;
});
