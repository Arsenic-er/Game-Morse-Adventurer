import test from "node:test";
import assert from "node:assert/strict";
import {
  CHARACTER_POOL, PRACTICE_MODES, completePracticeSession, createPracticeBag, createPracticeSession,
  currentPracticeQuestion, emptyPracticeStats, evaluateReception, evaluateSending, normalizePracticeSession,
  normalizePracticeStats, practicePoolFor, practiceTargetFor, settlePracticeQuestion, summarizePracticeSession,
  updatePracticeStats,
} from "../src/practice/practiceEngine.js";

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
    schemaVersion: 1,
    mode: PRACTICE_MODES.PADDLE_TX,
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
  assert.equal(session.schemaVersion, 1);
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
