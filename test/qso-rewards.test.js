import test from "node:test";
import assert from "node:assert/strict";
import {
  QSO_REWARD_BREAKDOWN_VERSION,
  QSO_REWARD_VALUES,
  calculateQsoRewardBreakdown,
  isWeakSignalLevel,
  normalizeQsoRewardBreakdown,
} from "../src/game/qsoRewards.js";

test("calculates the fixed QSO reward schedule", () => {
  assert.deepEqual(calculateQsoRewardBreakdown(), {
    version: QSO_REWARD_BREAKDOWN_VERSION,
    base: 100,
    independentWatch: 0,
    weakSignal: 0,
    newRegion: 0,
    newDistanceRecord: 0,
    total: 100,
  });
  assert.deepEqual(calculateQsoRewardBreakdown({
    independentWatch: true,
    finalPropagationLevel: 2,
    newRegion: true,
    newDistanceRecord: true,
  }), {
    version: QSO_REWARD_BREAKDOWN_VERSION,
    base: 100,
    independentWatch: 50,
    weakSignal: 75,
    newRegion: 20,
    newDistanceRecord: 25,
    total: 270,
  });
  assert.deepEqual(QSO_REWARD_VALUES, {
    base: 100,
    independentWatch: 50,
    weakSignal: 75,
    newRegion: 20,
    newDistanceRecord: 25,
  });
  assert.equal(Object.isFrozen(QSO_REWARD_VALUES), true);
});

test("weak-signal rewards include P0 through P2 only", () => {
  for (const level of [0, 1, 2, "2"]) assert.equal(isWeakSignalLevel(level), true);
  for (const level of [3, 4, -1, 0.5, 2.5, null, undefined, "", "bad"]) assert.equal(isWeakSignalLevel(level), false);
  assert.equal(calculateQsoRewardBreakdown({ finalPropagationLevel: 2 }).weakSignal, 75);
  assert.equal(calculateQsoRewardBreakdown({ finalPropagationLevel: 3 }).weakSignal, 0);
});

test("normalizes persisted reward breakdowns without trusting totals or arbitrary values", () => {
  assert.deepEqual(normalizeQsoRewardBreakdown({
    version: 1,
    base: 100,
    independentWatch: 50,
    weakSignal: 999,
    newRegion: 20,
    newDistanceRecord: -25,
    total: 999999,
  }), {
    version: 1,
    base: 100,
    independentWatch: 50,
    weakSignal: 0,
    newRegion: 20,
    newDistanceRecord: 0,
    total: 170,
  });
  assert.equal(normalizeQsoRewardBreakdown(null), null);
  assert.equal(normalizeQsoRewardBreakdown([]), null);
  assert.equal(normalizeQsoRewardBreakdown({ version: 2, base: 100 }), null);
  assert.equal(normalizeQsoRewardBreakdown({ version: 1, base: 99 }), null);
});
