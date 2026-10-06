"use client";

/**
 * Forex store — live market + account state, fed by the WebSocket.
 *
 * Market fields (quote/candles/instruments) are global to the symbol; account
 * fields (positions/metrics) are per-user but we only have the dev user, so a
 * single store is simplest.
 */
import { create } from "zustand";
import type {
  AccountMetricsView,
  Candle,
  CandleInterval,
  InstrumentView,
  PositionView,
  Quote,
} from "@/lib/types";

const MAX_CANDLES = 500;

interface ForexState {
  symbol: string | null;
  interval: CandleInterval;
  quote: Quote | null;
  candles: Candle[];
  instruments: InstrumentView[];
  account: AccountMetricsView | null;
  positions: PositionView[];

  setMarket: (symbol: string, interval: CandleInterval) => void;
  applySnapshot: (snapshot: {
    symbol: string;
    interval: CandleInterval;
    candles: Candle[];
    quote: Quote | null;
    instruments: InstrumentView[];
    positions: PositionView[];
    account: AccountMetricsView | null;
  }) => void;
  applyQuote: (quote: Quote) => void;
  applyCandle: (candle: Candle) => void;
  applyInstruments: (instruments: InstrumentView[]) => void;
  applyAccount: (account: AccountMetricsView) => void;
  applyPosition: (position: PositionView) => void;
  setInterval: (interval: CandleInterval) => void;
  setPositions: (positions: PositionView[]) => void;
}

export const useForexStore = create<ForexState>((set) => ({
  symbol: null,
  interval: "5m",
  quote: null,
  candles: [],
  instruments: [],
  account: null,
  positions: [],

  setMarket: (symbol, interval) => set({ symbol, interval, candles: [], quote: null }),

  applySnapshot: (snapshot) =>
    set((state) => {
      // A delayed snapshot from a previous subscription must not replace the
      // newly selected chart.
      if (snapshot.symbol !== state.symbol || snapshot.interval !== state.interval) return state;
      return {
        candles: snapshot.candles.slice(-MAX_CANDLES),
        quote: snapshot.quote,
        instruments: snapshot.instruments.length ? snapshot.instruments : state.instruments,
        positions: snapshot.positions,
        account: snapshot.account ?? state.account,
      };
    }),

  applyQuote: (quote) =>
    set((state) => ({
      quote: state.symbol === quote.symbol ? quote : state.quote,
      instruments: state.instruments.map((instrument) =>
        instrument.symbol === quote.symbol
          ? {
              ...instrument,
              bid: quote.bid,
              ask: quote.ask,
              mid: quote.mid,
              changePct: quote.changePct,
            }
          : instrument,
      ),
    })),

  applyCandle: (candle) =>
    set((state) => {
      const candles = state.candles;
      const last = candles[candles.length - 1];
      if (last && last.time === candle.time) {
        const next = candles.slice();
        next[next.length - 1] = candle;
        return { candles: next };
      }
      return {
        candles:
          candles.length >= MAX_CANDLES
            ? [...candles.slice(-(MAX_CANDLES - 1)), candle]
            : [...candles, candle],
      };
    }),

  applyInstruments: (instruments) =>
    set((state) => {
      // If the currently-selected symbol's instrument is in the list, derive
      // a fresh quote from its live bid/ask so the banner and trade panel
      // stay in sync even when per-symbol WS quote messages aren't arriving.
      const current = instruments.find((i) => i.symbol === state.symbol);
      if (current) {
        return {
          instruments,
          quote: {
            symbol: current.symbol,
            bid: current.bid,
            ask: current.ask,
            mid: current.mid,
            time: Date.now(),
            open24h: state.quote?.open24h ?? current.mid,
            high24h: state.quote?.high24h ?? current.mid,
            low24h: state.quote?.low24h ?? current.mid,
            changePct: current.changePct,
          },
        };
      }
      return { instruments };
    }),

  applyAccount: (account) => set({ account }),

  applyPosition: (position) =>
    set((state) => {
      if (position.status === "CLOSED") {
        return { positions: state.positions.filter((p) => p.id !== position.id) };
      }
      const idx = state.positions.findIndex((p) => p.id === position.id);
      if (idx >= 0) {
        const next = state.positions.slice();
        next[idx] = position;
        return { positions: next };
      }
      return { positions: [position, ...state.positions] };
    }),

  setInterval: (interval) => set({ interval, candles: [] }),
  setPositions: (positions) => set({ positions }),
}));
