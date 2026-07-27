import {
  PRACTICE_MODES,
  emptyPracticeStats,
  normalizePracticeStats,
  practicePoolFor,
  updatePracticeStats,
} from "./practiceEngine.js";

export const PRACTICE_RECORDS_VERSION = 1;
export const PRACTICE_RECENT_TARGET_LIMIT = 4;

const MAX_COUNTER = 1_000_000;
const MAX_PERCENT_TOTAL = MAX_COUNTER * 100;

function cappedNumber(value, maximum = MAX_COUNTER) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 0;
  return Math.min(maximum, Math.max(0, number));
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

function recordFromStats(stats, recentTargets = [], lastPracticedAt = null) {
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
  };
}

export function emptyPracticeRecord() {
  return recordFromStats(emptyPracticeStats());
}

export function normalizePracticeRecord(value, mode = PRACTICE_MODES.CHARACTER_RX) {
  const source = value ?? {};
  return recordFromStats(
    source,
    recentTargetsFor(mode, source.recentTargets),
    validIsoDate(source.lastPracticedAt),
  );
}

export function emptyPracticeRecords() {
  return Object.fromEntries(Object.values(PRACTICE_MODES).map((mode) => [mode, emptyPracticeRecord()]));
}

export function normalizePracticeRecords(value) {
  const source = value ?? {};
  return Object.fromEntries(Object.values(PRACTICE_MODES).map((mode) => [mode, normalizePracticeRecord(source[mode], mode)]));
}

export function practiceStatsByMode(value) {
  const records = normalizePracticeRecords(value);
  return Object.fromEntries(Object.values(PRACTICE_MODES).map((mode) => [mode, normalizePracticeStats(records[mode])]));
}

export function recordPracticeAttempt(records, mode, result, practicedAt = new Date().toISOString()) {
  if (!Object.values(PRACTICE_MODES).includes(mode)) return normalizePracticeRecords(records);
  const normalized = normalizePracticeRecords(records);
  const current = normalized[mode];
  const nextStats = updatePracticeStats(current, result);
  const target = String(result?.target ?? "").trim().toUpperCase();
  const recentTargets = recentTargetsFor(mode, [...current.recentTargets, target]);
  return {
    ...normalized,
    [mode]: recordFromStats(nextStats, recentTargets, validIsoDate(practicedAt) ?? new Date().toISOString()),
  };
}
