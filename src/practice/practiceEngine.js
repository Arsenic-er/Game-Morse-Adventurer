import { normalizeCwText } from "../cw/morse.js";

export const PRACTICE_MODES = Object.freeze({
  CHARACTER_RX: "character-rx",
  CALLSIGN_RX: "callsign-rx",
  MANUAL_TX: "manual-tx",
  PADDLE_TX: "paddle-tx",
});

export const PRACTICE_DIFFICULTIES = Object.freeze({
  GUIDED: "guided",
  STANDARD: "standard",
  CHALLENGE: "challenge",
});

export const PRACTICE_SESSION_TYPES = Object.freeze({
  LESSON: "lesson",
  WEAKNESS_REVIEW: "weakness-review",
});

export const WEAKNESS_REVIEW_QUESTION_LIMIT = 5;

export const PRACTICE_DIFFICULTY_PROFILES = Object.freeze({
  [PRACTICE_DIFFICULTIES.GUIDED]: Object.freeze({
    id: PRACTICE_DIFFICULTIES.GUIDED,
    characterRxWpm: 10,
    callsignRxWpm: 12,
    requiredAttempts: 5,
    requiredAccuracy: 80,
  }),
  [PRACTICE_DIFFICULTIES.STANDARD]: Object.freeze({
    id: PRACTICE_DIFFICULTIES.STANDARD,
    characterRxWpm: 14,
    callsignRxWpm: 16,
    requiredAttempts: 8,
    requiredAccuracy: 85,
  }),
  [PRACTICE_DIFFICULTIES.CHALLENGE]: Object.freeze({
    id: PRACTICE_DIFFICULTIES.CHALLENGE,
    characterRxWpm: 18,
    callsignRxWpm: 20,
    requiredAttempts: 10,
    requiredAccuracy: 90,
  }),
});

export const CHARACTER_POOL = Object.freeze(["A", "N", "T", "E", "I", "M", "S", "O", "R", "K", "D", "U", "G", "W", "Q", "7", "3", "5"]);
export const FICTIONAL_CALLSIGNS = Object.freeze(["SIM7QX", "SIM3RA", "SIM9AK", "SIM5TU", "SIM2DX", "SIM8CW", "SIM4NZ", "SIM6JP"]);

export const PRACTICE_LESSONS = Object.freeze([
  Object.freeze(["A", "N", "T", "E"]),
  Object.freeze(["I", "M", "S", "O"]),
  Object.freeze(["R", "K", "D", "U"]),
  Object.freeze(["G", "W", "Q"]),
  Object.freeze(["7", "3", "5"]),
]);

const PRACTICE_SESSION_SCHEMA_VERSION = 2;
const DEFAULT_QUEUE_SEED = "cw-practice-v1";
const MAX_SETTLED_ATTEMPT_IDS = 256;
const MAX_COUNTER = 1_000_000;

function finiteNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function clampPercent(value, fallback = 0) {
  return Math.min(100, Math.max(0, finiteNumber(value, fallback)));
}

function nonNegativeInteger(value, fallback = 0, maximum = Number.MAX_SAFE_INTEGER) {
  return Math.min(maximum, Math.max(0, Math.trunc(finiteNumber(value, fallback))));
}

function normalizeWeaknesses(value) {
  const normalized = {};
  Object.entries(value ?? {}).forEach(([rawCharacter, rawCount]) => {
    const character = normalizeCwText(rawCharacter).replace(/\s/g, "");
    const count = nonNegativeInteger(rawCount, 0, MAX_COUNTER);
    if (/^[A-Z0-9]$/.test(character) && count > 0) normalized[character] = count;
  });
  return normalized;
}

function recoverTargetWeakness(weaknesses, target) {
  const normalized = { ...normalizeWeaknesses(weaknesses) };
  const characters = [...new Set([...normalizeCwText(target).replace(/\s/g, '')])]
    .filter((character) => /^[A-Z0-9]$/.test(character) && normalized[character] > 0);
  let recoveredCharacter = null;
  characters.forEach((character) => {
    if (recoveredCharacter === null || normalized[character] > normalized[recoveredCharacter]) {
      recoveredCharacter = character;
    }
  });
  if (recoveredCharacter === null) return normalized;
  if (normalized[recoveredCharacter] <= 1) delete normalized[recoveredCharacter];
  else normalized[recoveredCharacter] -= 1;
  return normalized;
}

