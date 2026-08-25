import test from "node:test";
import assert from "node:assert/strict";
import {
  WORLD_CALENDAR_VERSION,
  evaluateLightsAvailability,
  normalizeWorldCalendarState,
  recordLightsAnnualResult,
  stationCalendarDate,
} from "../src/game/worldCalendar.js";

test("station calendar date is derived from the station time zone, not the host", () => {
  const instant = new Date("2026-04-30T15:30:00.000Z");
  assert.deepEqual(stationCalendarDate(instant, "Asia/Tokyo"), {
    year: 2026, month: 5, day: 1, dateKey: "2026-05-01", timeZone: "Asia/Tokyo",
  });
  assert.deepEqual(stationCalendarDate(instant, "America/New_York"), {
    year: 2026, month: 4, day: 30, dateKey: "2026-04-30", timeZone: "America/New_York",
  });
});

test("first story run is date independent and completed stories retain practice", () => {
  const story = evaluateLightsAvailability({
    now: "2026-12-20T12:00:00.000Z", timeZone: "Europe/Zurich", storyCompleted: false,
  });
  assert.equal(story.preferredMode, "story");
  assert.equal(story.storyAvailable, true);
  assert.equal(story.annualAvailable, false);
  assert.equal(story.practiceAvailable, false);

  const replay = evaluateLightsAvailability({
    now: "2026-12-20T12:00:00.000Z", timeZone: "Europe/Zurich", storyCompleted: true,
  });
  assert.equal(replay.preferredMode, "practice");
  assert.equal(replay.storyAvailable, false);
  assert.equal(replay.annualAvailable, false);
  assert.equal(replay.practiceAvailable, true);
});

test("annual replay follows May 1–7 at the station and marks May 5", () => {
  const opening = evaluateLightsAvailability({
    now: "2026-04-30T15:00:00.000Z", timeZone: "Asia/Tokyo", storyCompleted: true,
  });
  assert.equal(opening.stationDate.dateKey, "2026-05-01");
  assert.equal(opening.preferredMode, "annual");
  assert.equal(opening.annualAvailable, true);
  assert.equal(opening.specialDay, false);

  const special = evaluateLightsAvailability({
    now: "2026-05-05T03:00:00.000Z", timeZone: "Asia/Tokyo", storyCompleted: true,
    state: opening.state,
  });
  assert.equal(special.annualAvailable, true);
  assert.equal(special.specialDay, true);

  const closed = evaluateLightsAvailability({
    now: "2026-05-07T15:00:00.000Z", timeZone: "Asia/Tokyo", storyCompleted: true,
    state: special.state,
  });
  assert.equal(closed.stationDate.dateKey, "2026-05-08");
  assert.equal(closed.preferredMode, "practice");
  assert.equal(closed.annualAvailable, false);
});

test("clock rollback pauses only annual rewards and recovers when trusted time catches up", () => {
  const trusted = evaluateLightsAvailability({
    now: "2026-05-05T12:00:00.000Z", timeZone: "UTC", storyCompleted: true,
  });
  const rolledBack = evaluateLightsAvailability({
    now: "2026-05-05T10:00:00.000Z", timeZone: "UTC", storyCompleted: true, state: trusted.state,
  });
  assert.equal(rolledBack.clockRollbackDetected, true);
  assert.equal(rolledBack.annualAvailable, true);
  assert.equal(rolledBack.annualRewardsPaused, true);
  assert.equal(rolledBack.practiceAvailable, true);

  const stillPaused = evaluateLightsAvailability({
    now: "2026-05-05T11:59:59.000Z", timeZone: "UTC", storyCompleted: true, state: rolledBack.state,
  });
  assert.equal(stillPaused.annualRewardsPaused, true);

  const recovered = evaluateLightsAvailability({
    now: "2026-05-05T12:00:00.000Z", timeZone: "UTC", storyCompleted: true, state: stillPaused.state,
  });
  assert.equal(recovered.clockRollbackDetected, false);
  assert.equal(recovered.annualRewardsPaused, false);
  assert.equal(recovered.state.rollbackGuardUntil, null);
});

