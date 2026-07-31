import test from "node:test";
import assert from "node:assert/strict";
import {
  PRACTICE_RECENT_TARGET_LIMIT,
  PRACTICE_RECORDS_VERSION,
  advancePracticeProgress,
  emptyPracticeRecords,
  normalizePracticeRecords,
  practiceLessonPlan,
  practiceMasteryFeedback,
  practiceWeakTargets,
  practiceStatsByMode,
  recordPracticeAttempt,
  summarizePracticeProgress,
  updatePracticePreference,
} from "../src/practice/practiceRecords.js";
import { PRACTICE_DIFFICULTIES, PRACTICE_MODES, PRACTICE_SESSION_TYPES, practicePoolFor } from "../src/practice/practiceEngine.js";
import { PRACTICE_CALLSIGN_REGIONS } from "../src/practice/practiceCallsignCatalog.js";

test("practice records provide isolated defaults for all four modes", () => {
  const records = emptyPracticeRecords();
  assert.equal(PRACTICE_RECORDS_VERSION, 3);
  assert.deepEqual(Object.keys(records).sort(), Object.values(PRACTICE_MODES).sort());
  assert.equal(records[PRACTICE_MODES.CHARACTER_RX].attempts, 0);
  assert.equal(records[PRACTICE_MODES.PADDLE_TX].attempts, 0);
  assert.equal(records[PRACTICE_MODES.PADDLE_TX].difficulty, PRACTICE_DIFFICULTIES.GUIDED);
  assert.equal(records[PRACTICE_MODES.PADDLE_TX].lesson, 1);
  assert.equal(records[PRACTICE_MODES.CALLSIGN_RX].callsignRegion, PRACTICE_CALLSIGN_REGIONS.ALL);
  assert.equal("callsignRegion" in records[PRACTICE_MODES.CHARACTER_RX], false);
});

test("callsign records normalize regions and discard recent targets from other regional pools", () => {
  const japanTarget = practicePoolFor(PRACTICE_MODES.CALLSIGN_RX, { lesson: 4, callsignRegion: PRACTICE_CALLSIGN_REGIONS.JAPAN })[0];
  const usaTarget = practicePoolFor(PRACTICE_MODES.CALLSIGN_RX, { lesson: 4, callsignRegion: PRACTICE_CALLSIGN_REGIONS.USA })[0];
  const normalized = normalizePracticeRecords({
    [PRACTICE_MODES.CALLSIGN_RX]: {
      callsignRegion: PRACTICE_CALLSIGN_REGIONS.JAPAN,
      recentTargets: [usaTarget, japanTarget, "BAD"],
    },
  });
  assert.equal(normalized[PRACTICE_MODES.CALLSIGN_RX].callsignRegion, PRACTICE_CALLSIGN_REGIONS.JAPAN);
  assert.deepEqual(normalized[PRACTICE_MODES.CALLSIGN_RX].recentTargets, [japanTarget]);
  assert.equal(normalizePracticeRecords({
    [PRACTICE_MODES.CALLSIGN_RX]: { callsignRegion: "moon" },
  })[PRACTICE_MODES.CALLSIGN_RX].callsignRegion, PRACTICE_CALLSIGN_REGIONS.ALL);
});

