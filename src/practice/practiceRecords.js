import {
  PRACTICE_DIFFICULTIES,
  PRACTICE_MODES,
  PRACTICE_SESSION_TYPES,
  emptyPracticeStats,
  normalizePracticeDifficulty,
  normalizePracticeLesson,
  normalizePracticeStats,
  practiceDifficultyProfile,
  practiceLessonCount,
  practicePoolFor,
  updatePracticeStats,
} from "./practiceEngine.js";
import {
  PRACTICE_CALLSIGN_REGIONS,
  normalizePracticeCallsignRegion,
} from "./practiceCallsignCatalog.js";

export const PRACTICE_RECORDS_VERSION = 3;
export const PRACTICE_RECENT_TARGET_LIMIT = 4;

const MAX_COUNTER = 1_000_000;
const MAX_PERCENT_TOTAL = MAX_COUNTER * 100;

function cappedNumber(value, maximum = MAX_COUNTER) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 0;
  return Math.min(maximum, Math.max(0, number));
}

function cappedInteger(value, maximum = MAX_COUNTER) {
  return Math.trunc(cappedNumber(value, maximum));
}

function validIsoDate(value) {
  if (typeof value !== "string" || Number.isNaN(Date.parse(value))) return null;
  return new Date(value).toISOString();
}

function recentTargetsFor(mode, value, callsignRegion = PRACTICE_CALLSIGN_REGIONS.ALL) {
  const pool = new Set(practicePoolFor(mode, { callsignRegion }));
  if (!Array.isArray(value)) return [];
  return value
    .map((target) => String(target ?? "").trim().toUpperCase())
    .filter((target) => pool.has(target))
    .slice(-PRACTICE_RECENT_TARGET_LIMIT);
}

function normalizeProgress(value, mode) {
  const source = value ?? {};
  const difficulty = normalizePracticeDifficulty(source.difficulty);
  const lessonCount = practiceLessonCount(mode);
  const completedLessons = Math.min(lessonCount, cappedInteger(source.completedLessons, lessonCount));
  const lesson = completedLessons >= lessonCount ? lessonCount : completedLessons + 1;
  const profile = practiceDifficultyProfile(difficulty);
  const lessonAttempts = completedLessons >= lessonCount
    ? 0
    : Math.min(profile.requiredAttempts - 1, cappedInteger(source.lessonAttempts, profile.requiredAttempts - 1));
  const lessonCorrect = Math.min(lessonAttempts, cappedInteger(source.lessonCorrect, lessonAttempts));
  return { difficulty, lesson, lessonAttempts, lessonCorrect, completedLessons };
}

function recordFromStats(stats, recentTargets = [], lastPracticedAt = null, progress = null, mode = PRACTICE_MODES.CHARACTER_RX, callsignRegion = PRACTICE_CALLSIGN_REGIONS.ALL) {
  const normalized = normalizePracticeStats(stats);
  return {
    attempts: normalized.attempts,
    correct: normalized.correct,
    accuracyTotal: cappedNumber(normalized.accuracyTotal, MAX_PERCENT_TOTAL),
    accuracySamples: Math.trunc(cappedNumber(normalized.accuracySamples)),
    rhythmTotal: cappedNumber(normalized.rhythmTotal, MAX_PERCENT_TOTAL),
    rhythmSamples: Math.trunc(cappedNumber(normalized.rhythmSamples)),
    weaknesses: { ...normalized.weaknesses },
    recentTargets,
    lastPracticedAt,
    ...normalizeProgress(progress, mode),
    ...(mode === PRACTICE_MODES.CALLSIGN_RX
      ? { callsignRegion: normalizePracticeCallsignRegion(callsignRegion) }
      : {}),
  };
}

export function emptyPracticeRecord(mode = PRACTICE_MODES.CHARACTER_RX) {
  return recordFromStats(emptyPracticeStats(), [], null, {
    difficulty: PRACTICE_DIFFICULTIES.GUIDED,
    lesson: 1,
  }, mode);
}

export function normalizePracticeRecord(value, mode = PRACTICE_MODES.CHARACTER_RX) {
  const source = value ?? {};
  const callsignRegion = mode === PRACTICE_MODES.CALLSIGN_RX
    ? normalizePracticeCallsignRegion(source.callsignRegion)
    : PRACTICE_CALLSIGN_REGIONS.ALL;
  return recordFromStats(
    source,
    recentTargetsFor(mode, source.recentTargets, callsignRegion),
    validIsoDate(source.lastPracticedAt),
    source,
    mode,
    callsignRegion,
  );
}

export function emptyPracticeRecords() {
  return Object.fromEntries(Object.values(PRACTICE_MODES).map((mode) => [mode, emptyPracticeRecord(mode)]));
}

