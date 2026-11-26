export interface CurrencyPairRate {
  base: string;
  quote: string;
  mid: number;
}

export function currencyConversionRate(
  fromCurrency: string,
  toCurrency: string,
  pairs: readonly CurrencyPairRate[],
): number | null {
  const from = fromCurrency.trim().toUpperCase();
  const to = toCurrency.trim().toUpperCase();
  if (!from || !to) return null;
  if (from === to) return 1;

  const graph = new Map<string, { currency: string; rate: number }[]>();
  const addEdge = (source: string, currency: string, rate: number) => {
    const edges = graph.get(source) ?? [];
    edges.push({ currency, rate });
    graph.set(source, edges);
  };

  for (const pair of pairs) {
    const base = pair.base.trim().toUpperCase();
    const quote = pair.quote.trim().toUpperCase();
    if (!base || !quote || base === quote || !Number.isFinite(pair.mid) || pair.mid <= 0) continue;
    addEdge(base, quote, pair.mid);
    const inverse = 1 / pair.mid;
    if (Number.isFinite(inverse) && inverse > 0) addEdge(quote, base, inverse);
  }

  const visited = new Set([from]);
  const queue: { currency: string; rate: number }[] = [{ currency: from, rate: 1 }];
  for (let index = 0; index < queue.length; index += 1) {
    const current = queue[index];
    for (const edge of graph.get(current.currency) ?? []) {
      if (visited.has(edge.currency)) continue;
      const rate = current.rate * edge.rate;
      if (!Number.isFinite(rate) || rate <= 0) continue;
      if (edge.currency === to) return rate;
      visited.add(edge.currency);
      queue.push({ currency: edge.currency, rate });
    }
  }
  return null;
}
