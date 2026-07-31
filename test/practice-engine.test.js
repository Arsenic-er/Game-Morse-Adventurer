import test from "node:test";
import assert from "node:assert/strict";
import {
  CHARACTER_POOL, FICTIONAL_CALLSIGNS, PRACTICE_DIFFICULTIES, PRACTICE_MODES, PRACTICE_SESSION_TYPES, completePracticeSession, createPracticeBag, createPracticeSession,
  createWeaknessReviewSession,
  currentPracticeQuestion, emptyPracticeStats, evaluateReception, evaluateSending, normalizePracticeSession,
  normalizePracticeStats, practiceDifficultyProfile, practiceLessonCount, practicePoolFor, practiceReceiveWpm,
  practiceLessonContent, practiceTargetFor, settlePracticeQuestion, summarizePracticeSession,
  updatePracticeStats,
} from "../src/practice/practiceEngine.js";
import {
  PRACTICE_CALLSIGN_REGIONS,
  practiceCallsignCatalog,
  practiceCallsignPool,
} from "../src/practice/practiceCallsignCatalog.js";

test("difficulty profiles define stable speed and promotion gates", () => {
  assert.deepEqual(
    Object.values(PRACTICE_DIFFICULTIES).map((difficulty) => practiceDifficultyProfile(difficulty).requiredAttempts),
    [5, 8, 10],
  );
  assert.equal(practiceReceiveWpm(PRACTICE_DIFFICULTIES.GUIDED, PRACTICE_MODES.CHARACTER_RX), 10);
  assert.equal(practiceReceiveWpm(PRACTICE_DIFFICULTIES.CHALLENGE, PRACTICE_MODES.CALLSIGN_RX), 20);
});

test("lesson pools expand cumulatively without leaking locked targets", () => {
  assert.deepEqual(practicePoolFor(PRACTICE_MODES.CHARACTER_RX, { lesson: 1 }), ["A", "N", "T", "E"]);
  assert.deepEqual(practicePoolFor(PRACTICE_MODES.CHARACTER_RX, { lesson: 2 }), ["A", "N", "T", "E", "I", "M", "S", "O"]);
  assert.equal(practicePoolFor(PRACTICE_MODES.CALLSIGN_RX, { lesson: 1 }).length, 2);
  assert.equal(practicePoolFor(PRACTICE_MODES.CALLSIGN_RX, { lesson: 99 }).length, 8);
  assert.equal(practiceLessonCount(PRACTICE_MODES.CALLSIGN_RX), 4);
  assert.equal(practicePoolFor(PRACTICE_MODES.PADDLE_TX, { lesson: 4 }).includes("SIM3RA"), false);
  assert.equal(practicePoolFor(PRACTICE_MODES.PADDLE_TX, { lesson: 5 }).includes("SIM3RA"), true);
});

test("regional callsign catalogs are fictional, bounded and globally unique", () => {
  const catalog = practiceCallsignCatalog();
  assert.deepEqual(Object.keys(catalog), Object.values(PRACTICE_CALLSIGN_REGIONS));
  assert.deepEqual(catalog.all, FICTIONAL_CALLSIGNS);
  assert.deepEqual(catalog.all, ["SIM7QX", "SIM3RA", "SIM9AK", "SIM5TU", "SIM2DX", "SIM8CW", "SIM4NZ", "SIM6JP"]);
  const specificRegions = Object.values(PRACTICE_CALLSIGN_REGIONS).filter((region) => region !== PRACTICE_CALLSIGN_REGIONS.ALL);
  const regionalCallsigns = specificRegions.flatMap((region) => {
    assert.equal(catalog[region].length, 8);
    return catalog[region];
  });
  assert.equal(new Set(regionalCallsigns).size, 32);
  assert.equal(new Set([...catalog.all, ...regionalCallsigns]).size, 40);
  assert.equal(regionalCallsigns.every((callsign) => callsign.startsWith("SIM") && /^[A-Z0-9]+$/.test(callsign) && callsign.length <= 7), true);
});