function normalizeAttemptIds(value) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map((id) => String(id ?? "").trim().slice(0, 160)).filter(Boolean))].slice(-MAX_SETTLED_ATTEMPT_IDS);
}

export function emptyPracticeStats() {
  return {
    attempts: 0,
    correct: 0,
    accuracy: 0,
    accuracyTotal: 0,
    accuracySamples: 0,
    averageAccuracy: 0,
    rhythmTotal: 0,
    rhythmSamples: 0,
    averageRhythm: 0,
    weaknesses: {},
    settledAttemptIds: [],
  };
}

export function normalizePracticeStats(value) {
  const source = value ?? {};
  const attempts = nonNegativeInteger(source.attempts, 0, MAX_COUNTER);
  const correct = Math.min(attempts, nonNegativeInteger(source.correct, 0, MAX_COUNTER));
  const accuracySamples = nonNegativeInteger(source.accuracySamples, attempts, MAX_COUNTER);
  const legacyAverageAccuracy = clampPercent(source.averageAccuracy, clampPercent(source.accuracy));
  const accuracyTotal = accuracySamples
    ? Math.min(accuracySamples * 100, Math.max(0, finiteNumber(source.accuracyTotal, legacyAverageAccuracy * accuracySamples)))
    : 0;
  const rhythmSamples = nonNegativeInteger(source.rhythmSamples, 0, MAX_COUNTER);
  const rhythmTotal = rhythmSamples
    ? Math.min(rhythmSamples * 100, Math.max(0, finiteNumber(source.rhythmTotal, clampPercent(source.averageRhythm) * rhythmSamples)))
    : 0;
  return {
    attempts,
    correct,
    accuracy: attempts ? Math.round((correct / attempts) * 100) : 0,
    accuracyTotal,
    accuracySamples,
    averageAccuracy: accuracySamples ? Math.round(accuracyTotal / accuracySamples) : 0,
    rhythmTotal,
    rhythmSamples,
    averageRhythm: rhythmSamples ? Math.round(rhythmTotal / rhythmSamples) : 0,
    weaknesses: normalizeWeaknesses(source.weaknesses),
    settledAttemptIds: normalizeAttemptIds(source.settledAttemptIds),
  };
}

export function isReceptionMode(mode) {
  return mode === PRACTICE_MODES.CHARACTER_RX || mode === PRACTICE_MODES.CALLSIGN_RX;
}

export function isSendingMode(mode) {
  return mode === PRACTICE_MODES.MANUAL_TX || mode === PRACTICE_MODES.PADDLE_TX;
}

function normalizeMode(mode) {
  return Object.values(PRACTICE_MODES).includes(mode) ? mode : PRACTICE_MODES.CHARACTER_RX;
}

function normalizeSessionType(value) {
  return Object.values(PRACTICE_SESSION_TYPES).includes(value) ? value : PRACTICE_SESSION_TYPES.LESSON;
}

export function normalizePracticeDifficulty(value) {
  return Object.values(PRACTICE_DIFFICULTIES).includes(value) ? value : PRACTICE_DIFFICULTIES.GUIDED;
}

export function practiceDifficultyProfile(value) {
  return PRACTICE_DIFFICULTY_PROFILES[normalizePracticeDifficulty(value)];
}

export function practiceLessonCount(mode) {
  return normalizeMode(mode) === PRACTICE_MODES.CALLSIGN_RX ? 4 : PRACTICE_LESSONS.length;
}

export function normalizePracticeLesson(value, mode) {
  return Math.min(practiceLessonCount(mode), Math.max(1, nonNegativeInteger(value, 1)));
}

