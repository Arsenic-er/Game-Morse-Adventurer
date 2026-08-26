export const WORLD_CALENDAR_VERSION = 1;
export const LIGHTS_ANNUAL_MONTH = 5;
export const LIGHTS_ANNUAL_FIRST_DAY = 1;
export const LIGHTS_ANNUAL_LAST_DAY = 7;
export const LIGHTS_SPECIAL_DAY = 5;
export const CLOCK_ROLLBACK_TOLERANCE_MS = 5 * 60 * 1000;
export const WORLD_CALENDAR_HEARTBEAT_MS = 60 * 1000;

const MAX_ANNUAL_RECORDS = 20;
const MAX_ANNUAL_RECORD_INPUTS = MAX_ANNUAL_RECORDS * 4;
const MAX_ANNUAL_SCORE = 999;
const GRADE_RANK = Object.freeze({ none: 0, base: 1, silver: 2, gold: 3 });
const STAMP_RANK = Object.freeze({ none: 0, standard: 1, special: 2 });

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

function normalizeStamp(value) {
  return Object.hasOwn(STAMP_RANK, value) ? value : "none";
}

function normalizeAnnualRecord(value) {
  const year = Number(value?.year);
  if (!Number.isInteger(year) || year < 1970 || year > 9999) return null;
  return {
    year,
    rewardClaimed: value?.rewardClaimed === true,
    bestScore: normalizeScore(value?.bestScore),
    bestGrade: normalizeGrade(value?.bestGrade),
    stamp: normalizeStamp(value?.stamp),
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

export function normalizeWorldCalendarState(value, { anchorYear = null } = {}) {
  const source = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  const lastTrustedAt = normalizeIso(source.lastTrustedAt);
  const recordsByYear = new Map();
  const recordSource = Array.isArray(source.annualRecords)
    ? source.annualRecords.slice(-MAX_ANNUAL_RECORD_INPUTS) : [];
  for (const candidate of recordSource) {
    const record = normalizeAnnualRecord(candidate);
    if (!record) continue;
    const previous = recordsByYear.get(record.year);
    recordsByYear.set(record.year, previous ? {
      year: record.year,
      rewardClaimed: previous.rewardClaimed || record.rewardClaimed,
      bestScore: Math.max(previous.bestScore, record.bestScore),
      bestGrade: GRADE_RANK[record.bestGrade] > GRADE_RANK[previous.bestGrade]
        ? record.bestGrade : previous.bestGrade,
      stamp: STAMP_RANK[record.stamp] > STAMP_RANK[previous.stamp]
        ? record.stamp : previous.stamp,
    } : record);
  }
  const trustedYear = validDate(lastTrustedAt)?.getUTCFullYear() ?? null;
  const retentionYear = Number.isInteger(anchorYear) ? anchorYear : trustedYear;
  return {
    version: WORLD_CALENDAR_VERSION,
    lastTrustedAt,
    rollbackGuardUntil: normalizeIso(source.rollbackGuardUntil),
    annualRecords: retainAnnualRecords([...recordsByYear.values()], retentionYear),
  };
}

function retainAnnualRecords(records, requiredYear) {
  const sorted = [...records].sort((a, b) => a.year - b.year);
  if (sorted.length <= MAX_ANNUAL_RECORDS) return sorted;
  const required = sorted.find((record) => record.year === requiredYear);
  if (!required) return sorted.slice(-MAX_ANNUAL_RECORDS);
  const nearest = sorted.filter((record) => record.year !== requiredYear)
    .sort((a, b) => Math.abs(a.year - requiredYear) - Math.abs(b.year - requiredYear)
      || b.year - a.year)
    .slice(0, MAX_ANNUAL_RECORDS - 1);
  return nearest.concat(required).sort((a, b) => a.year - b.year);
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

function updateTrustedClock(value, now, anchorYear) {
  const state = normalizeWorldCalendarState(value, { anchorYear });
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

export function advanceWorldCalendarState(value, { now = new Date(), timeZone = "UTC" } = {}) {
  const instant = validDate(now) ?? new Date(0);
  const stationDate = stationCalendarDate(instant, timeZone);
  const clock = updateTrustedClock(value, instant, stationDate.year);
  return { ...clock, stationDate };
}

function lightsActivityCalendar(activityRules, fallbackTimeZone) {
  const window = activityRules?.annualWindow;
  return {
    timeZone: typeof activityRules?.timeZone === "string" && activityRules.timeZone.trim()
      ? activityRules.timeZone : fallbackTimeZone,
    month: Number.isInteger(window?.month) ? window.month : LIGHTS_ANNUAL_MONTH,
    firstDay: Number.isInteger(window?.firstDay) ? window.firstDay : LIGHTS_ANNUAL_FIRST_DAY,
    lastDay: Number.isInteger(window?.lastDay) ? window.lastDay : LIGHTS_ANNUAL_LAST_DAY,
    specialDay: Number.isInteger(window?.specialDay) ? window.specialDay : LIGHTS_SPECIAL_DAY,
  };
}

export function evaluateLightsAvailability({
  now = new Date(), timeZone = "UTC", storyCompleted = false, state = null, activityRules = null,
} = {}) {
  const rules = lightsActivityCalendar(activityRules, timeZone);
  const clock = advanceWorldCalendarState(state, { now, timeZone: rules.timeZone });
  const stationDate = clock.stationDate;
  const storyAvailable = storyCompleted !== true;
  const annualAvailable = storyCompleted === true
    && stationDate.month === rules.month
    && stationDate.day >= rules.firstDay
    && stationDate.day <= rules.lastDay;
  const practiceAvailable = storyCompleted === true;
  return {
    preferredMode: storyAvailable ? "story" : annualAvailable ? "annual" : "practice",
    storyAvailable,
    annualAvailable,
    practiceAvailable,
    specialDay: annualAvailable && stationDate.day === rules.specialDay,
    annualRewardsPaused: clock.annualRewardsPaused,
    clockRollbackDetected: clock.clockRollbackDetected,
    stationDate,
    state: clock.state,
  };
}

export function recordLightsAnnualResult(value, {
  now = new Date(), timeZone = "UTC", storyCompleted = false, score = 0, grade = "none",
  activityRules = null,
} = {}) {
  const availability = evaluateLightsAvailability({ now, timeZone, storyCompleted, state: value, activityRules });
  if (!storyCompleted) {
    return { accepted: false, rewardGranted: false, reason: "story-incomplete", record: null, state: availability.state };
  }
  if (!availability.annualAvailable) {
    return { accepted: false, rewardGranted: false, reason: "annual-closed", record: null, state: availability.state };
  }
  if (availability.stationDate.year < 1970 || availability.stationDate.year > 9999) {
    return { accepted: false, rewardGranted: false, reason: "unsupported-year", record: null, state: availability.state };
  }

  const year = availability.stationDate.year;
  const previous = availability.state.annualRecords.find((record) => record.year === year) ?? {
    year, rewardClaimed: false, bestScore: 0, bestGrade: "none", stamp: "none",
  };
  const nextGrade = normalizeGrade(grade);
  const targetStamp = availability.specialDay ? "special" : "standard";
  const nextStamp = availability.annualRewardsPaused || STAMP_RANK[previous.stamp] >= STAMP_RANK[targetStamp]
    ? previous.stamp : targetStamp;
  const record = {
    year,
    rewardClaimed: previous.rewardClaimed || !availability.annualRewardsPaused,
    bestScore: Math.max(previous.bestScore, normalizeScore(score)),
    bestGrade: GRADE_RANK[nextGrade] > GRADE_RANK[previous.bestGrade] ? nextGrade : previous.bestGrade,
    stamp: nextStamp,
  };
  const annualRecords = retainAnnualRecords(
    availability.state.annualRecords.filter((candidate) => candidate.year !== year).concat(record),
    year,
  );
  return {
    accepted: true,
    rewardGranted: !previous.rewardClaimed && !availability.annualRewardsPaused,
    stampGranted: STAMP_RANK[nextStamp] > STAMP_RANK[previous.stamp],
    reason: availability.annualRewardsPaused ? "clock-rollback" : null,
    record,
    state: { ...availability.state, annualRecords },
  };
}
