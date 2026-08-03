import assert from "node:assert/strict";
import test from "node:test";
import {
  MAX_MESSAGES_PER_MINUTE,
  MAX_PAYLOAD_BYTES,
  MESSAGE_WINDOW_MS,
  consumeMessageBudget,
  parseClientMessage,
} from "../src/server/ws/protocol.js";

test("WebSocket protocol accepts and normalizes supported commands", () => {
  assert.deepEqual(parseClientMessage('{"type":"ping"}'), { type: "ping" });
  assert.deepEqual(
    parseClientMessage(Buffer.from('{"type":"subscribe","symbol":" eur/usd ","interval":"5m"}')),
    { type: "subscribe", symbol: "EUR/USD", interval: "5m" },
  );
  assert.deepEqual(
    parseClientMessage([
      Buffer.from('{"type":"unsubscribe","symbol":"btc'),
      Buffer.from('usd"}'),
    ]),
    { type: "unsubscribe", symbol: "BTCUSD" },
  );
});

test("WebSocket protocol rejects malformed, unsupported, and unsafe commands", () => {
  const invalid = [
    "not-json",
    "[]",
    "null",
    '{"type":"subscribe","symbol":"EURUSD","interval":"2m"}',
    '{"type":"subscribe","symbol":"../secret","interval":"5m"}',
    '{"type":"subscribe","symbol":"A","interval":"5m"}',
    '{"type":"unsubscribe","symbol":42}',
    '{"type":"publish","symbol":"EURUSD"}',
  ];
  for (const payload of invalid) assert.equal(parseClientMessage(payload), null, payload);
  assert.equal(MAX_PAYLOAD_BYTES, 16 * 1024);
});

test("WebSocket message budget permits the allowance, then closes, and resets", () => {
  const state = { windowStartedAt: 1_000, messagesInWindow: 0 };
  for (let index = 0; index < MAX_MESSAGES_PER_MINUTE; index += 1) {
    assert.equal(consumeMessageBudget(state, 1_000 + index), false);
  }
  assert.equal(consumeMessageBudget(state, 2_000), true);
  assert.equal(
    consumeMessageBudget(state, 1_000 + MESSAGE_WINDOW_MS),
    false,
    "a completed window must reset the counter",
  );
  assert.equal(state.messagesInWindow, 1);
});