export function normalizePracticeRecords(value) {
  const source = value ?? {};
  return Object.fromEntries(Object.values(PRACTICE_MODES).map((mode) => [mode, normalizePracticeRecord(source[mode], mode)]));
}

export function practiceStatsByMode(value) {
  const records = normalizePracticeRecords(value);
  return Object.fromEntries(Object.values(PRACTICE_MODES).map((mode) => {
    const record = records[mode];
    return [mode, {
      ...normalizePracticeStats(record),
      recentTargets: [...record.recentTargets],
      difficulty: record.difficulty,
      lesson: record.lesson,
      lessonAttempts: record.lessonAttempts,
      lessonCorrect: record.lessonCorrect,
      completedLessons: record.completedLessons,
      ...(mode === PRACTICE_MODES.CALLSIGN_RX ? { callsignRegion: record.callsignRegion } : {}),
    }];
  }));
}

export function summarizePracticeProgress(value) {
  const records = normalizePracticeRecords(value);
  const modes = Object.fromEntries(Object.values(PRACTICE_MODES).map((mode) => {
    const totalLessons = practiceLessonCount(mode);
    const completedLessons = Math.min(totalLessons, records[mode].completedLessons);
    return [mode, {
      completedLessons,
      totalLessons,
      percent: totalLessons ? Math.round((completedLessons / totalLessons) * 100) : 0,
    }];
  }));
  const completedLessons = Object.values(modes).reduce((total, mode) => total + mode.completedLessons, 0);
  const totalLessons = Object.values(modes).reduce((total, mode) => total + mode.totalLessons, 0);
  return {
    completedLessons,
    totalLessons,
    percent: totalLessons ? Math.round((completedLessons / totalLessons) * 100) : 0,
    modes,
  };
}

export function practiceWeakTargets(record, mode = PRACTICE_MODES.CHARACTER_RX, options = {}) {
  const current = normalizePracticeRecord(record, mode);
  const requestedLesson = normalizePracticeLesson(options?.lesson ?? current.lesson, mode);
  const lesson = Math.min(current.lesson, requestedLesson);
  const limit = Math.min(5, cappedInteger(options?.limit ?? 5, 5));
  if (!limit) return [];
  return practicePoolFor(mode, { lesson, callsignRegion: current.callsignRegion })
    .map((target, index) => ({
      target,
      misses: [...target].reduce((total, character) => total + (current.weaknesses[character] ?? 0), 0),
      index,
    }))
    .filter(({ misses }) => misses > 0)
    .sort((left, right) => right.misses - left.misses || left.index - right.index)
    .slice(0, limit)
    .map(({ target, misses }) => ({ target, misses }));
}

export function updatePracticePreference(records, mode, preferences = {}) {
  const normalized = normalizePracticeRecords(records);
  if (mode !== PRACTICE_MODES.CALLSIGN_RX) return normalized;
  const current = normalized[PRACTICE_MODES.CALLSIGN_RX];
  const callsignRegion = normalizePracticeCallsignRegion(preferences?.callsignRegion ?? current.callsignRegion);
  if (callsignRegion === current.callsignRegion) return normalized;
  return {
    ...normalized,
    [PRACTICE_MODES.CALLSIGN_RX]: {
      ...current,
      callsignRegion,
      recentTargets: [],
    },
  };
}

export function practiceLessonPlan(record, mode, difficulty, lesson) {
  const current = normalizePracticeRecord(record, mode);
  const selectedDifficulty = normalizePracticeDifficulty(difficulty ?? current.difficulty);
  const selectedLesson = normalizePracticeLesson(lesson ?? current.lesson, mode);
  const profile = practiceDifficultyProfile(selectedDifficulty);
  const eligible = selectedLesson === current.lesson
    && current.completedLessons < practiceLessonCount(mode);
  const continuing = eligible && selectedDifficulty === current.difficulty;
  const baselineAttempts = continuing ? current.lessonAttempts : 0;
  const baselineCorrect = continuing ? current.lessonCorrect : 0;
  return {
    difficulty: selectedDifficulty,
    lesson: selectedLesson,
    eligible,
    completedLessons: current.completedLessons,
    baselineAttempts,
    baselineCorrect,
    questionLimit: Math.max(1, profile.requiredAttempts - baselineAttempts),
    requiredAttempts: profile.requiredAttempts,
    requiredAccuracy: profile.requiredAccuracy,
  };
}