test("callsign lessons unlock two regional targets at a time and invalid regions use all", () => {
  for (const region of Object.values(PRACTICE_CALLSIGN_REGIONS)) {
    const completePool = practiceCallsignPool(region);
    for (let lesson = 1; lesson <= 4; lesson += 1) {
      assert.deepEqual(
        practicePoolFor(PRACTICE_MODES.CALLSIGN_RX, { lesson, callsignRegion: region }),
        completePool.slice(0, lesson * 2),
      );
    }
  }
  assert.deepEqual(
    practicePoolFor(PRACTICE_MODES.CALLSIGN_RX, { callsignRegion: "invalid" }),
    FICTIONAL_CALLSIGNS,
  );
  assert.deepEqual(
    practicePoolFor(PRACTICE_MODES.CHARACTER_RX, { lesson: 1, callsignRegion: PRACTICE_CALLSIGN_REGIONS.JAPAN }),
    ["A", "N", "T", "E"],
  );
});

test("lesson content explains newly introduced, review, and full target pools", () => {
  assert.deepEqual(practiceLessonContent(PRACTICE_MODES.CHARACTER_RX, 2), {
    mode: PRACTICE_MODES.CHARACTER_RX,
    callsignRegion: PRACTICE_CALLSIGN_REGIONS.ALL,
    lesson: 2,
    lessonCount: 5,
    introducedTargets: ["I", "M", "S", "O"],
    reviewTargets: ["A", "N", "T", "E"],
    targetPool: ["A", "N", "T", "E", "I", "M", "S", "O"],
  });

  const finalPaddle = practiceLessonContent(PRACTICE_MODES.PADDLE_TX, 5);
  assert.deepEqual(finalPaddle.introducedTargets, ["7", "3", "5", "SIM3RA"]);
  assert.equal(finalPaddle.reviewTargets.includes("Q"), true);
  assert.deepEqual(finalPaddle.targetPool, practicePoolFor(PRACTICE_MODES.PADDLE_TX, { lesson: 5 }));

  const finalCallsign = practiceLessonContent(PRACTICE_MODES.CALLSIGN_RX, 4);
  assert.deepEqual(finalCallsign.introducedTargets, ["SIM4NZ", "SIM6JP"]);
  assert.equal(finalCallsign.reviewTargets.length, 6);

  const japanLesson = practiceLessonContent(PRACTICE_MODES.CALLSIGN_RX, 2, PRACTICE_CALLSIGN_REGIONS.JAPAN);
  assert.equal(japanLesson.callsignRegion, PRACTICE_CALLSIGN_REGIONS.JAPAN);
  assert.deepEqual(japanLesson.reviewTargets, practiceCallsignPool(PRACTICE_CALLSIGN_REGIONS.JAPAN).slice(0, 2));
  assert.deepEqual(japanLesson.introducedTargets, practiceCallsignPool(PRACTICE_CALLSIGN_REGIONS.JAPAN).slice(2, 4));
  assert.deepEqual(japanLesson.targetPool, practiceCallsignPool(PRACTICE_CALLSIGN_REGIONS.JAPAN).slice(0, 4));
});

test("guided sessions stay inside the selected lesson and complete at its gate", () => {
  const profile = practiceDifficultyProfile(PRACTICE_DIFFICULTIES.GUIDED);
  let session = createPracticeSession({
    mode: PRACTICE_MODES.CHARACTER_RX,
    difficulty: PRACTICE_DIFFICULTIES.GUIDED,
    lesson: 1,
    questionLimit: profile.requiredAttempts,
    seed: "lesson-one",
    startedAt: "2026-01-01T00:00:00.000Z",
  });
  for (let index = 0; index < profile.requiredAttempts; index += 1) {
    const question = currentPracticeQuestion(session);
    assert.equal(["A", "N", "T", "E"].includes(question.target), true);
    session = settlePracticeQuestion(session, question.id, {
      correct: index !== 0,
      accuracy: index === 0 ? 0 : 100,
      rhythm: null,
      missed: index === 0 ? [question.target] : [],
    }, `2026-01-01T00:00:0${index + 1}.000Z`);
  }
  const summary = summarizePracticeSession(session);
  assert.equal(summary.lessonPassed, true);
  assert.equal(summary.nextLessonUnlocked, true);
  assert.equal(summary.nextLesson, 2);
});

