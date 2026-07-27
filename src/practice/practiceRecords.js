import {
  PRACTICE_DIFFICULTIES,
  PRACTICE_MODES,
  emptyPracticeStats,
  normalizePracticeDifficulty,
  normalizePracticeLesson,
  normalizePracticeStats,
  practiceDifficultyProfile,
  practiceLessonCount,
  practicePoolFor,
  updatePracticeStats,
} from "./practiceEngine.js";

export const PRACTICE_RECORDS_VERSION = 2;
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

function recentTargetsFor(mode, value) {
  const pool = new Set(practicePoolFor(mode));
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

function recordFromStats(stats, recentTargets = [], lastPracticedAt = null, progress = null, mode = PRACTICE_MODES.CHARACTER_RX) {
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
  return recordFromStats(
    source,
    recentTargetsFor(mode, source.recentTargets),
    validIsoDate(source.lastPracticedAt),
    source,
    mode,
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
  const nextStats = updatePracticeStats(current, result);
  const nextProgress = advancePracticeProgress(current, mode, result);
  const target = String(result?.target ?? "").trim().toUpperCase();
  const recentTargets = recentTargetsFor(mode, [...current.recentTargets, target]);
  return {
    ...normalized,
    [mode]: recordFromStats(
      nextStats,
      recentTargets,
      validIsoDate(practicedAt) ?? new Date().toISOString(),
      nextProgress,
      mode,
    ),
  };
}