export function practiceMasteryFeedback(record, mode = PRACTICE_MODES.CHARACTER_RX, selection = {}) {
  const current = normalizePracticeRecord(record, mode);
  const lessonCount = practiceLessonCount(mode);
  const difficulty = normalizePracticeDifficulty(selection?.difficulty ?? current.difficulty);
  const lesson = normalizePracticeLesson(selection?.lesson ?? current.lesson, mode);
  const profile = practiceDifficultyProfile(difficulty);
  const curriculumCompleted = current.completedLessons >= lessonCount;
  const progressionEligible = !curriculumCompleted && lesson === current.lesson;
  const continuingBlock = progressionEligible && difficulty === current.difficulty;
  const blockAttempts = continuingBlock ? current.lessonAttempts : 0;
  const blockCorrect = continuingBlock ? current.lessonCorrect : 0;
  const blockAccuracy = blockAttempts ? Math.round((blockCorrect / blockAttempts) * 100) : 0;
  const requiredCorrect = Math.ceil((profile.requiredAttempts * profile.requiredAccuracy) / 100);
  const attemptsRemaining = progressionEligible ? Math.max(0, profile.requiredAttempts - blockAttempts) : 0;
  const correctNeeded = progressionEligible ? Math.max(0, requiredCorrect - blockCorrect) : 0;
  const canStillPass = progressionEligible && blockCorrect + attemptsRemaining >= requiredCorrect;
  const thresholdSecured = progressionEligible && correctNeeded === 0;
  let status = "not-started";
  if (curriculumCompleted) status = "completed";
  else if (!progressionEligible) status = "replay";
  else if (!canStillPass) status = "cannot-pass";
  else if (thresholdSecured) status = "threshold-secured";
  else if (blockAttempts > 0) status = "in-progress";

  return {
    mode: Object.values(PRACTICE_MODES).includes(mode) ? mode : PRACTICE_MODES.CHARACTER_RX,
    difficulty,
    lesson,
    lessonCount,
    completedLessons: current.completedLessons,
    curriculumCompleted,
    progressionEligible,
    blockAttempts,
    blockCorrect,
    blockAccuracy,
    requiredAttempts: profile.requiredAttempts,
    requiredAccuracy: profile.requiredAccuracy,
    requiredCorrect,
    attemptsRemaining,
    correctNeeded,
    canStillPass,
    thresholdSecured,
    status,
  };
}

export function advancePracticeProgress(record, mode, result) {
  const current = normalizePracticeRecord(record, mode);
  const difficulty = normalizePracticeDifficulty(result?.difficulty ?? current.difficulty);
  const difficultyChanged = difficulty !== current.difficulty;
  const profile = practiceDifficultyProfile(difficulty);
  const lessonCount = practiceLessonCount(mode);
  if (current.completedLessons >= lessonCount) return { ...current, difficulty };

  const resultLesson = result?.lesson === null || result?.lesson === undefined
    ? current.lesson
    : normalizePracticeLesson(result.lesson, mode);
  if (resultLesson !== current.lesson) {
    return difficultyChanged
      ? { ...current, difficulty, lessonAttempts: 0, lessonCorrect: 0 }
      : current;
  }

  const lessonAttempts = (difficultyChanged ? 0 : current.lessonAttempts) + 1;
  const lessonCorrect = (difficultyChanged ? 0 : current.lessonCorrect) + (result?.correct ? 1 : 0);
  if (lessonAttempts < profile.requiredAttempts) {
    return { ...current, difficulty, lessonAttempts, lessonCorrect };
  }

  const passed = (lessonCorrect / lessonAttempts) * 100 >= profile.requiredAccuracy;
  if (!passed) return { ...current, difficulty, lessonAttempts: 0, lessonCorrect: 0 };
  const completedLessons = Math.min(lessonCount, Math.max(current.completedLessons, current.lesson));
  return {
    ...current,
    difficulty,
    lesson: Math.min(lessonCount, current.lesson + 1),
    lessonAttempts: 0,
    lessonCorrect: 0,
    completedLessons,
  };
}

export function recordPracticeAttempt(records, mode, result, practicedAt = new Date().toISOString()) {
  if (!Object.values(PRACTICE_MODES).includes(mode)) return normalizePracticeRecords(records);
  const normalized = normalizePracticeRecords(records);
  const current = normalized[mode];
  const callsignRegion = mode === PRACTICE_MODES.CALLSIGN_RX
    ? normalizePracticeCallsignRegion(result?.callsignRegion ?? current.callsignRegion)
    : PRACTICE_CALLSIGN_REGIONS.ALL;
  const nextStats = updatePracticeStats(current, result);
  const nextProgress = result?.sessionType === PRACTICE_SESSION_TYPES.WEAKNESS_REVIEW
    ? current
    : advancePracticeProgress(current, mode, result);
  const target = String(result?.target ?? "").trim().toUpperCase();
  const previousTargets = mode === PRACTICE_MODES.CALLSIGN_RX && callsignRegion !== current.callsignRegion
    ? []
    : current.recentTargets;
  const recentTargets = recentTargetsFor(mode, [...previousTargets, target], callsignRegion);
  return {
    ...normalized,
    [mode]: recordFromStats(
      nextStats,
      recentTargets,
      validIsoDate(practicedAt) ?? new Date().toISOString(),
      nextProgress,
      mode,
      callsignRegion,
    ),
  };
}