test("changing callsign region clears only cross-region recency and preserves all progress", () => {
  const initial = normalizePracticeRecords({
    [PRACTICE_MODES.CHARACTER_RX]: { attempts: 2, correct: 1, recentTargets: ["A"] },
    [PRACTICE_MODES.CALLSIGN_RX]: {
      attempts: 7,
      correct: 5,
      weaknesses: { S: 2 },
      difficulty: PRACTICE_DIFFICULTIES.STANDARD,
      completedLessons: 1,
      lessonAttempts: 3,
      lessonCorrect: 2,
      lastPracticedAt: "2026-01-01T00:00:00.000Z",
      recentTargets: ["SIM7QX"],
      callsignRegion: PRACTICE_CALLSIGN_REGIONS.ALL,
    },
  });
  const changed = updatePracticePreference(initial, PRACTICE_MODES.CALLSIGN_RX, {
    callsignRegion: PRACTICE_CALLSIGN_REGIONS.JAPAN,
  });
  const beforeCallsign = { ...initial[PRACTICE_MODES.CALLSIGN_RX] };
  const afterCallsign = { ...changed[PRACTICE_MODES.CALLSIGN_RX] };
  delete beforeCallsign.callsignRegion;
  delete beforeCallsign.recentTargets;
  delete afterCallsign.callsignRegion;
  delete afterCallsign.recentTargets;
  assert.deepEqual(afterCallsign, beforeCallsign);
  assert.equal(changed[PRACTICE_MODES.CALLSIGN_RX].callsignRegion, PRACTICE_CALLSIGN_REGIONS.JAPAN);
  assert.deepEqual(changed[PRACTICE_MODES.CALLSIGN_RX].recentTargets, []);
  assert.deepEqual(changed[PRACTICE_MODES.CHARACTER_RX], initial[PRACTICE_MODES.CHARACTER_RX]);
  assert.deepEqual(updatePracticePreference(changed, PRACTICE_MODES.CALLSIGN_RX, {
    callsignRegion: PRACTICE_CALLSIGN_REGIONS.JAPAN,
  }), changed);
  assert.deepEqual(updatePracticePreference(changed, PRACTICE_MODES.CHARACTER_RX, {
    callsignRegion: PRACTICE_CALLSIGN_REGIONS.USA,
  }), changed);
  assert.deepEqual(updatePracticePreference(changed, "invalid-mode", {
    callsignRegion: PRACTICE_CALLSIGN_REGIONS.USA,
  }), changed);
});

test("regional callsign attempts persist selection and reset only incompatible recent targets", () => {
  const japanTarget = practicePoolFor(PRACTICE_MODES.CALLSIGN_RX, { lesson: 1, callsignRegion: PRACTICE_CALLSIGN_REGIONS.JAPAN })[0];
  const usaTarget = practicePoolFor(PRACTICE_MODES.CALLSIGN_RX, { lesson: 1, callsignRegion: PRACTICE_CALLSIGN_REGIONS.USA })[0];
  let records = updatePracticePreference(emptyPracticeRecords(), PRACTICE_MODES.CALLSIGN_RX, {
    callsignRegion: PRACTICE_CALLSIGN_REGIONS.JAPAN,
  });
  records = recordPracticeAttempt(records, PRACTICE_MODES.CALLSIGN_RX, {
    target: japanTarget,
    callsignRegion: PRACTICE_CALLSIGN_REGIONS.JAPAN,
    lesson: 1,
    difficulty: PRACTICE_DIFFICULTIES.GUIDED,
    correct: true,
    accuracy: 100,
    rhythm: null,
    missed: [],
  });
  let record = records[PRACTICE_MODES.CALLSIGN_RX];
  assert.equal(record.callsignRegion, PRACTICE_CALLSIGN_REGIONS.JAPAN);
  assert.deepEqual(record.recentTargets, [japanTarget]);
  assert.equal(record.attempts, 1);
  assert.equal(record.lessonAttempts, 1);

  records = recordPracticeAttempt(records, PRACTICE_MODES.CALLSIGN_RX, {
    target: usaTarget,
    callsignRegion: PRACTICE_CALLSIGN_REGIONS.USA,
    lesson: 1,
    difficulty: PRACTICE_DIFFICULTIES.GUIDED,
    correct: true,
    accuracy: 100,
    rhythm: null,
    missed: [],
  });
  record = records[PRACTICE_MODES.CALLSIGN_RX];
  assert.equal(record.callsignRegion, PRACTICE_CALLSIGN_REGIONS.USA);
  assert.deepEqual(record.recentTargets, [usaTarget]);
  assert.equal(record.attempts, 2);
  assert.equal(record.correct, 2);
  assert.equal(record.lessonAttempts, 2);
});