test("legacy practice target API stays deterministic and fictional", () => {
  assert.equal(practiceTargetFor(PRACTICE_MODES.CHARACTER_RX, 0), "A");
  assert.match(practiceTargetFor(PRACTICE_MODES.CALLSIGN_RX, 3), /^SIM/);
  assert.equal(practiceTargetFor(PRACTICE_MODES.CALLSIGN_RX, 3), practiceTargetFor(PRACTICE_MODES.CALLSIGN_RX, 3));
});

test("deterministic shuffled bags contain each target once", () => {
  const first = createPracticeBag({ mode: PRACTICE_MODES.CHARACTER_RX, bagIndex: 2, seed: "fixed" });
  const repeated = createPracticeBag({ mode: PRACTICE_MODES.CHARACTER_RX, bagIndex: 2, seed: "fixed" });
  assert.deepEqual(first, repeated);
  assert.equal(first.length, CHARACTER_POOL.length);
  assert.equal(new Set(first).size, first.length);
  assert.deepEqual([...first].sort(), [...CHARACTER_POOL].sort());
});

test("regional callsign bags are deterministic and avoid recent targets inside their region", () => {
  const japanPool = practiceCallsignPool(PRACTICE_CALLSIGN_REGIONS.JAPAN);
  const first = createPracticeBag({
    mode: PRACTICE_MODES.CALLSIGN_RX,
    callsignRegion: PRACTICE_CALLSIGN_REGIONS.JAPAN,
    lesson: 4,
    seed: "regional",
  });
  const repeated = createPracticeBag({
    mode: PRACTICE_MODES.CALLSIGN_RX,
    callsignRegion: PRACTICE_CALLSIGN_REGIONS.JAPAN,
    lesson: 4,
    seed: "regional",
  });
  assert.deepEqual(first, repeated);
  assert.deepEqual([...first].sort(), [...japanPool].sort());

  const recentTargets = japanPool.slice(0, 4);
  const session = createPracticeSession({
    mode: PRACTICE_MODES.CALLSIGN_RX,
    callsignRegion: PRACTICE_CALLSIGN_REGIONS.JAPAN,
    lesson: 4,
    seed: "regional-recent",
    recentTargets,
  });
  assert.equal(recentTargets.includes(currentPracticeQuestion(session).target), false);
});

test("sessions normalize and preserve callsign regions without leaking them into other modes", () => {
  const legacy = normalizePracticeSession({ mode: PRACTICE_MODES.CALLSIGN_RX, lesson: 4, seed: "legacy" });
  assert.equal(legacy.schemaVersion, 3);
  assert.equal(legacy.callsignRegion, PRACTICE_CALLSIGN_REGIONS.ALL);
  assert.equal(legacy.queue.every((target) => FICTIONAL_CALLSIGNS.includes(target)), true);

  const japan = normalizePracticeSession({
    mode: PRACTICE_MODES.CALLSIGN_RX,
    callsignRegion: PRACTICE_CALLSIGN_REGIONS.JAPAN,
    lesson: 4,
    seed: "japan",
  });
  assert.equal(japan.callsignRegion, PRACTICE_CALLSIGN_REGIONS.JAPAN);
  assert.equal(japan.queue.every((target) => practiceCallsignPool(PRACTICE_CALLSIGN_REGIONS.JAPAN).includes(target)), true);
  assert.equal(currentPracticeQuestion(japan).callsignRegion, PRACTICE_CALLSIGN_REGIONS.JAPAN);

  const invalid = normalizePracticeSession({ mode: PRACTICE_MODES.CALLSIGN_RX, callsignRegion: "moon", lesson: 4 });
  assert.equal(invalid.callsignRegion, PRACTICE_CALLSIGN_REGIONS.ALL);
  const nonCallsign = normalizePracticeSession({ mode: PRACTICE_MODES.MANUAL_TX, callsignRegion: PRACTICE_CALLSIGN_REGIONS.JAPAN });
  assert.equal(nonCallsign.callsignRegion, PRACTICE_CALLSIGN_REGIONS.ALL);
});