export function practiceReceiveWpm(difficulty, mode) {
  const profile = practiceDifficultyProfile(difficulty);
  return normalizeMode(mode) === PRACTICE_MODES.CALLSIGN_RX ? profile.callsignRxWpm : profile.characterRxWpm;
}

function weakestCharacter(weaknesses) {
  return Object.entries(normalizeWeaknesses(weaknesses))
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))[0]?.[0];
}

export function practicePoolFor(mode, options = {}) {
  const normalizedMode = normalizeMode(mode);
  const requestedLesson = typeof options === "number" ? options : options?.lesson;
  if (requestedLesson === null || requestedLesson === undefined) {
    if (normalizedMode === PRACTICE_MODES.CALLSIGN_RX) return [...FICTIONAL_CALLSIGNS];
    if (normalizedMode === PRACTICE_MODES.MANUAL_TX) return [...CHARACTER_POOL, "SIM7QX"];
    if (normalizedMode === PRACTICE_MODES.PADDLE_TX) return [...CHARACTER_POOL, "SIM3RA"];
    return [...CHARACTER_POOL];
  }

  const lesson = normalizePracticeLesson(requestedLesson, normalizedMode);
  if (normalizedMode === PRACTICE_MODES.CALLSIGN_RX) return FICTIONAL_CALLSIGNS.slice(0, lesson * 2);
  const allowedCharacters = new Set(PRACTICE_LESSONS.slice(0, lesson).flat());
  const pool = CHARACTER_POOL.filter((character) => allowedCharacters.has(character));
  if (lesson === PRACTICE_LESSONS.length && normalizedMode === PRACTICE_MODES.MANUAL_TX) pool.push("SIM7QX");
  if (lesson === PRACTICE_LESSONS.length && normalizedMode === PRACTICE_MODES.PADDLE_TX) pool.push("SIM3RA");
  return pool;
}

export function practiceLessonContent(mode, lesson = 1) {
  const normalizedMode = normalizeMode(mode);
  const normalizedLesson = normalizePracticeLesson(lesson, normalizedMode);
  const targetPool = practicePoolFor(normalizedMode, { lesson: normalizedLesson });
  const reviewTargets = normalizedLesson > 1
    ? practicePoolFor(normalizedMode, { lesson: normalizedLesson - 1 })
    : [];
  const reviewSet = new Set(reviewTargets);
  return {
    mode: normalizedMode,
    lesson: normalizedLesson,
    lessonCount: practiceLessonCount(normalizedMode),
    introducedTargets: targetPool.filter((target) => !reviewSet.has(target)),
    reviewTargets,
    targetPool,
  };
}

export function normalizePracticeTargetPool(mode, value, lesson = null) {
  const normalizedMode = normalizeMode(mode);
  const allowed = new Set(practicePoolFor(normalizedMode, { lesson }));
  if (!Array.isArray(value)) return [...allowed];
  return [...new Set(value
    .map((target) => normalizeCwText(target).replace(/\s/g, ""))
    .filter((target) => allowed.has(target)))];
}

