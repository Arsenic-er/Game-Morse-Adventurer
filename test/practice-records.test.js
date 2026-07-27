import test from "node:test";
import assert from "node:assert/strict";
import {
  PRACTICE_RECENT_TARGET_LIMIT,
  emptyPracticeRecords,
  normalizePracticeRecords,
  practiceStatsByMode,
  recordPracticeAttempt,
} from "../src/practice/practiceRecords.js";
import { PRACTICE_MODES } from "../src/practice/practiceEngine.js";

test("practice records provide isolated defaults for all four modes", () => {
  const records = emptyPracticeRecords();
  assert.deepEqual(Object.keys(records).sort(), Object.values(PRACTICE_MODES).sort());
  assert.equal(records[PRACTICE_MODES.CHARACTER_RX].attempts, 0);
  assert.equal(records[PRACTICE_MODES.PADDLE_TX].attempts, 0);
});

test("recording attempts updates only the selected mode and keeps a bounded recent window", () => {
  let records = emptyPracticeRecords();
  const targets = ["A", "N", "T", "E", "I", "M"];
  targets.forEach((target, index) => {
    records = recordPracticeAttempt(records, PRACTICE_MODES.CHARACTER_RX, {
      target,
      correct: index !== 0,
      accuracy: index === 0 ? 0 : 100,
      rhythm: null,
      missed: index === 0 ? [target] : [],
    }, `2026-01-01T00:00:0${index}.000Z`);
  });
  const character = records[PRACTICE_MODES.CHARACTER_RX];
  assert.equal(character.attempts, targets.length);
  assert.equal(character.correct, targets.length - 1);
  assert.deepEqual(character.recentTargets, targets.slice(-PRACTICE_RECENT_TARGET_LIMIT));
  assert.equal(character.weaknesses.A, 1);
  assert.equal(records[PRACTICE_MODES.CALLSIGN_RX].attempts, 0);
});

test("normalization clamps corrupt values and drops invalid targets and weakness keys", () => {
  const normalized = normalizePracticeRecords({
    [PRACTICE_MODES.CHARACTER_RX]: {
      attempts: 3,
      correct: 99,
      accuracyTotal: Infinity,
      accuracySamples: -4,
      rhythmTotal: "75",
      rhythmSamples: 1,
      weaknesses: { q: 2, INVALID: 50, "?": 9 },
      recentTargets: ["INVALID", "A", "Q", "?", "N", "T", "E"],
      lastPracticedAt: "not-a-date",
    },
  });
  const record = normalized[PRACTICE_MODES.CHARACTER_RX];
  assert.equal(record.correct, 3);
  assert.deepEqual(record.weaknesses, { Q: 2 });
  assert.deepEqual(record.recentTargets, ["Q", "N", "T", "E"]);
  assert.equal(record.lastPracticedAt, null);
  assert.equal(record.rhythmTotal, 75);
});

test("derived lifetime stats survive JSON round trips without session attempt ids", () => {
  const updated = recordPracticeAttempt(emptyPracticeRecords(), PRACTICE_MODES.PADDLE_TX, {
    target: "A",
    correct: true,
    accuracy: 90,
    rhythm: 84,
    missed: [],
    attemptId: "session-only-id",
  }, "2026-01-01T00:00:00.000Z");
  const reloaded = normalizePracticeRecords(JSON.parse(JSON.stringify(updated)));
  const stats = practiceStatsByMode(reloaded)[PRACTICE_MODES.PADDLE_TX];
  assert.equal(stats.attempts, 1);
  assert.equal(stats.averageAccuracy, 90);
  assert.equal(stats.averageRhythm, 84);
  assert.equal("settledAttemptIds" in reloaded[PRACTICE_MODES.PADDLE_TX], false);
});