test("weakness review target pools cannot cross callsign regions", () => {
  const japanTarget = practiceCallsignPool(PRACTICE_CALLSIGN_REGIONS.JAPAN)[0];
  const usaTarget = practiceCallsignPool(PRACTICE_CALLSIGN_REGIONS.USA)[0];
  const review = createWeaknessReviewSession({
    mode: PRACTICE_MODES.CALLSIGN_RX,
    callsignRegion: PRACTICE_CALLSIGN_REGIONS.JAPAN,
    lesson: 4,
    targetPool: [japanTarget, usaTarget],
    seed: "regional-review",
  });
  assert.equal(review.callsignRegion, PRACTICE_CALLSIGN_REGIONS.JAPAN);
  assert.deepEqual(review.targetPool, [japanTarget]);
  assert.equal(currentPracticeQuestion(review).callsignRegion, PRACTICE_CALLSIGN_REGIONS.JAPAN);
  const summary = summarizePracticeSession(review);
  assert.equal(summary.callsignRegion, PRACTICE_CALLSIGN_REGIONS.JAPAN);
  assert.deepEqual(summary.targetPool, [japanTarget]);
  assert.equal(createWeaknessReviewSession({
    mode: PRACTICE_MODES.CALLSIGN_RX,
    callsignRegion: PRACTICE_CALLSIGN_REGIONS.JAPAN,
    lesson: 4,
    targetPool: [usaTarget],
  }), null);
});

test("explicit target pools create five-question weakness review sessions with bag boundary avoidance", () => {
  let session = createWeaknessReviewSession({
    mode: PRACTICE_MODES.CHARACTER_RX,
    lesson: 2,
    targetPool: ["o", "A", "?", "I", "N", "T", "O"],
    seed: "weakness-review",
    startedAt: "2026-01-01T00:00:00.000Z",
  });
  assert.equal(session.sessionType, PRACTICE_SESSION_TYPES.WEAKNESS_REVIEW);
  assert.equal(session.questionLimit, 5);
  assert.deepEqual(session.targetPool, ["O", "A", "I", "N", "T"]);
  const targets = [];
  for (let index = 0; index < 5; index += 1) {
    const question = currentPracticeQuestion(session);
    assert.equal(question.sessionType, PRACTICE_SESSION_TYPES.WEAKNESS_REVIEW);
    assert.equal(question.progressionEligible, false);
    targets.push(question.target);
    session = settlePracticeQuestion(session, question.id, {
      correct: true, accuracy: 100, rhythm: null, missed: [],
    }, `2026-01-01T00:00:0${index + 1}.000Z`);
  }
  assert.equal(new Set(targets).size, 5);
  assert.equal(currentPracticeQuestion(session), null);
  assert.equal(targets.slice(-4).includes(session.queue[0]), false);
  const summary = summarizePracticeSession(session);
  assert.equal(summary.sessionType, PRACTICE_SESSION_TYPES.WEAKNESS_REVIEW);
  assert.equal(summary.progressionEligible, false);
  assert.equal(summary.lessonPassed, false);
});

test("createPracticeSession treats an explicit valid target pool as a fixed review contract", () => {
  const session = createPracticeSession({
    mode: PRACTICE_MODES.MANUAL_TX,
    lesson: 1,
    targetPool: ["E", "A"],
    questionLimit: 99,
  });
  assert.equal(session.sessionType, PRACTICE_SESSION_TYPES.WEAKNESS_REVIEW);
  assert.equal(session.questionLimit, 5);
  assert.deepEqual([...session.targetPool].sort(), ["A", "E"]);
});

test("weakness review rejects an empty invalid target pool and normalizes damaged pools", () => {
  assert.equal(createWeaknessReviewSession({ mode: PRACTICE_MODES.CHARACTER_RX, lesson: 1, targetPool: ["Q", "?"] }), null);
  const normalized = normalizePracticeSession({
    mode: PRACTICE_MODES.CHARACTER_RX,
    lesson: 1,
    sessionType: PRACTICE_SESSION_TYPES.WEAKNESS_REVIEW,
    targetPool: ["n", "Q", "N", null],
    questionLimit: 999,
  });
  assert.deepEqual(normalized.targetPool, ["N"]);
  assert.equal(normalized.questionLimit, 5);
  assert.deepEqual(normalized.queue, ["N"]);
});