function hashSeed(value) {
  let hash = 2166136261;
  for (const character of String(value)) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function seededRandom(seed) {
  let state = hashSeed(seed);
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function swapToFront(items, target, position = 0) {
  const targetIndex = items.indexOf(target);
  if (targetIndex < 0 || targetIndex === position) return items;
  [items[position], items[targetIndex]] = [items[targetIndex], items[position]];
  return items;
}

function normalizeRecentTargets(value, pool) {
  if (!Array.isArray(value)) return [];
  return value
    .map((target) => normalizeCwText(target).replace(/\s/g, ""))
    .filter((target) => pool.includes(target))
    .slice(-4);
}

function avoidRecentBoundary(items, recentTargets) {
  const recent = new Set(recentTargets);
  if (!recent.size || items.length < 2 || !recent.has(items[0])) return items;
  const replacementIndex = items.findIndex((target) => !recent.has(target));
  if (replacementIndex > 0) [items[0], items[replacementIndex]] = [items[replacementIndex], items[0]];
  return items;
}

function scheduledWeakness(items, weaknesses, globalIndex) {
  const weak = weakestCharacter(weaknesses);
  const weakIndex = items.indexOf(weak);
  if (weakIndex < 0) return items;
  const safeGlobalIndex = nonNegativeInteger(globalIndex);
  const nextScheduledIndex = safeGlobalIndex === 0 ? 3 : Math.ceil(safeGlobalIndex / 3) * 3;
  const queueIndex = nextScheduledIndex - safeGlobalIndex;
  if (queueIndex >= items.length) return items;
  return swapToFront(items, weak, queueIndex);
}

export function createPracticeBag({ mode, difficulty = PRACTICE_DIFFICULTIES.GUIDED, lesson = null, targetPool, bagIndex = 0, seed = DEFAULT_QUEUE_SEED, weaknesses = {}, previousTarget = "", previousTargets = [], recentTargets = [], globalIndex = 0 } = {}) {
  const normalizedMode = normalizeMode(mode);
  const normalizedDifficulty = normalizePracticeDifficulty(difficulty);
  const items = normalizePracticeTargetPool(normalizedMode, targetPool, lesson);
  const random = seededRandom(`${seed}:${normalizedMode}:${normalizedDifficulty}:${lesson ?? "full"}:${nonNegativeInteger(bagIndex)}`);
  for (let index = items.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [items[index], items[swapIndex]] = [items[swapIndex], items[index]];
  }

  // Preserve the original first lesson while later bags remain fully shuffled.
  if (nonNegativeInteger(bagIndex) === 0 && normalizedMode !== PRACTICE_MODES.CALLSIGN_RX) swapToFront(items, "A");
  scheduledWeakness(items, weaknesses, nonNegativeInteger(globalIndex));
  const recent = normalizeRecentTargets([...previousTargets, ...recentTargets, previousTarget], items);
  avoidRecentBoundary(items, recent);
  return items;
}

function bagAt(mode, bagIndex, seed, weaknesses, difficulty = PRACTICE_DIFFICULTIES.GUIDED, lesson = null, targetPool) {
  let recentTargets = [];
  let bag = [];
  const poolSize = normalizePracticeTargetPool(mode, targetPool, lesson).length;
  for (let currentBag = 0; currentBag <= bagIndex; currentBag += 1) {
    bag = createPracticeBag({
      mode,
      bagIndex: currentBag,
      seed,
      difficulty,
      lesson,
      targetPool,
      weaknesses,
      recentTargets,
      globalIndex: currentBag * poolSize,
    });
    recentTargets = [...recentTargets, ...bag].slice(-4);
  }
  return bag;
}

export function practiceTargetFor(mode, index = 0, weaknesses = {}, seed = DEFAULT_QUEUE_SEED, lesson = null) {
  const normalizedMode = normalizeMode(mode);
  const safeIndex = nonNegativeInteger(index);
  const poolSize = practicePoolFor(normalizedMode, { lesson }).length;
  const bagIndex = Math.floor(safeIndex / poolSize);
  const localIndex = safeIndex % poolSize;
  return bagAt(normalizedMode, bagIndex, seed, weaknesses, PRACTICE_DIFFICULTIES.GUIDED, lesson)[localIndex];
}

export function evaluateReception(answer, target) {
  const normalizedAnswer = normalizeCwText(answer).replace(/\s/g, "");
  const normalizedTarget = normalizeCwText(target).replace(/\s/g, "");
  const correct = normalizedAnswer === normalizedTarget;
  const missed = [];
  if (!correct) {
    [...normalizedTarget].forEach((character, index) => {
      if (normalizedAnswer[index] !== character) missed.push(character);
    });
  }
  return { answer: normalizedAnswer, target: normalizedTarget, correct, accuracy: correct ? 100 : 0, rhythm: null, missed };
}

export function evaluateSending(analysis, target) {
  const normalizedTarget = normalizeCwText(target).replace(/\s/g, "");
  const normalizedDecoded = normalizeCwText(analysis?.decoded).replace(/\s/g, "");
  const correct = normalizedDecoded === normalizedTarget;
  const missed = correct ? [] : [...normalizedTarget].filter((character, index) => normalizedDecoded[index] !== character);
  return {
    answer: normalizedDecoded,
    target: normalizedTarget,
    correct,
    accuracy: clampPercent(analysis?.accuracy),
    rhythm: clampPercent(analysis?.rhythm),
    missed,
  };
}

export function updatePracticeStats(stats, result) {
  const current = normalizePracticeStats(stats);
  const attemptId = String(result?.attemptId ?? result?.questionId ?? result?.id ?? "").trim();
  if (attemptId && current.settledAttemptIds.includes(attemptId)) return current;

  const attempts = Math.min(MAX_COUNTER, current.attempts + 1);
  const correct = Math.min(attempts, current.correct + (result?.correct ? 1 : 0));
  const weaknesses = result?.correct && result?.sessionType === PRACTICE_SESSION_TYPES.WEAKNESS_REVIEW
    ? recoverTargetWeakness(current.weaknesses, result?.target)
    : { ...current.weaknesses };
  (result?.correct ? [] : result?.missed ?? []).forEach((rawCharacter) => {
    const characters = normalizeCwText(rawCharacter).replace(/\s/g, "");
    [...characters].forEach((character) => {
      if (/^[A-Z0-9]$/.test(character)) weaknesses[character] = Math.min(MAX_COUNTER, (weaknesses[character] ?? 0) + 1);
    });
  });
  const hasAccuracy = Number.isFinite(Number(result?.accuracy)) && current.accuracySamples < MAX_COUNTER;
  const accuracyTotal = current.accuracyTotal + (hasAccuracy ? clampPercent(result.accuracy) : 0);
  const accuracySamples = current.accuracySamples + (hasAccuracy ? 1 : 0);
  const hasRhythm = result?.rhythm !== null && result?.rhythm !== undefined
    && Number.isFinite(Number(result.rhythm)) && current.rhythmSamples < MAX_COUNTER;
  const rhythmTotal = current.rhythmTotal + (hasRhythm ? clampPercent(result.rhythm) : 0);
  const rhythmSamples = current.rhythmSamples + (hasRhythm ? 1 : 0);
  return {
    attempts,
    correct,
    accuracy: Math.round((correct / attempts) * 100),
    accuracyTotal,
    accuracySamples,
    averageAccuracy: accuracySamples ? Math.round(accuracyTotal / accuracySamples) : 0,
    rhythmTotal,
    rhythmSamples,
    averageRhythm: rhythmSamples ? Math.round(rhythmTotal / rhythmSamples) : 0,
    weaknesses,
    settledAttemptIds: attemptId ? [...current.settledAttemptIds, attemptId].slice(-MAX_SETTLED_ATTEMPT_IDS) : current.settledAttemptIds,
  };
}

function normalizeIsoDate(value, fallback = null) {
  if (typeof value !== "string" || Number.isNaN(Date.parse(value))) return fallback;
  return new Date(value).toISOString();
}

function questionIdFor(session) {
  return `${session.sessionId}:${session.questionIndex}`;
}

export function normalizePracticeSession(value = {}, fallback = {}) {
  const source = value ?? {};
  const mode = normalizeMode(source.mode ?? fallback.mode);
  const difficulty = normalizePracticeDifficulty(source.difficulty ?? fallback.difficulty);
  const lessonSource = source.lesson ?? fallback.lesson;
  const lesson = lessonSource === null || lessonSource === undefined ? null : normalizePracticeLesson(lessonSource, mode);
  const targetPoolSource = source.targetPool ?? fallback.targetPool;
  const requestedSessionType = normalizeSessionType(source.sessionType ?? fallback.sessionType
    ?? (Array.isArray(targetPoolSource) ? PRACTICE_SESSION_TYPES.WEAKNESS_REVIEW : PRACTICE_SESSION_TYPES.LESSON));
  const customTargetPool = Array.isArray(targetPoolSource)
    ? normalizePracticeTargetPool(mode, targetPoolSource, lesson)
    : [];
  const sessionType = requestedSessionType === PRACTICE_SESSION_TYPES.WEAKNESS_REVIEW && customTargetPool.length
    ? PRACTICE_SESSION_TYPES.WEAKNESS_REVIEW
    : PRACTICE_SESSION_TYPES.LESSON;
  const seed = String(source.seed ?? fallback.seed ?? DEFAULT_QUEUE_SEED).slice(0, 64) || DEFAULT_QUEUE_SEED;
  const stats = normalizePracticeStats(source.stats);
  const questionIndex = nonNegativeInteger(source.questionIndex, stats.attempts);
  const pool = sessionType === PRACTICE_SESSION_TYPES.WEAKNESS_REVIEW
    ? customTargetPool
    : practicePoolFor(mode, { lesson });
  const inferredBagIndex = Math.floor(questionIndex / pool.length);
  const bagIndex = nonNegativeInteger(source.bagIndex, inferredBagIndex);
  const suppliedQueue = Array.isArray(source.queue)
    ? source.queue.map((target) => normalizeCwText(target).replace(/\s/g, "")).filter((target, index, list) => pool.includes(target) && list.indexOf(target) === index)
    : [];
  const previousTarget = normalizeCwText(source.lastTarget).replace(/\s/g, "");
  const recentTargets = normalizeRecentTargets(source.recentTargets ?? fallback.recentTargets ?? [previousTarget], pool);
  const generatedQueue = createPracticeBag({ mode, difficulty, lesson, targetPool: pool, bagIndex, seed, weaknesses: stats.weaknesses, recentTargets, globalIndex: questionIndex });
  const queue = suppliedQueue.length ? suppliedQueue : generatedQueue.slice(questionIndex % pool.length);
  const startedAt = normalizeIsoDate(source.startedAt, normalizeIsoDate(fallback.startedAt, new Date(0).toISOString()));
  const sessionId = String(source.sessionId ?? fallback.sessionId ?? `${mode}:${startedAt}:${seed}`).trim().slice(0, 160);
  return {
    schemaVersion: PRACTICE_SESSION_SCHEMA_VERSION,
    mode,
    sessionType,
    difficulty,
    lesson,
    targetPool: sessionType === PRACTICE_SESSION_TYPES.WEAKNESS_REVIEW ? [...pool] : null,
    seed,
    sessionId,
    startedAt,
    completedAt: normalizeIsoDate(source.completedAt),
    questionLimit: sessionType === PRACTICE_SESSION_TYPES.WEAKNESS_REVIEW
      ? WEAKNESS_REVIEW_QUESTION_LIMIT
      : source.questionLimit === null || source.questionLimit === undefined ? null : Math.max(1, nonNegativeInteger(source.questionLimit, 1)),
    questionIndex,
    bagIndex,
    queue: queue.length ? queue : generatedQueue,
    lastTarget: previousTarget,
    recentTargets,
    stats,
  };
}

export function createPracticeSession({ mode = PRACTICE_MODES.CHARACTER_RX, sessionType, difficulty = PRACTICE_DIFFICULTIES.GUIDED, lesson = null, targetPool, seed = DEFAULT_QUEUE_SEED, startedAt = new Date().toISOString(), weaknesses = {}, questionLimit = null, recentTargets = [], previousTargets = [] } = {}) {
  const stats = { ...emptyPracticeStats(), weaknesses: normalizeWeaknesses(weaknesses) };
  return normalizePracticeSession({ mode, sessionType, difficulty, lesson, targetPool, seed, startedAt, questionLimit, recentTargets: [...previousTargets, ...recentTargets], stats, questionIndex: 0, bagIndex: 0 });
}

export function createWeaknessReviewSession({ mode = PRACTICE_MODES.CHARACTER_RX, targetPool = [], ...options } = {}) {
  const normalizedPool = normalizePracticeTargetPool(mode, targetPool, options.lesson ?? null);
  if (!normalizedPool.length) return null;
  return createPracticeSession({
    ...options,
    mode,
    sessionType: PRACTICE_SESSION_TYPES.WEAKNESS_REVIEW,
    targetPool: normalizedPool,
    questionLimit: WEAKNESS_REVIEW_QUESTION_LIMIT,
  });
}

export function currentPracticeQuestion(session) {
  const normalized = normalizePracticeSession(session);
  if (normalized.completedAt) return null;
  return {
    id: questionIdFor(normalized),
    index: normalized.questionIndex,
    target: normalized.queue[0],
    mode: normalized.mode,
    sessionType: normalized.sessionType,
    progressionEligible: normalized.sessionType === PRACTICE_SESSION_TYPES.LESSON,
  };
}

export function settlePracticeQuestion(session, questionId, result, settledAt = new Date().toISOString()) {
  const current = normalizePracticeSession(session);
  const activeQuestion = currentPracticeQuestion(current);
  if (!activeQuestion || String(questionId) !== activeQuestion.id || current.stats.settledAttemptIds.includes(activeQuestion.id)) return current;

  const stats = updatePracticeStats(current.stats, {
    ...result,
    target: activeQuestion.target,
    sessionType: current.sessionType,
    attemptId: activeQuestion.id,
  });
  const questionIndex = current.questionIndex + 1;
  const recentTargets = [...current.recentTargets, activeQuestion.target].slice(-4);
  let bagIndex = current.bagIndex;
  let queue = current.queue.slice(1);
  if (!queue.length) {
    bagIndex += 1;
    queue = createPracticeBag({
      mode: current.mode,
      difficulty: current.difficulty,
      lesson: current.lesson,
      targetPool: current.targetPool ?? undefined,
      bagIndex,
      seed: current.seed,
      weaknesses: stats.weaknesses,
      recentTargets,
      globalIndex: questionIndex,
    });
  } else {
    scheduledWeakness(queue, stats.weaknesses, questionIndex);
  }
  const reachedLimit = current.questionLimit !== null && stats.attempts >= current.questionLimit;
  return {
    ...current,
    completedAt: reachedLimit ? normalizeIsoDate(settledAt, new Date().toISOString()) : current.completedAt,
    questionIndex,
    bagIndex,
    queue,
    lastTarget: activeQuestion.target,
    recentTargets,
    stats,
  };
}

export function completePracticeSession(session, completedAt = new Date().toISOString()) {
  const current = normalizePracticeSession(session);
  if (current.completedAt) return current;
  return { ...current, completedAt: normalizeIsoDate(completedAt, new Date().toISOString()) };
}

export function summarizePracticeSession(session) {
  const current = normalizePracticeSession(session);
  const stats = current.stats;
  const profile = practiceDifficultyProfile(current.difficulty);
  const progressionEligible = current.sessionType === PRACTICE_SESSION_TYPES.LESSON;
  const lessonPassed = progressionEligible && stats.attempts >= profile.requiredAttempts
    && stats.accuracy >= profile.requiredAccuracy;
  const lessonCount = practiceLessonCount(current.mode);
  const nextLesson = current.lesson === null
    ? null
    : Math.min(lessonCount, current.lesson + (lessonPassed ? 1 : 0));
  const weakCharacters = Object.entries(stats.weaknesses)
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .map(([character, misses]) => ({ character, misses }));
  return {
    schemaVersion: PRACTICE_SESSION_SCHEMA_VERSION,
    mode: current.mode,
    sessionType: current.sessionType,
    progressionEligible,
    targetPool: current.targetPool ? [...current.targetPool] : null,
    difficulty: current.difficulty,
    lesson: current.lesson,
    lessonCount,
    requiredAttempts: profile.requiredAttempts,
    requiredAccuracy: profile.requiredAccuracy,
    lessonPassed,
    nextLesson,
    nextLessonUnlocked: lessonPassed && current.lesson !== null && current.lesson < lessonCount,
    curriculumCompleted: lessonPassed && current.lesson === lessonCount,
    questionCount: stats.attempts,
    correctCount: stats.correct,
    averageAccuracy: stats.averageAccuracy,
    averageRhythm: stats.averageRhythm,
    weaknesses: { ...stats.weaknesses },
    weakCharacters,
    startedAt: current.startedAt,
    completedAt: current.completedAt,
  };
}
