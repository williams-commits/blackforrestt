import assert from "node:assert/strict";
import test from "node:test";
import { snapSliderValueToAnchors } from "../src/lib/leverageSliderScale.js";

test("slider magnet snaps values within the anchor radius", () => {
  assert.equal(snapSliderValueToAnchors(24.2, [1, 25, 50, 75, 100], 1), 25);
});

test("slider magnet leaves values outside the anchor radius untouched", () => {
  assert.equal(snapSliderValueToAnchors(22, [1, 25, 50, 75, 100], 1), 22);
});

test("slider magnet chooses the nearest anchor", () => {
  assert.equal(snapSliderValueToAnchors(49.6, [1, 25, 50, 75, 100], 2), 50);
});