test("bag refill avoids repeating its boundary target", () => {
  const first = createPracticeBag({ mode: PRACTICE_MODES.CALLSIGN_RX, bagIndex: 0, seed: "boundary" });
  const second = createPracticeBag({
    mode: PRACTICE_MODES.CALLSIGN_RX,
    bagIndex: 1,
    seed: "boundary",
    previousTarget: first.at(-1),
    globalIndex: practicePoolFor(PRACTICE_MODES.CALLSIGN_RX).length,
  });
  assert.notEqual(second[0], first.at(-1));
});

test("new sessions and refilled bags avoid the most recent four targets", () => {
  const recentTargets = CHARACTER_POOL.slice(0, 4);
  const session = createPracticeSession({
    mode: PRACTICE_MODES.CHARACTER_RX,
    seed: "recent",
    startedAt: "2026-01-01T00:00:00.000Z",
    recentTargets,
  });
  assert.equal(recentTargets.includes(currentPracticeQuestion(session).target), false);

  const refilled = createPracticeBag({
    mode: PRACTICE_MODES.CHARACTER_RX,
    bagIndex: 3,
    seed: "recent",
    recentTargets,
    globalIndex: CHARACTER_POOL.length * 3,
  });
  assert.equal(recentTargets.includes(refilled[0]), false);
});

