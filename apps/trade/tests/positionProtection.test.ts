import assert from "node:assert/strict";
import test from "node:test";
import { protectionLevelError } from "../src/server/engine/positionEngine.js";

test("validates BUY protection levels against the current mark", () => {
  assert.equal(protectionLevelError("BUY", 1.099, 1.102, 1.1, "current market price"), null);
  assert.equal(
    protectionLevelError("BUY", 1.1, null, 1.1, "current market price"),
    "Buy stop loss must be below the current market price.",
  );
  assert.equal(
    protectionLevelError("BUY", null, 1.1, 1.1, "current market price"),
    "Buy take profit must be above the current market price.",
  );
});

test("validates SELL protection levels and rejects unsafe values", () => {
  assert.equal(protectionLevelError("SELL", 1.101, 1.099, 1.1, "current market price"), null);
  assert.equal(
    protectionLevelError("SELL", null, 1.1, 1.1, "current market price"),
    "Sell take profit must be below the current market price.",
  );
  assert.equal(protectionLevelError("BUY", 0, null, 1.1), "Invalid stop loss.");
  assert.equal(protectionLevelError("BUY", Number.MAX_SAFE_INTEGER + 1, null, 1.1), "Invalid stop loss.");
  assert.equal(protectionLevelError("BUY", null, null, Number.NaN), "A valid reference price is required.");
});
