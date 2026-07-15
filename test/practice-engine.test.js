import test from "node:test";
import assert from "node:assert/strict";
import {
  PRACTICE_MODES, emptyPracticeStats, evaluateReception, evaluateSending,
  practiceTargetFor, updatePracticeStats,
} from "../src/practice/practiceEngine.js";

test("practice targets are deterministic and fictional", () => {
  assert.equal(practiceTargetFor(PRACTICE_MODES.CHARACTER_RX, 0), "A");
  assert.match(practiceTargetFor(PRACTICE_MODES.CALLSIGN_RX, 3), /^SIM/);
  assert.equal(practiceTargetFor(PRACTICE_MODES.CALLSIGN_RX, 3), practiceTargetFor(PRACTICE_MODES.CALLSIGN_RX, 3));
});

test("weak characters reappear on the scheduled round", () => {
  assert.equal(practiceTargetFor(PRACTICE_MODES.CHARACTER_RX, 3, { Q: 4, A: 1 }), "Q");
});

test("reception answers are normalized and scored", () => {
  assert.equal(evaluateReception(" sim7qx ", "SIM7QX").correct, true);
  const missed = evaluateReception("A", "Q");
  assert.equal(missed.correct, false);
  assert.deepEqual(missed.missed, ["Q"]);
});

test("sending evaluation consumes CW analysis", () => {
  const result = evaluateSending({ decoded: "CQ", accuracy: 100, rhythm: 91 }, "CQ");
  assert.equal(result.correct, true);
  assert.equal(result.rhythm, 91);
});

test("practice stats track accuracy, rhythm and weaknesses", () => {
  let stats = emptyPracticeStats();
  stats = updatePracticeStats(stats, { correct: false, rhythm: null, missed: ["Q"] });
  stats = updatePracticeStats(stats, { correct: true, rhythm: 80, missed: [] });
  assert.equal(stats.attempts, 2);
  assert.equal(stats.correct, 1);
  assert.equal(stats.accuracy, 50);
  assert.equal(stats.averageRhythm, 80);
  assert.equal(stats.weaknesses.Q, 1);
});

