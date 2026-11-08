"use client";

/**
 * useForexSocket — connects the singleton socket to the forex store for a given
 * symbol + interval, and keeps the subscription live. Mount once in the
 * dashboard; children read from the store.
 */
import { useEffect, useState } from "react";
import { socket, type ServerMessage, type SocketStatus } from "@/lib/ws/client";
import { useForexStore } from "@/lib/store";
import type { CandleInterval } from "@/lib/types";

export function useForexSocket(symbol: string, interval: CandleInterval) {
  const [status, setStatus] = useState<SocketStatus>("closed");

  const setMarket = useForexStore((s) => s.setMarket);
  const applySnapshot = useForexStore((s) => s.applySnapshot);
  const applyQuote = useForexStore((s) => s.applyQuote);
  const applyCandles = useForexStore((s) => s.applyCandles);
  const applyCandleHistoryStatus = useForexStore((s) => s.applyCandleHistoryStatus);
  const applyCandle = useForexStore((s) => s.applyCandle);
  const applyInstruments = useForexStore((s) => s.applyInstruments);
  const applyAccount = useForexStore((s) => s.applyAccount);
  const applyPosition = useForexStore((s) => s.applyPosition);

  useEffect(() => {
    setMarket(symbol, interval);
  }, [symbol, interval, setMarket]);

  useEffect(() => {
    socket.subscribe(symbol, interval);
    return () => {
      socket.unsubscribe(symbol);
    };
  }, [symbol, interval]);

  useEffect(() => {
    const offStatus = socket.onStatus(setStatus);
    const off = socket.on((msg: ServerMessage) => {
      switch (msg.type) {
        case "snapshot":
          applySnapshot(msg.snapshot);
          break;
        case "account_snapshot":
          applyAccount(msg.account);
          useForexStore.getState().setPositions(msg.positions);
          break;
        case "quote":
          // Update the instrument list's live rates too.
          applyQuote(msg.quote);
          break;
        case "candle":
          if (msg.symbol === symbol && msg.interval === interval) applyCandle(msg.candle);
          break;
        case "candles":
          if (msg.symbol === symbol && msg.interval === interval) applyCandles(msg.candles);
          break;
        case "candle_history_status":
          if (msg.status.symbol === symbol && msg.status.interval === interval) {
            applyCandleHistoryStatus(msg.status);
          }
          break;
        case "instruments":
          applyInstruments(msg.instruments);
          break;
        case "account":
          applyAccount(msg.account);
          break;
        case "position":
          applyPosition(msg.position);
          break;
      }
    });
    return () => {
      off();
      offStatus();
    };
  }, [
    symbol,
    interval,
    applySnapshot,
    applyQuote,
    applyCandles,
    applyCandleHistoryStatus,
    applyCandle,
    applyInstruments,
    applyAccount,
    applyPosition,
  ]);

  return { status };
}
