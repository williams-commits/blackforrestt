#!/usr/bin/env node
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import process from "node:process";
import WebSocket from "ws";

function numberEnv(name, fallback, minimum = 0) {
  const value = Number(process.env[name] ?? fallback);
  if (!Number.isFinite(value) || value < minimum) throw new Error(`${name} must be >= ${minimum}.`);
  return value;
}

const wsUrl = process.env.WS_URL ?? "ws://127.0.0.1:3000/ws";
const cookie = process.env.WS_COOKIE ?? "";
const symbol = (process.env.WS_SYMBOL ?? "AUDCAD").toUpperCase();
const interval = process.env.WS_INTERVAL ?? "1m";
const clientsRequested = Math.floor(numberEnv("WS_SOAK_CLIENTS", 10, 1));
const durationSeconds = numberEnv("WS_SOAK_DURATION_SECONDS", 60, 5);
const connectTimeoutMs = numberEnv("WS_CONNECT_TIMEOUT_MS", 10_000, 500);
const maxDisconnectRate = numberEnv("WS_MAX_DISCONNECT_RATE", 0.02, 0);
const minMessagesPerClient = numberEnv("WS_MIN_MESSAGES_PER_CLIENT", 3, 0);
const evidenceDir = resolve(process.env.PHASE8_EVIDENCE_DIR ?? "artifacts/phase8");

const stats = Array.from({ length: clientsRequested }, (_, index) => ({
  index,
  opened: false,
  messages: 0,
  invalidMessages: 0,
  errors: 0,
  unexpectedClose: false,
  closeCode: null,
  byType: {},
}));
const sockets = [];

function connectClient(stat) {
  return new Promise((resolveConnection, rejectConnection) => {
    const ws = new WebSocket(wsUrl, cookie ? { headers: { Cookie: cookie } } : undefined);
    sockets.push(ws);
    const timeout = setTimeout(() => {
      ws.terminate();
      rejectConnection(new Error(`client ${stat.index} connection timed out`));
    }, connectTimeoutMs);
    ws.on("open", () => {
      clearTimeout(timeout);
      stat.opened = true;
      ws.send(JSON.stringify({ type: "subscribe", symbol, interval }));
      resolveConnection();
    });
    ws.on("message", (raw) => {
      stat.messages += 1;
      try {
        const parsed = JSON.parse(raw.toString());
        const type = typeof parsed?.type === "string" ? parsed.type : "unknown";
        stat.byType[type] = (stat.byType[type] ?? 0) + 1;
      } catch {
        stat.invalidMessages += 1;
      }
    });
    ws.on("error", () => {
      stat.errors += 1;
    });
    ws.on("close", (code) => {
      stat.closeCode = code;
      if (Date.now() < endAt - 1_000) stat.unexpectedClose = true;
    });
  });
}

const startedAt = Date.now();
const endAt = startedAt + durationSeconds * 1_000;
await Promise.all(stats.map((stat) => connectClient(stat)));
const pingTimer = setInterval(() => {
  for (const ws of sockets) {
    if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: "ping" }));
  }
}, 20_000);
pingTimer.unref?.();
await new Promise((resolveDelay) => setTimeout(resolveDelay, durationSeconds * 1_000));
clearInterval(pingTimer);
await Promise.all(sockets.map((ws) => new Promise((resolveClose) => {
  if (ws.readyState === WebSocket.CLOSED) return resolveClose();
  ws.once("close", resolveClose);
  ws.close(1000, "soak complete");
  setTimeout(() => { if (ws.readyState !== WebSocket.CLOSED) ws.terminate(); resolveClose(); }, 2_000).unref?.();
})));

const unexpectedDisconnects = stats.filter((stat) => stat.unexpectedClose).length;
const disconnectRate = unexpectedDisconnects / clientsRequested;
const lowMessageClients = stats.filter((stat) => stat.messages < minMessagesPerClient).length;
const invalidMessages = stats.reduce((sum, stat) => sum + stat.invalidMessages, 0);
const errors = stats.reduce((sum, stat) => sum + stat.errors, 0);
const failures = [];
if (disconnectRate > maxDisconnectRate) failures.push(`disconnect rate ${disconnectRate.toFixed(4)} > ${maxDisconnectRate}`);
if (lowMessageClients > 0) failures.push(`${lowMessageClients} clients received fewer than ${minMessagesPerClient} messages`);
if (invalidMessages > 0) failures.push(`${invalidMessages} invalid JSON messages received`);
if (errors > 0) failures.push(`${errors} WebSocket errors observed`);
const result = {
  kind: "websocket_soak",
  generatedAt: new Date().toISOString(),
  target: wsUrl,
  symbol,
  interval,
  durationSeconds,
  clientsRequested,
  unexpectedDisconnects,
  disconnectRate: Number(disconnectRate.toFixed(6)),
  lowMessageClients,
  invalidMessages,
  errors,
  thresholds: { maxDisconnectRate, minMessagesPerClient },
  aggregateMessages: stats.reduce((sum, stat) => sum + stat.messages, 0),
  clients: stats,
  passed: failures.length === 0,
  failures,
};
await mkdir(evidenceDir, { recursive: true });
await writeFile(resolve(evidenceDir, "websocket-soak.json"), `${JSON.stringify(result, null, 2)}\n`);
console.log(JSON.stringify(result, null, 2));
if (!result.passed) process.exitCode = 1;
