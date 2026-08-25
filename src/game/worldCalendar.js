export const WORLD_CALENDAR_VERSION = 1;
export const LIGHTS_ANNUAL_MONTH = 5;
export const LIGHTS_ANNUAL_FIRST_DAY = 1;
export const LIGHTS_ANNUAL_LAST_DAY = 7;
export const LIGHTS_SPECIAL_DAY = 5;
export const CLOCK_ROLLBACK_TOLERANCE_MS = 5 * 60 * 1000;

const MAX_ANNUAL_RECORDS = 20;
const MAX_ANNUAL_SCORE = 999;
const GRADE_RANK = Object.freeze({ none: 0, base: 1, silver: 2, gold: 3 });

function validDate(value) {
  if (value == null || value === "") return null;
  const date = value instanceof Date ? new Date(value.getTime()) : new Date(value);
  return Number.isFinite(date.getTime()) ? date : null;
}

function normalizeIso(value) {
  return validDate(value)?.toISOString() ?? null;
}

function normalizeScore(value) {
  const score = Number(value);
  return Number.isFinite(score) ? Math.min(MAX_ANNUAL_SCORE, Math.max(0, Math.floor(score))) : 0;
}

function normalizeGrade(value) {
  return Object.hasOwn(GRADE_RANK, value) ? value : "none";
}

function normalizeAnnualRecord(value) {
  const year = Number(value?.year);
  if (!Number.isInteger(year) || year < 1970 || year > 9999) return null;
  return {
    year,
    rewardClaimed: value?.rewardClaimed === true,
    bestScore: normalizeScore(value?.bestScore),
    bestGrade: normalizeGrade(value?.bestGrade),
  };
}

export function emptyWorldCalendarState() {
  return {
    version: WORLD_CALENDAR_VERSION,
    lastTrustedAt: null,
    rollbackGuardUntil: null,
    annualRecords: [],
  };
}

export function normalizeWorldCalendarState(value) {
  const source = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  const recordsByYear = new Map();
  for (const candidate of Array.isArray(source.annualRecords) ? source.annualRecords : []) {
    const record = normalizeAnnualRecord(candidate);
    if (!record) continue;
    const previous = recordsByYear.get(record.year);
    recordsByYear.set(record.year, previous ? {
      year: record.year,
      rewardClaimed: previous.rewardClaimed || record.rewardClaimed,
      bestScore: Math.max(previous.bestScore, record.bestScore),
      bestGrade: GRADE_RANK[record.bestGrade] > GRADE_RANK[previous.bestGrade]
        ? record.bestGrade : previous.bestGrade,
    } : record);
  }
  return {
    version: WORLD_CALENDAR_VERSION,
    lastTrustedAt: normalizeIso(source.lastTrustedAt),
    rollbackGuardUntil: normalizeIso(source.rollbackGuardUntil),
    annualRecords: [...recordsByYear.values()].sort((a, b) => a.year - b.year).slice(-MAX_ANNUAL_RECORDS),
  };
}

