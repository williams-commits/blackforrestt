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
  CandleHistoryStatus,
  CandleInterval,
  InstrumentView,
  PositionView,
  Quote,
} from "@/lib/types";

const MAX_CANDLES = 500;

interface ForexState {
  symbol: string | null;
  interval: CandleInterval;
  snapshotVersion: number;
  quote: Quote | null;
  candles: Candle[];
  candleHistoryStatus: CandleHistoryStatus | null;
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
  applyCandles: (candles: Candle[]) => void;
  applyCandleHistoryStatus: (status: CandleHistoryStatus) => void;
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
  snapshotVersion: 0,
  quote: null,
  candles: [],
  candleHistoryStatus: null,
  instruments: [],
  account: null,
  positions: [],

  setMarket: (symbol, interval) => set({ symbol, interval, candles: [], quote: null, candleHistoryStatus: null }),

  applySnapshot: (snapshot) =>
    set((state) => {
      // A delayed snapshot from a previous subscription must not replace the
      // newly selected chart.
      if (snapshot.symbol !== state.symbol || snapshot.interval !== state.interval) return state;
      return {
        snapshotVersion: state.snapshotVersion + 1,
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

  applyCandles: (candles) =>
    set((state) => ({
      snapshotVersion: state.snapshotVersion + 1,
      candles: candles.slice(-MAX_CANDLES),
    })),

  applyCandleHistoryStatus: (candleHistoryStatus) =>
    set((state) => {
      if (
        candleHistoryStatus.symbol !== state.symbol ||
        candleHistoryStatus.interval !== state.interval
      ) return state;
      return { candleHistoryStatus };
    }),

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
    set({ instruments }),

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
