/**
 * Authenticated WebSocket gateway for quotes, candles, positions and account
 * snapshots. Inputs are bounded and validated before they reach the market hub.
 */
import { WebSocketServer, WebSocket } from "ws";
import type { IncomingMessage, Server } from "node:http";
import { hub, type HubEmission } from "../engine/hub";
import type { CandleInterval, WsServerMessage } from "../engine/types";
import {
  MAX_PAYLOAD_BYTES,
  MAX_SUBSCRIPTIONS,
  consumeMessageBudget,
  parseClientMessage,
  type ClientMessage,
} from "./protocol";
import { validateSecuritySession } from "../security/sessions";

interface ClientState {
  ws: WebSocket;
  userId: string;
  subs: Map<string, CandleInterval>;
  accountSubscribed: boolean;
  isAlive: boolean;
  windowStartedAt: number;
  messagesInWindow: number;
}

const clients = new Set<ClientState>();
const HEARTBEAT_MS = 30_000;
const DEFAULT_MAX_BUFFERED_BYTES = 1_048_576;

function maxBufferedBytes(): number {
  const configured = Number(process.env.WS_MAX_BUFFERED_BYTES ?? DEFAULT_MAX_BUFFERED_BYTES);
  return Number.isFinite(configured) && configured >= 65_536
    ? Math.min(16 * 1_048_576, Math.floor(configured))
    : DEFAULT_MAX_BUFFERED_BYTES;
}

function parseCookies(header: string): Map<string, string> {
  const cookies = new Map<string, string>();
  for (const part of header.split(";")) {
    const separator = part.indexOf("=");
    if (separator < 1) continue;
    const name = part.slice(0, separator).trim();
    const value = part.slice(separator + 1).trim();
    cookies.set(name, value);
  }
  return cookies;
}

function readChunkedCookie(cookies: Map<string, string>, baseName: string): string | null {
  const direct = cookies.get(baseName);
  if (direct) return direct;

  const chunks: Array<[number, string]> = [];
  for (const [name, value] of cookies) {
    if (!name.startsWith(`${baseName}.`)) continue;
    const index = Number(name.slice(baseName.length + 1));
    if (Number.isInteger(index) && index >= 0) chunks.push([index, value]);
  }
  if (chunks.length === 0) return null;
  chunks.sort(([a], [b]) => a - b);
  return chunks.map(([, value]) => value).join("");
}

/** Resolve the NextAuth JWT user from the request cookies. No dev bypass. */
async function resolveWsUserId(req: IncomingMessage): Promise<string | null> {
  try {
    const cookies = parseCookies(req.headers.cookie ?? "");
    const secure = "__Secure-authjs.session-token";
    const regular = "authjs.session-token";
    const preferredName = process.env.NODE_ENV === "production" ? secure : regular;
    const preferredToken = readChunkedCookie(cookies, preferredName);
    const fallbackName = preferredName === secure ? regular : secure;
    const fallbackToken = preferredToken ? null : readChunkedCookie(cookies, fallbackName);
    const encoded = preferredToken ?? fallbackToken;
    const salt = preferredToken ? preferredName : fallbackName;
    if (encoded) {
      const decoded = await decodeToken(decodeURIComponent(encoded), salt);
      if (
        typeof decoded?.id === "string" &&
        decoded.id.length > 0 &&
        typeof decoded.securitySessionId === "string" &&
        (await validateSecuritySession(decoded.securitySessionId, decoded.id))
      ) {
        return decoded.id;
      }
    }
  } catch {
    // Invalid cookies are treated as unauthenticated.
  }
  return null;
}

async function decodeToken(
  token: string,
  salt: string,
): Promise<{ id?: string; securitySessionId?: string } | null> {
  const { decode } = await import("@auth/core/jwt");
  const secret = process.env.AUTH_SECRET;
  if (!secret) return null;
  const decoded = await decode({ token, secret, salt });
  return decoded as { id?: string; securitySessionId?: string } | null;
}

