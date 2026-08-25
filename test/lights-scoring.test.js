import test from "node:test";
import assert from "node:assert/strict";
import { scoreLightsResult } from "../src/game/lightsScoring.js";

test("lights grades use exact fact boundaries instead of score thresholds", () => {
  assert.equal(scoreLightsResult({ validQsoCount: 2, distinctRegionCount: 2, resolvedPileupCount: 1 }).grade, "none");
  assert.equal(scoreLightsResult({ validQsoCount: 3, distinctRegionCount: 2, resolvedPileupCount: 1 }).grade, "base");
  assert.equal(scoreLightsResult({ validQsoCount: 5, distinctRegionCount: 4, resolvedPileupCount: 1 }).grade, "silver");
  assert.equal(scoreLightsResult({ validQsoCount: 7, distinctRegionCount: 5, resolvedPileupCount: 1, misidentificationCount: 0 }).grade, "gold");
  assert.equal(scoreLightsResult({ validQsoCount: 7, distinctRegionCount: 5, resolvedPileupCount: 1, misidentificationCount: 1 }).grade, "silver");
});

test("lights score rewards contacts, regions, and partial recovery with bounded penalties", () => {
  assert.deepEqual(scoreLightsResult({
    validQsoCount: 7,
    distinctRegionCount: 5,
    resolvedPileupCount: 1,
    successfulPartialCount: 1,
    misidentificationCount: 0,
    agnRequestCount: 1,
  }), { score: 835, grade: "gold" });
  assert.deepEqual(scoreLightsResult({
    validQsoCount: 99,
    distinctRegionCount: 99,
    resolvedPileupCount: 99,
    successfulPartialCount: 99,
    misidentificationCount: -4,
    agnRequestCount: -2,
  }), { score: 999, grade: "gold" });
  assert.deepEqual(scoreLightsResult({
    validQsoCount: 0,
    distinctRegionCount: 0,
    resolvedPileupCount: 0,
    successfulPartialCount: 0,
    misidentificationCount: 99,
    agnRequestCount: 99,
  }), { score: 0, grade: "none" });
});
