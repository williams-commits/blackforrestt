"use client";

/** Browser WebSocket client with bounded reconnects and heartbeat detection. */
import type {
  AccountMetricsView,
  Candle,
  CandleInterval,
  InstrumentView,
  PositionView,
  Quote,
} from "@/lib/types";

export type ServerMessage =
  | { type: "snapshot"; snapshot: SnapshotPayload }
  | { type: "account_snapshot"; account: AccountMetricsView; positions: PositionView[] }
  | { type: "quote"; quote: Quote }
  | { type: "candle"; symbol: string; interval: CandleInterval; candle: Candle }
  | { type: "position"; position: PositionView }
  | { type: "account"; account: AccountMetricsView; reason?: "ledger" }
  | { type: "activity"; counts: { notifications: number; messages: number; operatorMessages: number; supportCases: number } }
  | { type: "instruments"; instruments: InstrumentView[] }
  | { type: "pong" };

export interface SnapshotPayload {
  symbol: string;
  interval: CandleInterval;
  candles: Candle[];
  quote: Quote | null;
  instruments: InstrumentView[];
  positions: PositionView[];
  account: AccountMetricsView | null;
}

export type SocketStatus = "connecting" | "open" | "closed" | "unauthorized";
type Handler = (msg: ServerMessage) => void;

function resolveWsUrl(): string {
  const override = process.env.NEXT_PUBLIC_WS_URL;
  if (override) return override;
  if (typeof window === "undefined") return "ws://localhost:3000/ws";
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${protocol}//${window.location.host}/ws`;
}

class ForexSocket {
  private ws: WebSocket | null = null;
  private handlers = new Set<Handler>();
  private reconnectAttempts = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private desiredSubs = new Map<string, CandleInterval>();
  private accountSubscribed = false;
  private lastServerMessageAt = 0;
  private reconnectAllowed = true;
  private statusListeners = new Set<(status: SocketStatus) => void>();
  status: SocketStatus = "closed";

  on(handler: Handler): () => void {
    this.handlers.add(handler);
    this.ensureOpen();
    return () => this.handlers.delete(handler);
  }

  onStatus(listener: (status: SocketStatus) => void): () => void {
    this.statusListeners.add(listener);
    listener(this.status);
    return () => this.statusListeners.delete(listener);
  }

  subscribe(symbol: string, interval: CandleInterval): void {
    const normalized = symbol.trim().toUpperCase();
    this.desiredSubs.set(normalized, interval);
    this.ensureOpen();
    this.send({ type: "subscribe", symbol: normalized, interval });
  }

  unsubscribe(symbol: string): void {
    const normalized = symbol.trim().toUpperCase();
    this.desiredSubs.delete(normalized);
    this.send({ type: "unsubscribe", symbol: normalized });
  }

  subscribeAccount(): void {
    this.accountSubscribed = true;
    this.ensureOpen();
    this.send({ type: "account_subscribe" });
  }

  unsubscribeAccount(): void {
    this.accountSubscribed = false;
    this.send({ type: "account_unsubscribe" });
  }

  private ensureOpen(): void {
    if (typeof window === "undefined" || !this.reconnectAllowed) return;
    if (
      this.ws &&
      (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)
    ) {
      return;
    }
    this.open();
  }

  private open(): void {
    if (!this.reconnectAllowed || typeof window === "undefined") return;
    this.clearReconnectTimer();
    this.setStatus("connecting");

    try {
      this.ws = new WebSocket(resolveWsUrl());
    } catch {
      this.ws = null;
      this.scheduleReconnect();
      return;
    }

    this.ws.onopen = () => {
      this.reconnectAttempts = 0;
      this.lastServerMessageAt = Date.now();
      this.setStatus("open");
      if (this.accountSubscribed) this.send({ type: "account_subscribe" });
      for (const [symbol, interval] of this.desiredSubs) {
        this.send({ type: "subscribe", symbol, interval });
      }
      this.startHeartbeat();
    };

    this.ws.onmessage = (event) => {
      this.lastServerMessageAt = Date.now();
      if (typeof event.data !== "string") return;

      let message: ServerMessage;
      try {
        message = JSON.parse(event.data) as ServerMessage;
      } catch {
        return;
      }
      if (!message || typeof message !== "object" || typeof message.type !== "string") return;

      for (const handler of this.handlers) {
        try {
          handler(message);
        } catch (error) {
          console.error("WebSocket message handler failed", error);
        }
      }
    };

    this.ws.onclose = (event) => {
      this.ws = null;
      this.stopHeartbeat();

      if (event.code === 4401 || event.code === 4403) {
        this.reconnectAllowed = false;
        this.setStatus("unauthorized");
        return;
      }

      this.setStatus("closed");
      this.scheduleReconnect();
    };

    this.ws.onerror = () => {
      // onclose performs cleanup and reconnect scheduling.
      this.ws?.close();
    };
  }

  private send(message: object): void {
    if (this.ws?.readyState !== WebSocket.OPEN) return;
    try {
      this.ws.send(JSON.stringify(message));
    } catch {
      this.ws.close();
    }
  }

  private scheduleReconnect(): void {
    if (!this.reconnectAllowed || this.reconnectTimer || typeof window === "undefined") return;
    const base = Math.min(1_000 * 2 ** this.reconnectAttempts, 15_000);
    const jitter = Math.floor(Math.random() * 500);
    this.reconnectAttempts += 1;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.open();
    }, base + jitter);
  }

  private clearReconnectTimer(): void {
    if (!this.reconnectTimer) return;
    clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;
  }

  private startHeartbeat(): void {
    this.stopHeartbeat();
    this.heartbeatTimer = setInterval(() => {
      if (Date.now() - this.lastServerMessageAt > 45_000) {
        this.ws?.close(4000, "Heartbeat timeout");
        return;
      }
      this.send({ type: "ping" });
    }, 20_000);
  }

  private stopHeartbeat(): void {
    if (!this.heartbeatTimer) return;
    clearInterval(this.heartbeatTimer);
    this.heartbeatTimer = null;
  }

  private setStatus(status: SocketStatus): void {
    if (this.status === status) return;
    this.status = status;
    for (const listener of this.statusListeners) listener(status);
  }
}

const socketGlobal = globalThis as typeof globalThis & {
  __blckforest_socket?: ForexSocket;
};

export const socket: ForexSocket = socketGlobal.__blckforest_socket ?? new ForexSocket();
if (typeof window !== "undefined") socketGlobal.__blckforest_socket = socket;
