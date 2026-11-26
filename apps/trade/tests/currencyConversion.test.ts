import assert from "node:assert/strict";
import test from "node:test";
import { currencyConversionRate } from "../src/server/engine/currencyConversion.js";

test("currency conversion finds direct, inverse, and multi-pair rates", () => {
  const pairs = [
    { base: "USD", quote: "JPY", mid: 150 },
    { base: "GBP", quote: "USD", mid: 1.25 },
    { base: "EUR", quote: "GBP", mid: 0.85 },
  ];

  assert.equal(currencyConversionRate("USD", "USD", []), 1);
  assert.ok(Math.abs((currencyConversionRate("JPY", "USD", pairs) ?? 0) - 1 / 150) < 1e-12);
  assert.equal(currencyConversionRate("EUR", "USD", pairs), 1.0625);
});

test("currency conversion returns null when no valid path exists", () => {
  assert.equal(
    currencyConversionRate("CAD", "USD", [
      { base: "CAD", quote: "EUR", mid: 0 },
      { base: "JPY", quote: "USD", mid: Number.NaN },
    ]),
    null,
  );
});
