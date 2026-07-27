import test from "node:test";
import assert from "node:assert/strict";
import {
  PRACTICE_RECENT_TARGET_LIMIT,
  PRACTICE_RECORDS_VERSION,
  advancePracticeProgress,
  emptyPracticeRecords,
  normalizePracticeRecords,
  practiceLessonPlan,
  practiceStatsByMode,
  recordPracticeAttempt,
} from "../src/practice/practiceRecords.js";
import { PRACTICE_DIFFICULTIES, PRACTICE_MODES } from "../src/practice/practiceEngine.js";

test("practice records provide isolated defaults for all four modes", () => {
  const records = emptyPracticeRecords();
  assert.equal(PRACTICE_RECORDS_VERSION, 2);
  assert.deepEqual(Object.keys(records).sort(), Object.values(PRACTICE_MODES).sort());
  assert.equal(records[PRACTICE_MODES.CHARACTER_RX].attempts, 0);
  assert.equal(records[PRACTICE_MODES.PADDLE_TX].attempts, 0);
  assert.equal(records[PRACTICE_MODES.PADDLE_TX].difficulty, PRACTICE_DIFFICULTIES.GUIDED);
  assert.equal(records[PRACTICE_MODES.PADDLE_TX].lesson, 1);
});

test("lesson progress promotes only after a complete passing difficulty block", () => {
  let records = emptyPracticeRecords();
  for (let index = 0; index < 4; index += 1) {
    records = recordPracticeAttempt(records, PRACTICE_MODES.CHARACTER_RX, {
      target: "A",
      lesson: 1,
      difficulty: PRACTICE_DIFFICULTIES.GUIDED,
      correct: true,
      accuracy: 100,
      rhythm: null,
      missed: [],
    });
  }
  assert.equal(records[PRACTICE_MODES.CHARACTER_RX].lesson, 1);
  assert.equal(records[PRACTICE_MODES.CHARACTER_RX].lessonAttempts, 4);
  records = recordPracticeAttempt(records, PRACTICE_MODES.CHARACTER_RX, {
    target: "A", lesson: 1, difficulty: PRACTICE_DIFFICULTIES.GUIDED,
    correct: false, accuracy: 0, rhythm: null, missed: ["A"],
  });
  assert.equal(records[PRACTICE_MODES.CHARACTER_RX].lesson, 2);
  assert.equal(records[PRACTICE_MODES.CHARACTER_RX].completedLessons, 1);
  assert.equal(records[PRACTICE_MODES.CHARACTER_RX].lessonAttempts, 0);
});

test("failed lesson blocks retry and difficulty changes share unlocks but reset the block", () => {
  const nearlyReady = {
    ...emptyPracticeRecords()[PRACTICE_MODES.CHARACTER_RX],
    lesson: 2,
    completedLessons: 1,
    lessonAttempts: 4,
    lessonCorrect: 3,
  };
  const failed = advancePracticeProgress(nearlyReady, PRACTICE_MODES.CHARACTER_RX, {
    lesson: 2, difficulty: PRACTICE_DIFFICULTIES.GUIDED, correct: false,
  });
  assert.equal(failed.lesson, 2);
  assert.equal(failed.completedLessons, 1);
  assert.equal(failed.lessonAttempts, 0);

  const changed = advancePracticeProgress({ ...nearlyReady, lessonAttempts: 3, lessonCorrect: 3 }, PRACTICE_MODES.CHARACTER_RX, {
    lesson: 2, difficulty: PRACTICE_DIFFICULTIES.CHALLENGE, correct: true,
  });
  assert.equal(changed.difficulty, PRACTICE_DIFFICULTIES.CHALLENGE);
  assert.equal(changed.completedLessons, 1);
  assert.equal(changed.lessonAttempts, 1);
  assert.equal(changed.lessonCorrect, 1);
});

test("cross-session lesson plans ask only for the remaining scored block", () => {
  const record = {
    ...emptyPracticeRecords()[PRACTICE_MODES.CHARACTER_RX],
    lessonAttempts: 3,
    lessonCorrect: 3,
  };
  const continued = practiceLessonPlan(record, PRACTICE_MODES.CHARACTER_RX, PRACTICE_DIFFICULTIES.GUIDED, 1);
  assert.equal(continued.baselineAttempts, 3);
  assert.equal(continued.baselineCorrect, 3);
  assert.equal(continued.questionLimit, 2);

  const changedDifficulty = practiceLessonPlan(record, PRACTICE_MODES.CHARACTER_RX, PRACTICE_DIFFICULTIES.STANDARD, 1);
  assert.equal(changedDifficulty.baselineAttempts, 0);
  assert.equal(changedDifficulty.questionLimit, 8);

  const replay = practiceLessonPlan({ ...record, completedLessons: 1, lesson: 2 }, PRACTICE_MODES.CHARACTER_RX, PRACTICE_DIFFICULTIES.GUIDED, 1);
  assert.equal(replay.eligible, false);
  assert.equal(replay.questionLimit, 5);
});

test("an in-memory record can continue from a passed lesson without a save slot", () => {
  let records = emptyPracticeRecords();
  for (let index = 0; index < 5; index += 1) {
    records = recordPracticeAttempt(records, PRACTICE_MODES.CHARACTER_RX, {
      target: "A", lesson: 1, difficulty: PRACTICE_DIFFICULTIES.GUIDED,
      correct: true, accuracy: 100, rhythm: null, missed: [],
    });
  }
  const nextRecord = records[PRACTICE_MODES.CHARACTER_RX];
  assert.equal(nextRecord.lesson, 2);
  assert.equal(nextRecord.completedLessons, 1);
  const nextPlan = practiceLessonPlan(nextRecord, PRACTICE_MODES.CHARACTER_RX, PRACTICE_DIFFICULTIES.GUIDED, 2);
  assert.equal(nextPlan.eligible, true);
  assert.equal(nextPlan.questionLimit, 5);
});

test("normalization repairs inconsistent curriculum state without progress regression", () => {
  const normalized = normalizePracticeRecords({
    [PRACTICE_MODES.CHARACTER_RX]: {
      completedLessons: 3,
      lesson: 1,
      lessonAttempts: 99,
      lessonCorrect: 99,
    },
    [PRACTICE_MODES.CALLSIGN_RX]: {
      completedLessons: 99,
      lesson: 1,
      lessonAttempts: 3,
      lessonCorrect: 2,
    },
  });
  assert.equal(normalized[PRACTICE_MODES.CHARACTER_RX].lesson, 4);
  assert.equal(normalized[PRACTICE_MODES.CHARACTER_RX].lessonAttempts, 4);
  assert.equal(normalized[PRACTICE_MODES.CALLSIGN_RX].completedLessons, 4);
  assert.equal(normalized[PRACTICE_MODES.CALLSIGN_RX].lesson, 4);
  assert.equal(normalized[PRACTICE_MODES.CALLSIGN_RX].lessonAttempts, 0);
  assert.equal(normalized[PRACTICE_MODES.CALLSIGN_RX].lessonCorrect, 0);

  const locked = normalizePracticeRecords({
    [PRACTICE_MODES.CHARACTER_RX]: { completedLessons: 0, lesson: 99 },
  });
  assert.equal(locked[PRACTICE_MODES.CHARACTER_RX].lesson, 1);
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