export function attachWebSocketServer(server: Server): WebSocketServer {
  // noServer prevents interference with Next.js HMR upgrades.
  const wss = new WebSocketServer({ noServer: true, maxPayload: MAX_PAYLOAD_BYTES });

  server.on("upgrade", (req, socket, head) => {
    let pathname: string;
    try {
      pathname = new URL(req.url ?? "/", "http://localhost").pathname;
    } catch {
      socket.destroy();
      return;
    }
    if (pathname !== "/ws") return;
    wss.handleUpgrade(req, socket, head, (ws) => wss.emit("connection", ws, req));
  });

  hub.setBroadcaster((emission: HubEmission) => {
    for (const client of clients) {
      if (client.ws.readyState !== WebSocket.OPEN) continue;
      deliver(client, emission);
    }
  });

  wss.on("connection", async (ws, req) => {
    const userId = await resolveWsUserId(req);
    if (!userId) {
      ws.close(4401, "Authentication required");
      return;
    }

    const client: ClientState = {
      ws,
      userId,
      subs: new Map(),
      accountSubscribed: false,
      isAlive: true,
      windowStartedAt: Date.now(),
      messagesInWindow: 0,
    };
    clients.add(client);

    send(ws, {
      type: "instruments",
      instruments: hub.listInstruments().map((state) => hub.instrumentView(state)),
    });
    send(ws, { type: "pong" });

    ws.on("pong", () => {
      client.isAlive = true;
    });
    ws.on("message", (raw) => {
      if (consumeMessageBudget(client)) {
        ws.close(4408, "Message rate exceeded");
        return;
      }
      const message = parseClientMessage(raw);
      if (!message) {
        ws.close(4400, "Invalid message");
        return;
      }
      void handleMessage(client, message).catch((error: unknown) => {
        console.error("WebSocket command failed", error);
        if (client.ws.readyState === WebSocket.OPEN) {
          client.ws.close(1011, "Command failed");
        }
      });
    });
    ws.on("close", () => clients.delete(client));
    ws.on("error", () => clients.delete(client));
  });

  const heartbeat = setInterval(() => {
    for (const client of clients) {
      if (!client.isAlive) {
        client.ws.terminate();
        clients.delete(client);
        continue;
      }
      client.isAlive = false;
      client.ws.ping();
    }
  }, HEARTBEAT_MS);
  heartbeat.unref?.();

  wss.on("close", () => {
    clearInterval(heartbeat);
    clients.clear();
  });

  console.log("🔌 WebSocket server attached at /ws");
  return wss;
}

async function handleMessage(
  client: ClientState,
  message: ClientMessage,
): Promise<void> {
  if (message.type === "ping") {
    send(client.ws, { type: "pong" });
    return;
  }

  if (message.type === "account_unsubscribe") {
    client.accountSubscribed = false;
    return;
  }

  if (message.type === "account_subscribe") {
    client.accountSubscribed = true;
    const snapshot = await hub.accountSnapshot(client.userId);
    send(client.ws, { type: "account_snapshot", ...snapshot });
    return;
  }

  if (message.type === "unsubscribe") {
    client.subs.delete(message.symbol);
    return;
  }

  if (!hub.getInstrument(message.symbol)) {
    client.ws.close(4404, "Unknown instrument");
    return;
  }
  if (!client.subs.has(message.symbol) && client.subs.size >= MAX_SUBSCRIPTIONS) {
    client.ws.close(4408, "Subscription limit exceeded");
    return;
  }

  client.subs.set(message.symbol, message.interval);
  send(client.ws, {
    type: "snapshot",
    snapshot: hub.snapshot(message.symbol, message.interval, client.userId),
  });
  // Market subscriptions only need a read-only account view. Persisted ledger
  // projections are updated by financial mutations and periodic engine passes.
  send(client.ws, { type: "account", account: await hub.readAccountMetrics(client.userId) });
}

function deliver(client: ClientState, emission: HubEmission): void {
  switch (emission.kind) {
    case "quote":
      if (client.subs.has(emission.quote.symbol)) {
        send(client.ws, { type: "quote", quote: emission.quote });
      }
      break;
    case "candle":
      if (client.subs.get(emission.symbol) === emission.interval) {
        send(client.ws, {
          type: "candle",
          symbol: emission.symbol,
          interval: emission.interval,
          candle: emission.candle,
        });
      }
      break;
    case "position":
      if (client.userId === emission.userId && (client.accountSubscribed || client.subs.size > 0)) {
        send(client.ws, { type: "position", position: emission.position });
      }
      break;
    case "account":
      if (client.userId === emission.userId && (client.accountSubscribed || client.subs.size > 0)) {
        send(client.ws, { type: "account", account: emission.account, reason: emission.reason });
      }
      break;
    case "instruments":
      send(client.ws, { type: "instruments", instruments: emission.instruments });
      break;
  }
}

function send(ws: WebSocket, message: WsServerMessage): void {
  if (ws.readyState !== WebSocket.OPEN) return;
  try {
    const payload = JSON.stringify(message);
    const projectedBuffer = ws.bufferedAmount + Buffer.byteLength(payload);
    if (projectedBuffer > maxBufferedBytes()) {
      // A slow or suspended browser must not make the process retain an
      // unbounded quote/candle backlog. The client reconnects and receives a
      // fresh snapshot instead of replaying stale market data.
      ws.close(1013, "Client is not consuming updates fast enough");
      return;
    }
    ws.send(payload);
  } catch {
    ws.terminate();
  }
}