test("regional callsign preference survives JSON round trips in derived stats", () => {
  const target = practicePoolFor(PRACTICE_MODES.CALLSIGN_RX, { lesson: 1, callsignRegion: PRACTICE_CALLSIGN_REGIONS.CHINA })[0];
  let records = updatePracticePreference(emptyPracticeRecords(), PRACTICE_MODES.CALLSIGN_RX, {
    callsignRegion: PRACTICE_CALLSIGN_REGIONS.CHINA,
  });
  records = recordPracticeAttempt(records, PRACTICE_MODES.CALLSIGN_RX, {
    target,
    callsignRegion: PRACTICE_CALLSIGN_REGIONS.CHINA,
    correct: true,
    accuracy: 100,
    rhythm: null,
    missed: [],
  });
  const reloaded = normalizePracticeRecords(JSON.parse(JSON.stringify(records)));
  const stats = practiceStatsByMode(reloaded)[PRACTICE_MODES.CALLSIGN_RX];
  assert.equal(stats.callsignRegion, PRACTICE_CALLSIGN_REGIONS.CHINA);
  assert.deepEqual(stats.recentTargets, [target]);
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

test("mastery feedback reports explicit curriculum and current block facts", () => {
  const feedback = practiceMasteryFeedback({
    ...emptyPracticeRecords()[PRACTICE_MODES.CHARACTER_RX],
    completedLessons: 2,
    lesson: 3,
    lessonAttempts: 3,
    lessonCorrect: 2,
  }, PRACTICE_MODES.CHARACTER_RX);

  assert.deepEqual(feedback, {
    mode: PRACTICE_MODES.CHARACTER_RX,
    difficulty: PRACTICE_DIFFICULTIES.GUIDED,
    lesson: 3,
    lessonCount: 5,
    completedLessons: 2,
    curriculumCompleted: false,
    progressionEligible: true,
    blockAttempts: 3,
    blockCorrect: 2,
    blockAccuracy: 67,
    requiredAttempts: 5,
    requiredAccuracy: 80,
    requiredCorrect: 4,
    attemptsRemaining: 2,
    correctNeeded: 2,
    canStillPass: true,
    thresholdSecured: false,
    status: "in-progress",
  });
});

test("mastery feedback identifies secured, impossible, and completed states without a fuzzy score", () => {
  const base = emptyPracticeRecords()[PRACTICE_MODES.CHARACTER_RX];
  const secured = practiceMasteryFeedback({ ...base, lessonAttempts: 4, lessonCorrect: 4 }, PRACTICE_MODES.CHARACTER_RX);
  assert.equal(secured.status, "threshold-secured");
  assert.equal(secured.correctNeeded, 0);
  assert.equal(secured.attemptsRemaining, 1);

  const impossible = practiceMasteryFeedback({ ...base, lessonAttempts: 3, lessonCorrect: 1 }, PRACTICE_MODES.CHARACTER_RX);
  assert.equal(impossible.status, "cannot-pass");
  assert.equal(impossible.canStillPass, false);
  assert.equal(impossible.correctNeeded, 3);

  const changedDifficulty = practiceMasteryFeedback(base, PRACTICE_MODES.CHARACTER_RX, {
    difficulty: PRACTICE_DIFFICULTIES.CHALLENGE,
    lesson: 1,
  });
  assert.equal(changedDifficulty.difficulty, PRACTICE_DIFFICULTIES.CHALLENGE);
  assert.equal(changedDifficulty.requiredAttempts, 10);
  assert.equal(changedDifficulty.blockAttempts, 0);

  const replay = practiceMasteryFeedback({ ...base, completedLessons: 2 }, PRACTICE_MODES.CHARACTER_RX, { lesson: 1 });
  assert.equal(replay.status, "replay");
  assert.equal(replay.progressionEligible, false);
  assert.equal(replay.attemptsRemaining, 0);

  const complete = practiceMasteryFeedback({ ...base, completedLessons: 5 }, PRACTICE_MODES.CHARACTER_RX);
  assert.equal(complete.status, "completed");
  assert.equal(complete.curriculumCompleted, true);
  assert.equal(complete.attemptsRemaining, 0);
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

test("practice progress summary is pure and safely bounds legacy or corrupt lesson records", () => {
  const source = {
    [PRACTICE_MODES.CHARACTER_RX]: { completedLessons: 99, lesson: -4 },
    [PRACTICE_MODES.CALLSIGN_RX]: { completedLessons: 2, lesson: 3 },
    [PRACTICE_MODES.MANUAL_TX]: { completedLessons: -9, lesson: 88 },
    [PRACTICE_MODES.PADDLE_TX]: null,
  };
  const before = JSON.stringify(source);
  const summary = summarizePracticeProgress(source);

  assert.equal(summary.completedLessons, 7);
  assert.equal(summary.totalLessons, 19);
  assert.equal(summary.percent, 37);
  assert.deepEqual(summary.modes[PRACTICE_MODES.CHARACTER_RX], {
    completedLessons: 5,
    totalLessons: 5,
    percent: 100,
  });
  assert.deepEqual(summary.modes[PRACTICE_MODES.CALLSIGN_RX], {
    completedLessons: 2,
    totalLessons: 4,
    percent: 50,
  });
  assert.deepEqual(
    Object.fromEntries(Object.entries(summary.modes).map(([mode, progress]) => [mode, progress.totalLessons])),
    {
      [PRACTICE_MODES.CHARACTER_RX]: 5,
      [PRACTICE_MODES.CALLSIGN_RX]: 4,
      [PRACTICE_MODES.MANUAL_TX]: 5,
      [PRACTICE_MODES.PADDLE_TX]: 5,
    },
  );
  assert.equal(summary.modes[PRACTICE_MODES.MANUAL_TX].completedLessons, 0);
  assert.equal(summary.modes[PRACTICE_MODES.PADDLE_TX].completedLessons, 0);
  assert.equal(JSON.stringify(source), before);
});

test("practice progress summary gives an empty legacy save a stable zero baseline", () => {
  const summary = summarizePracticeProgress(undefined);
  assert.equal(summary.completedLessons, 0);
  assert.equal(summary.totalLessons, 19);
  assert.equal(summary.percent, 0);
  assert.deepEqual(Object.keys(summary.modes).sort(), Object.values(PRACTICE_MODES).sort());
});

test("weak targets are ranked stably and never leak locked lesson content", () => {
  const base = {
    ...emptyPracticeRecords()[PRACTICE_MODES.CHARACTER_RX],
    lesson: 2,
    completedLessons: 1,
    weaknesses: { O: 4, A: 2, N: 2, Q: 99, "?": 500 },
  };
  assert.deepEqual(practiceWeakTargets(base, PRACTICE_MODES.CHARACTER_RX), [
    { target: "O", misses: 4 },
    { target: "A", misses: 2 },
    { target: "N", misses: 2 },
  ]);
  assert.equal(practiceWeakTargets(base, PRACTICE_MODES.CHARACTER_RX, { lesson: 5 }).some(({ target }) => target === "Q"), false);

  const callsign = {
    ...emptyPracticeRecords()[PRACTICE_MODES.CALLSIGN_RX],
    weaknesses: { S: 3, I: 2, M: 1, Q: 4, X: 1, R: 5 },
  };
  assert.deepEqual(practiceWeakTargets(callsign, PRACTICE_MODES.CALLSIGN_RX), [
    { target: "SIM7QX", misses: 11 },
    { target: "SIM3RA", misses: 11 },
  ]);
  const japanPool = practicePoolFor(PRACTICE_MODES.CALLSIGN_RX, { lesson: 1, callsignRegion: PRACTICE_CALLSIGN_REGIONS.JAPAN });
  const regionalCallsign = {
    ...emptyPracticeRecords()[PRACTICE_MODES.CALLSIGN_RX],
    callsignRegion: PRACTICE_CALLSIGN_REGIONS.JAPAN,
    weaknesses: { S: 1, I: 1, M: 1 },
  };
  assert.deepEqual(
    practiceWeakTargets(regionalCallsign, PRACTICE_MODES.CALLSIGN_RX).map(({ target }) => target),
    japanPool,
  );
  assert.deepEqual(practiceWeakTargets(base, PRACTICE_MODES.CHARACTER_RX, { limit: -2 }), []);
});

test("weakness review updates lifetime stats without touching lesson progression", () => {
  const initial = {
    ...emptyPracticeRecords(),
    [PRACTICE_MODES.CHARACTER_RX]: {
      ...emptyPracticeRecords()[PRACTICE_MODES.CHARACTER_RX],
      difficulty: PRACTICE_DIFFICULTIES.STANDARD,
      lesson: 3,
      completedLessons: 2,
      lessonAttempts: 6,
      lessonCorrect: 5,
    },
  };
  const updated = recordPracticeAttempt(initial, PRACTICE_MODES.CHARACTER_RX, {
    sessionType: PRACTICE_SESSION_TYPES.WEAKNESS_REVIEW,
    target: "R",
    lesson: 3,
    difficulty: PRACTICE_DIFFICULTIES.GUIDED,
    correct: false,
    accuracy: 0,
    rhythm: null,
    missed: ["R"],
  }, "2026-01-01T00:00:00.000Z");
  const record = updated[PRACTICE_MODES.CHARACTER_RX];
  assert.equal(record.attempts, 1);
  assert.equal(record.correct, 0);
  assert.equal(record.weaknesses.R, 1);
  assert.equal(record.difficulty, PRACTICE_DIFFICULTIES.STANDARD);
  assert.equal(record.lesson, 3);
  assert.equal(record.completedLessons, 2);
  assert.equal(record.lessonAttempts, 6);
  assert.equal(record.lessonCorrect, 5);
});

test('review recovery stays consistent between session and lifetime records while formal progress is isolated', async () => {
  const {
    createWeaknessReviewSession,
    currentPracticeQuestion,
    settlePracticeQuestion,
  } = await import('../src/practice/practiceEngine.js');
  const progress = {
    difficulty: PRACTICE_DIFFICULTIES.STANDARD,
    lesson: 3,
    completedLessons: 2,
    lessonAttempts: 6,
    lessonCorrect: 5,
  };
  let records = {
    ...emptyPracticeRecords(),
    [PRACTICE_MODES.CHARACTER_RX]: {
      ...emptyPracticeRecords()[PRACTICE_MODES.CHARACTER_RX],
      ...progress,
      weaknesses: { N: 5 },
    },
  };
  let session = createWeaknessReviewSession({
    mode: PRACTICE_MODES.CHARACTER_RX,
    lesson: 3,
    targetPool: ['N'],
    weaknesses: records[PRACTICE_MODES.CHARACTER_RX].weaknesses,
    seed: 'record-recovery',
    startedAt: '2026-01-01T00:00:00.000Z',
  });
  for (let index = 0; index < 5; index += 1) {
    const question = currentPracticeQuestion(session);
    const result = {
      sessionType: PRACTICE_SESSION_TYPES.WEAKNESS_REVIEW,
      target: question.target,
      lesson: 3,
      difficulty: PRACTICE_DIFFICULTIES.GUIDED,
      correct: true,
      accuracy: 100,
      rhythm: null,
      missed: [],
    };
    session = settlePracticeQuestion(session, question.id, result, `2026-01-01T00:00:0${index + 1}.000Z`);
    records = recordPracticeAttempt(records, PRACTICE_MODES.CHARACTER_RX, result, `2026-01-01T00:00:0${index + 1}.000Z`);
    assert.deepEqual(records[PRACTICE_MODES.CHARACTER_RX].weaknesses, session.stats.weaknesses);
  }
  const record = records[PRACTICE_MODES.CHARACTER_RX];
  assert.deepEqual(record.weaknesses, {});
  assert.equal(record.attempts, session.stats.attempts);
  assert.equal(record.correct, session.stats.correct);
  assert.equal(record.difficulty, progress.difficulty);
  assert.equal(record.lesson, progress.lesson);
  assert.equal(record.completedLessons, progress.completedLessons);
  assert.equal(record.lessonAttempts, progress.lessonAttempts);
  assert.equal(record.lessonCorrect, progress.lessonCorrect);
  assert.deepEqual(practiceWeakTargets(record, PRACTICE_MODES.CHARACTER_RX), []);
});

test('a correct formal lesson answer never decays lifetime weakness weight', () => {
  const initial = {
    ...emptyPracticeRecords(),
    [PRACTICE_MODES.CHARACTER_RX]: {
      ...emptyPracticeRecords()[PRACTICE_MODES.CHARACTER_RX],
      weaknesses: { A: 2 },
    },
  };
  const updated = recordPracticeAttempt(initial, PRACTICE_MODES.CHARACTER_RX, {
    sessionType: PRACTICE_SESSION_TYPES.LESSON,
    target: 'A',
    lesson: 1,
    difficulty: PRACTICE_DIFFICULTIES.GUIDED,
    correct: true,
    accuracy: 100,
    rhythm: null,
    missed: [],
  });
  assert.deepEqual(updated[PRACTICE_MODES.CHARACTER_RX].weaknesses, { A: 2 });
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
