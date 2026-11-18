import assert from "node:assert/strict";
import test from "node:test";
import { createIdenticon } from "../src/lib/userIdenticon.js";

test("identicons are stable for the same identity and differ between identities", () => {
  assert.deepEqual(createIdenticon("user-123"), createIdenticon("USER-123"));
  assert.notDeepEqual(createIdenticon("user-123"), createIdenticon("user-456"));
});

test("identicon pixels are mirrored and every row has a visible pair", () => {
  const { cells } = createIdenticon("trader-identity");
  const coordinates = new Set(cells.map(({ x, y }) => `${x}:${y}`));

  for (let y = 0; y < 8; y += 1) {
    const row = cells.filter((cell) => cell.y === y);
    assert.ok(row.length > 0);
    for (const { x } of row) {
      assert.ok(coordinates.has(`${7 - x}:${y}`));
    }
  }
});