export function stationCalendarDate(value = new Date(), requestedTimeZone = "UTC") {
  const date = validDate(value) ?? new Date(0);
  let timeZone = String(requestedTimeZone || "UTC");
  let formatter;
  try {
    formatter = new Intl.DateTimeFormat("en-US", {
      year: "numeric", month: "2-digit", day: "2-digit", timeZone,
    });
  } catch {
    timeZone = "UTC";
    formatter = new Intl.DateTimeFormat("en-US", {
      year: "numeric", month: "2-digit", day: "2-digit", timeZone,
    });
  }
  const parts = Object.fromEntries(formatter.formatToParts(date)
    .filter(({ type }) => type !== "literal").map(({ type, value: part }) => [type, part]));
  const year = Number(parts.year);
  const month = Number(parts.month);
  const day = Number(parts.day);
  return {
    year,
    month,
    day,
    dateKey: `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
    timeZone,
  };
}

function updateTrustedClock(value, now) {
  const state = normalizeWorldCalendarState(value);
  const nowIso = now.toISOString();
  const nowMs = now.getTime();
  const lastTrustedMs = validDate(state.lastTrustedAt)?.getTime() ?? null;
  const guardMs = validDate(state.rollbackGuardUntil)?.getTime() ?? null;

  if (guardMs != null && nowMs < guardMs) {
    return { state, clockRollbackDetected: true, annualRewardsPaused: true };
  }
  if (guardMs != null && nowMs >= guardMs) {
    return {
      state: { ...state, lastTrustedAt: nowIso, rollbackGuardUntil: null },
      clockRollbackDetected: false,
      annualRewardsPaused: false,
    };
  }
  if (lastTrustedMs != null && nowMs + CLOCK_ROLLBACK_TOLERANCE_MS < lastTrustedMs) {
    return {
      state: { ...state, rollbackGuardUntil: state.lastTrustedAt },
      clockRollbackDetected: true,
      annualRewardsPaused: true,
    };
  }
  return {
    state: {
      ...state,
      lastTrustedAt: lastTrustedMs == null || nowMs > lastTrustedMs ? nowIso : state.lastTrustedAt,
      rollbackGuardUntil: null,
    },
    clockRollbackDetected: false,
    annualRewardsPaused: false,
  };
}

export function evaluateLightsAvailability({
  now = new Date(), timeZone = "UTC", storyCompleted = false, state = null,
} = {}) {
  const instant = validDate(now) ?? new Date(0);
  const clock = updateTrustedClock(state, instant);
  const stationDate = stationCalendarDate(instant, timeZone);
  const storyAvailable = storyCompleted !== true;
  const annualAvailable = storyCompleted === true
    && stationDate.month === LIGHTS_ANNUAL_MONTH
    && stationDate.day >= LIGHTS_ANNUAL_FIRST_DAY
    && stationDate.day <= LIGHTS_ANNUAL_LAST_DAY;
  const practiceAvailable = storyCompleted === true;
  return {
    preferredMode: storyAvailable ? "story" : annualAvailable ? "annual" : "practice",
    storyAvailable,
    annualAvailable,
    practiceAvailable,
    specialDay: annualAvailable && stationDate.day === LIGHTS_SPECIAL_DAY,
    annualRewardsPaused: clock.annualRewardsPaused,
    clockRollbackDetected: clock.clockRollbackDetected,
    stationDate,
    state: clock.state,
  };
}

export function recordLightsAnnualResult(value, {
  now = new Date(), timeZone = "UTC", storyCompleted = false, score = 0, grade = "none",
} = {}) {
  const availability = evaluateLightsAvailability({ now, timeZone, storyCompleted, state: value });
  if (!storyCompleted) {
    return { accepted: false, rewardGranted: false, reason: "story-incomplete", record: null, state: availability.state };
  }
  if (!availability.annualAvailable) {
    return { accepted: false, rewardGranted: false, reason: "annual-closed", record: null, state: availability.state };
  }
  if (availability.annualRewardsPaused) {
    return { accepted: false, rewardGranted: false, reason: "clock-rollback", record: null, state: availability.state };
  }

  const year = availability.stationDate.year;
  const previous = availability.state.annualRecords.find((record) => record.year === year) ?? {
    year, rewardClaimed: false, bestScore: 0, bestGrade: "none",
  };
  const nextGrade = normalizeGrade(grade);
  const record = {
    year,
    rewardClaimed: true,
    bestScore: Math.max(previous.bestScore, normalizeScore(score)),
    bestGrade: GRADE_RANK[nextGrade] > GRADE_RANK[previous.bestGrade] ? nextGrade : previous.bestGrade,
  };
  const annualRecords = availability.state.annualRecords
    .filter((candidate) => candidate.year !== year).concat(record)
    .sort((a, b) => a.year - b.year).slice(-MAX_ANNUAL_RECORDS);
  return {
    accepted: true,
    rewardGranted: !previous.rewardClaimed,
    reason: null,
    record,
    state: { ...availability.state, annualRecords },
  };
}