test("minor clock drift inside the five-minute tolerance does not pause rewards", () => {
  const trusted = evaluateLightsAvailability({
    now: "2026-05-05T12:00:00.000Z", timeZone: "UTC", storyCompleted: true,
  });
  const drift = evaluateLightsAvailability({
    now: "2026-05-05T11:56:00.000Z", timeZone: "UTC", storyCompleted: true, state: trusted.state,
  });
  assert.equal(drift.clockRollbackDetected, false);
  assert.equal(drift.annualRewardsPaused, false);
});

test("annual reward is granted once per year while the best result can improve", () => {
  const first = recordLightsAnnualResult(null, {
    now: "2026-05-02T12:00:00.000Z", timeZone: "UTC", storyCompleted: true,
    score: 3, grade: "base",
  });
  assert.equal(first.accepted, true);
  assert.equal(first.rewardGranted, true);
  assert.deepEqual(first.record, { year: 2026, rewardClaimed: true, bestScore: 3, bestGrade: "base" });

  const improved = recordLightsAnnualResult(first.state, {
    now: "2026-05-05T12:00:00.000Z", timeZone: "UTC", storyCompleted: true,
    score: 7, grade: "gold",
  });
  assert.equal(improved.accepted, true);
  assert.equal(improved.rewardGranted, false);
  assert.deepEqual(improved.record, { year: 2026, rewardClaimed: true, bestScore: 7, bestGrade: "gold" });

  const nextYear = recordLightsAnnualResult(improved.state, {
    now: "2027-05-03T12:00:00.000Z", timeZone: "UTC", storyCompleted: true,
    score: 5, grade: "silver",
  });
  assert.equal(nextYear.rewardGranted, true);
  assert.equal(nextYear.state.annualRecords.length, 2);
});

test("annual result rejects closed dates, incomplete story, and rollback reward attempts", () => {
  assert.equal(recordLightsAnnualResult(null, {
    now: "2026-06-01T12:00:00.000Z", timeZone: "UTC", storyCompleted: true, score: 7, grade: "gold",
  }).reason, "annual-closed");
  assert.equal(recordLightsAnnualResult(null, {
    now: "2026-05-05T12:00:00.000Z", timeZone: "UTC", storyCompleted: false, score: 7, grade: "gold",
  }).reason, "story-incomplete");

  const trusted = evaluateLightsAvailability({ now: "2026-05-05T12:00:00.000Z", timeZone: "UTC", storyCompleted: true });
  const rejected = recordLightsAnnualResult(trusted.state, {
    now: "2026-05-05T10:00:00.000Z", timeZone: "UTC", storyCompleted: true, score: 7, grade: "gold",
  });
  assert.equal(rejected.accepted, false);
  assert.equal(rejected.reason, "clock-rollback");
});

test("calendar normalization bounds hostile state and keeps valid recent annual records", () => {
  const records = Array.from({ length: 30 }, (_, index) => ({
    year: 2000 + index, rewardClaimed: index % 2 === 0, bestScore: 9999, bestGrade: "gold",
  }));
  records.push({ year: "bad", rewardClaimed: true, bestScore: 2, bestGrade: "base" });
  const state = normalizeWorldCalendarState({
    lastTrustedAt: "not-a-date", rollbackGuardUntil: "2026-05-05T12:00:00.000Z", annualRecords: records,
  });
  assert.equal(state.version, WORLD_CALENDAR_VERSION);
  assert.equal(state.lastTrustedAt, null);
  assert.equal(state.rollbackGuardUntil, "2026-05-05T12:00:00.000Z");
  assert.equal(state.annualRecords.length, 20);
  assert.equal(state.annualRecords[0].year, 2010);
  assert.equal(state.annualRecords.at(-1).year, 2029);
  assert.equal(state.annualRecords.at(-1).bestScore, 999);
});
