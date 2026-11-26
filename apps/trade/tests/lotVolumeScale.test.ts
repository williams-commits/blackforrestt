import assert from "node:assert/strict";
import test from "node:test";
import {
  LOT_VOLUME_SLIDER_MARKERS,
  LOT_VOLUME_SLIDER_MAX,
  lotVolumeFromSliderPosition,
  lotVolumeToSliderPosition,
  nextLotVolume,
} from "../src/lib/lotVolumeScale.js";

test("lot slider has exact stops for its tier boundaries", () => {
  for (const marker of LOT_VOLUME_SLIDER_MARKERS) {
    assert.equal(lotVolumeFromSliderPosition(marker.position), marker.volume, marker.label);
    assert.equal(lotVolumeToSliderPosition(marker.volume), marker.position, marker.label);
  }
});

test("every slider step advances exactly one lot increment for its tier", () => {
  for (let position = 1; position <= LOT_VOLUME_SLIDER_MAX; position += 1) {
    const previous = lotVolumeFromSliderPosition(position - 1);
    const current = lotVolumeFromSliderPosition(position);
    const expectedStep = position <= 9 ? 0.01 : position <= 108 ? 0.1 : 1;
    assert.ok(Math.abs(current - previous - expectedStep) < 1e-9, `step ${position}`);
  }
});

test("lot slider progresses by fine, fractional, and whole-lot ranges", () => {
  assert.equal(lotVolumeFromSliderPosition(1), 0.02);
  assert.equal(lotVolumeFromSliderPosition(10), 0.2);
  assert.equal(lotVolumeFromSliderPosition(103), 9.5);
  assert.equal(lotVolumeFromSliderPosition(153), 55);
  assert.equal(LOT_VOLUME_SLIDER_MAX, 198);
});

test("lot input values map back to their slider position across every tier", () => {
  for (const volume of [0.01, 0.05, 0.1, 0.2, 1, 9, 9.5, 10, 11, 55, 100]) {
    const position = lotVolumeToSliderPosition(volume);
    const mappedVolume = lotVolumeFromSliderPosition(position);
    assert.ok(Math.abs(mappedVolume - volume) <= (volume >= 10 ? 0.5 : 0.05));
  }
});

test("lot slider clamps finite values and rejects non-finite values", () => {
  assert.equal(lotVolumeToSliderPosition(-1), 0);
  assert.equal(lotVolumeToSliderPosition(101), LOT_VOLUME_SLIDER_MAX);
  assert.throws(() => lotVolumeToSliderPosition(Number.NaN), RangeError);
  assert.throws(() => lotVolumeFromSliderPosition(Number.POSITIVE_INFINITY), RangeError);
});

test("keyboard volume steps follow the active lot tier and exact transitions", () => {
  assert.equal(nextLotVolume(0.01, 1), 0.02);
  assert.equal(nextLotVolume(0.09, 1), 0.1);
  assert.equal(nextLotVolume(0.1, -1), 0.09);
  assert.equal(nextLotVolume(0.1, 1), 0.2);
  assert.equal(nextLotVolume(9.9, 1), 10);
  assert.equal(nextLotVolume(10, -1), 9.9);
  assert.equal(nextLotVolume(10, 1), 11);
  assert.equal(nextLotVolume(100, 1), 100);
});