test("weak characters reappear on the scheduled round without duplicating the bag", () => {
  assert.equal(practiceTargetFor(PRACTICE_MODES.CHARACTER_RX, 3, { Q: 4, A: 1 }), "Q");
  const session = createPracticeSession({ mode: PRACTICE_MODES.CHARACTER_RX, seed: "weak", startedAt: "2026-01-01T00:00:00.000Z" });
  let current = session;
  for (let index = 0; index < 3; index += 1) {
    const question = currentPracticeQuestion(current);
    current = settlePracticeQuestion(current, question.id, { correct: index !== 0, accuracy: index !== 0 ? 100 : 0, rhythm: null, missed: index === 0 ? ["Q"] : [] }, `2026-01-01T00:00:0${index + 1}.000Z`);
  }
  assert.equal(currentPracticeQuestion(current).target, "Q");
  assert.equal(new Set(current.queue).size, current.queue.length);
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

test("practice stats track averages, rhythm and weaknesses", () => {
  let stats = emptyPracticeStats();
  stats = updatePracticeStats(stats, { correct: false, accuracy: 40, rhythm: null, missed: ["Q"] });
  stats = updatePracticeStats(stats, { correct: true, accuracy: 100, rhythm: 80, missed: [] });
  assert.equal(stats.attempts, 2);
  assert.equal(stats.correct, 1);
  assert.equal(stats.accuracy, 50);
  assert.equal(stats.averageAccuracy, 70);
  assert.equal(stats.averageRhythm, 80);
  assert.equal(stats.weaknesses.Q, 1);
});

test('only correct weakness-review answers recover one weighted target character', () => {
  const damaged = {
    attempts: -20,
    correct: 500,
    weaknesses: { q: 3.9, A: 3, INVALID: 99, '?': 50 },
  };
  const recoveredTie = updatePracticeStats(damaged, {
    sessionType: PRACTICE_SESSION_TYPES.WEAKNESS_REVIEW,
    target: 'qAq',
    correct: true,
    accuracy: 100,
    rhythm: null,
    missed: ['A'],
  });
  assert.deepEqual(recoveredTie.weaknesses, { Q: 2, A: 3 });

  const recoveredCallsign = updatePracticeStats({ weaknesses: { S: 2, I: 5, M: 1, '7': 5, Q: 5, X: 5 } }, {
    sessionType: PRACTICE_SESSION_TYPES.WEAKNESS_REVIEW,
    target: 'SIM7QX',
    correct: true,
    accuracy: 100,
    rhythm: null,
    missed: [],
  });
  assert.deepEqual(recoveredCallsign.weaknesses, { S: 2, I: 4, M: 1, '7': 5, Q: 5, X: 5 });

  const formalAnswer = updatePracticeStats({ weaknesses: { A: 2 } }, {
    sessionType: PRACTICE_SESSION_TYPES.LESSON,
    target: 'A',
    correct: true,
    accuracy: 100,
    rhythm: null,
    missed: [],
  });
  assert.deepEqual(formalAnswer.weaknesses, { A: 2 });

  const reviewMiss = updatePracticeStats({ weaknesses: { A: 2 } }, {
    sessionType: PRACTICE_SESSION_TYPES.WEAKNESS_REVIEW,
    target: 'A',
    correct: false,
    accuracy: 0,
    rhythm: null,
    missed: ['A'],
  });
  assert.deepEqual(reviewMiss.weaknesses, { A: 3 });
});

test('five correct review questions retire a weakness without changing the fixed pool', () => {
  let session = createWeaknessReviewSession({
    mode: PRACTICE_MODES.CHARACTER_RX,
    lesson: 1,
    targetPool: ['N'],
    weaknesses: { n: 5, INVALID: 900 },
    seed: 'recover-five',
    startedAt: '2026-01-01T00:00:00.000Z',
  });
  for (let index = 0; index < 5; index += 1) {
    const question = currentPracticeQuestion(session);
    assert.equal(question.target, 'N');
    session = settlePracticeQuestion(session, question.id, {
      correct: true,
      accuracy: 100,
      rhythm: null,
      missed: [],
    }, `2026-01-01T00:00:0${index + 1}.000Z`);
    assert.deepEqual(session.targetPool, ['N']);
  }
  assert.equal(currentPracticeQuestion(session), null);
  assert.deepEqual(session.stats.weaknesses, {});
  const summary = summarizePracticeSession(session);
  assert.equal(summary.questionCount, 5);
  assert.equal(summary.correctCount, 5);
  assert.equal(summary.progressionEligible, false);
  assert.equal(summary.lessonPassed, false);
  assert.deepEqual(summary.targetPool, ['N']);
  assert.deepEqual(summary.weaknesses, {});
  assert.deepEqual(summary.weakCharacters, []);
});

test("practice percentages clamp corrupt totals and out-of-range samples", () => {
  const normalized = normalizePracticeStats({
    attempts: 2,
    correct: 1,
    accuracySamples: 2,
    accuracyTotal: 999999,
    rhythmSamples: 2,
    rhythmTotal: -500,
  });
  assert.equal(normalized.averageAccuracy, 100);
  assert.equal(normalized.accuracyTotal, 200);
  assert.equal(normalized.averageRhythm, 0);
  assert.equal(normalized.rhythmTotal, 0);

  const evaluated = evaluateSending({ decoded: "A", accuracy: 700, rhythm: -8 }, "A");
  assert.equal(evaluated.accuracy, 100);
  assert.equal(evaluated.rhythm, 0);

  const updated = updatePracticeStats(emptyPracticeStats(), {
    correct: true,
    accuracy: -20,
    rhythm: 500,
    missed: [],
  });
  assert.equal(updated.averageAccuracy, 0);
  assert.equal(updated.averageRhythm, 100);
});

test("identified attempts and practice questions settle only once", () => {
  const firstStats = updatePracticeStats(emptyPracticeStats(), { attemptId: "q-1", correct: true, accuracy: 100, rhythm: 90, missed: [] });
  const repeatedStats = updatePracticeStats(firstStats, { attemptId: "q-1", correct: false, accuracy: 0, rhythm: 0, missed: ["A"] });
  assert.equal(repeatedStats.attempts, 1);
  assert.equal(repeatedStats.correct, 1);

  const session = createPracticeSession({ mode: PRACTICE_MODES.CHARACTER_RX, seed: "once", startedAt: "2026-01-01T00:00:00.000Z" });
  const question = currentPracticeQuestion(session);
  const settled = settlePracticeQuestion(session, question.id, { correct: true, accuracy: 100, rhythm: null, missed: [] }, "2026-01-01T00:00:01.000Z");
  const duplicated = settlePracticeQuestion(settled, question.id, { correct: false, accuracy: 0, rhythm: null, missed: [question.target] }, "2026-01-01T00:00:02.000Z");
  assert.equal(duplicated.stats.attempts, 1);
  assert.equal(duplicated.stats.correct, 1);
  assert.equal(duplicated.questionIndex, 1);
});

test("question ids are session-scoped while target order stays deterministic", () => {
  const first = createPracticeSession({ mode: PRACTICE_MODES.CHARACTER_RX, seed: "same", startedAt: "2026-01-01T00:00:00.000Z" });
  const second = createPracticeSession({ mode: PRACTICE_MODES.CHARACTER_RX, seed: "same", startedAt: "2026-01-02T00:00:00.000Z" });
  assert.equal(currentPracticeQuestion(first).target, currentPracticeQuestion(second).target);
  assert.notEqual(currentPracticeQuestion(first).id, currentPracticeQuestion(second).id);
});

test("question limits complete sessions and summaries are serializable", () => {
  let session = createPracticeSession({
    mode: PRACTICE_MODES.PADDLE_TX,
    seed: "summary",
    startedAt: "2026-01-01T00:00:00.000Z",
    questionLimit: 2,
  });
  let question = currentPracticeQuestion(session);
  const missedTarget = question.target;
  session = settlePracticeQuestion(session, question.id, { correct: false, accuracy: 60, rhythm: 70, missed: [question.target] }, "2026-01-01T00:00:01.000Z");
  question = currentPracticeQuestion(session);
  session = settlePracticeQuestion(session, question.id, { correct: true, accuracy: 100, rhythm: 90, missed: [] }, "2026-01-01T00:00:02.000Z");

  assert.equal(currentPracticeQuestion(session), null);
  const summary = summarizePracticeSession(session);
  assert.deepEqual(summary, {
    schemaVersion: 3,
    mode: PRACTICE_MODES.PADDLE_TX,
    callsignRegion: PRACTICE_CALLSIGN_REGIONS.ALL,
    sessionType: PRACTICE_SESSION_TYPES.LESSON,
    progressionEligible: true,
    targetPool: null,
    difficulty: PRACTICE_DIFFICULTIES.GUIDED,
    lesson: null,
    lessonCount: 5,
    requiredAttempts: 5,
    requiredAccuracy: 80,
    lessonPassed: false,
    nextLesson: null,
    nextLessonUnlocked: false,
    curriculumCompleted: false,
    questionCount: 2,
    correctCount: 1,
    averageAccuracy: 80,
    averageRhythm: 80,
    weaknesses: Object.fromEntries([...missedTarget].map((character) => [character, 1])),
    weakCharacters: [...missedTarget].sort().map((character) => ({ character, misses: 1 })),
    startedAt: "2026-01-01T00:00:00.000Z",
    completedAt: "2026-01-01T00:00:02.000Z",
  });
  assert.doesNotThrow(() => JSON.stringify(session));
  assert.doesNotThrow(() => JSON.stringify(summary));
});

test("legacy stats and partial sessions normalize with migration-safe defaults", () => {
  const stats = normalizePracticeStats({ attempts: 2, correct: 1, accuracy: 50, rhythmTotal: 75, rhythmSamples: 1, weaknesses: { q: 2 } });
  assert.equal(stats.averageAccuracy, 50);
  assert.equal(stats.averageRhythm, 75);
  assert.deepEqual(stats.weaknesses, { Q: 2 });

  const session = normalizePracticeSession({ mode: PRACTICE_MODES.CHARACTER_RX, questionIndex: 2, stats });
  assert.equal(session.schemaVersion, 3);
  assert.equal(session.callsignRegion, PRACTICE_CALLSIGN_REGIONS.ALL);
  assert.equal(session.questionIndex, 2);
  assert.ok(session.queue.length > 0);
  assert.doesNotThrow(() => JSON.stringify(session));
});

test("manual completion is idempotent", () => {
  const session = createPracticeSession({ mode: PRACTICE_MODES.CHARACTER_RX, startedAt: "2026-01-01T00:00:00.000Z" });
  const completed = completePracticeSession(session, "2026-01-01T00:01:00.000Z");
  const repeated = completePracticeSession(completed, "2026-01-01T00:02:00.000Z");
  assert.equal(repeated.completedAt, "2026-01-01T00:01:00.000Z");
});
