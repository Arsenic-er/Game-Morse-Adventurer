import assert from "node:assert/strict";
import test from "node:test";

import { buildOpenStationDashboard, updateOpenStationGoal } from "../src/game/openStationDashboard.js";
import {
  CONTEST_MODES, contestCqText, contestExchangeText, createContestRun, finishContestRun,
  normalizeContestState, selectContestMode, submitContestText,
} from "../src/game/contestRun.js";
import { settleContestRun } from "../src/game/contestSettlement.js";
import { createSave, normalizeSave } from "../src/game/saveStore.js";
import { normalizeStoryContinuationState } from "../src/game/storyContinuationState.js";

const NOW = "2026-08-31T17:00:00.000Z";
const CONTEST_START = "2026-08-28T03:00:00.000Z";
const safe = { safeToCommit: true };
const contestAt = (seconds) => new Date(Date.parse(CONTEST_START) + seconds * 1000).toISOString();

function completedContestChapter() {
  let run = createContestRun({ playerCallsign: "BH1ABC", seed: "open-station-dashboard", startedAt: CONTEST_START });
  for (let index = 0; index < 6; index += 1) {
    const mode = index < 3 ? CONTEST_MODES.RUN : CONTEST_MODES.SP;
    run = selectContestMode(run, mode);
    if (mode === CONTEST_MODES.RUN) run = submitContestText(run, contestCqText(run.playerCallsign), safe, contestAt(4 + index * 8));
    const station = run.candidates[0];
    run = submitContestText(run, station.callsign, safe, contestAt(5 + index * 8));
    run = submitContestText(run, contestExchangeText(station, run.playerCallsign, run.nextSerial), safe, contestAt(6 + index * 8));
  }
  if (run.phase !== "COMPLETED") run = finishContestRun(run, contestAt(100));
  const save = createSave({ callsign: "BH1ABC", locationId: "japan-tokyo-kanto" });
  const ready = {
    ...save,
    storyContinuationState: normalizeStoryContinuationState({
      ...save.storyContinuationState,
      chapter10: normalizeContestState({ activeRun: run }),
    }),
  };
  const settled = settleContestRun(ready, run, contestAt(110));
  assert.equal(settled.settled, true);
  return settled.save.storyContinuationState.chapter10;
}

const VALID_CONTEST_CHAPTER = completedContestChapter();

function unlockedSave() {
  const base = createSave({ callsign: "BH1ABC", locationId: "japan-tokyo-kanto" });
  return {
    ...base,
    qsoLogs: [
      { id: "qso:2", startedAt: "2026-08-31T16:20:00.000Z", completedAt: "2026-08-31T16:22:00.000Z", playerCallsign: "BH1ABC", callsign: "SIM4US", personId: "person:legacy:SIM4US", stationId: "station:legacy:SIM4US", sent: "599", received: "579", location: "US", finalPropagationLevel: 1, credits: 100, eventId: null },
      { id: "qso:1", startedAt: "2026-08-31T16:10:00.000Z", completedAt: "2026-08-31T16:12:00.000Z", playerCallsign: "BH1ABC", callsign: "SIM5LT", personId: "person:sora", stationId: "station:sim5lt", sent: "599", received: "599", location: "JP", finalPropagationLevel: 3, credits: 100, eventId: null },
    ],
    qsoRecords: { total: 12, longestDistanceKm: 5200, longestQsoId: "qso:2", contactedRegions: ["JP", "US"], weakSignalQsos: 2, settledQsoIds: ["qso:1", "qso:2"] },
    claimedAchievementRewards: ["first-qso", "qso-5", "regions-3"],
    missionState: { ...base.missionState, claimedMissionIds: Array.from({ length: 15 }, (_, index) => `story-${String(index + 1).padStart(2, "0")}`) },
    operatorRelationships: [{ personId: "person:sora", callsign: "SIM5LT" }, { personId: "person:legacy:SIM4US", callsign: "SIM4US" }],
    qslRecords: [{ id: "qsl:one" }],
    unlockedTechnologies: ["station-basics", "rf-circuits", "receiver-audio"],
    ownedEquipment: ["squid-01", "usdr-8"], ownedAntennas: ["dipole", "vertical"], accessories: ["cw-filter-500"],
    lightsEventState: { ...base.lightsEventState, annualBests: [{ year: 2026, runId: "lights:2026" }] },
    expeditionState: { ...base.expeditionState, completedRuns: [{ runId: "expedition:one" }] },
    storyContinuationState: normalizeStoryContinuationState({
      ...base.storyContinuationState,
      chapter10: VALID_CONTEST_CHAPTER,
      chapter15: { completedRuns: [], settledRunIds: [], settlementProofs: [], archive: [], taskTreeUnlocked: true },
      openStation: { unlocked: true, firstGoal: "world-log", activeGoal: "world-log", goalUpdatedAt: NOW },
    }),
  };
}

test("Open Station stays locked before Chapter 15 claim and exposes no derived progress", () => {
  const save = createSave({ callsign: "BH1ABC", locationId: "japan-tokyo-kanto" });
  assert.deepEqual(buildOpenStationDashboard(save), {
    version: 1, unlocked: false, firstGoal: null, activeGoal: null, goalUpdatedAt: null, lines: [], recent: [],
  });
  const result = updateOpenStationGoal(save, "world-log", NOW);
  assert.equal(result.updated, false);
  assert.equal(result.reason, "OPEN_STATION_LOCKED");
  assert.strictEqual(result.save, save);
});

test("dashboard derives five fixed progress lines and bounded recent activity only from durable records", () => {
  const save = unlockedSave();
  const dashboard = buildOpenStationDashboard(save);
  assert.equal(dashboard.unlocked, true);
  assert.equal(dashboard.firstGoal, "world-log");
  assert.deepEqual(dashboard.lines.map(({ id }) => id), ["world-log", "award-wall", "people-network", "station-engineering", "annual-career"]);
  assert.deepEqual(dashboard.lines[0].facts, { ordinaryQsos: 12, regions: 2, people: 2, propagationConditions: 2, prefixes: 2 });
  assert.deepEqual(dashboard.lines[1].facts, { achievements: 3, storyCertificates: 15 });
  assert.deepEqual(dashboard.lines[2].facts, { relationships: 2, qslRecords: 1 });
  assert.deepEqual(dashboard.lines[3].facts, { technologies: 3, ownedItems: 5 });
  assert.deepEqual(dashboard.lines[4].facts, {
    lightsYears: 1,
    expeditions: 1,
    contestBest: save.storyContinuationState.chapter10.personalBest.score,
    activeGoal: "world-log",
  });
  assert.ok(dashboard.lines[4].facts.contestBest > 0);
  assert.equal(dashboard.recent.length, 2);
  assert.deepEqual(dashboard.recent.map(({ id }) => id), ["qso:2", "qso:1"]);
  assert.equal(JSON.stringify(dashboard).includes("optionalExchangeAnswer"), false);
});

test("goal updates are fixed, chronological, reload-safe, and never mutate story rewards or history", () => {
  const save = unlockedSave();
  const missionState = save.missionState;
  const updated = updateOpenStationGoal(save, "field-operations", "2026-08-31T17:01:00.000Z");
  assert.equal(updated.updated, true, updated.reason);
  assert.equal(updated.save.storyContinuationState.openStation.firstGoal, "world-log");
  assert.equal(updated.save.storyContinuationState.openStation.activeGoal, "field-operations");
  assert.strictEqual(updated.save.missionState, missionState);
  assert.equal(updated.save.money, save.money);
  assert.equal(updated.save.technologyPoints, save.technologyPoints);
  const duplicate = updateOpenStationGoal(updated.save, "field-operations", "2026-08-31T17:02:00.000Z");
  assert.equal(duplicate.reason, "GOAL_ALREADY_ACTIVE");
  assert.strictEqual(duplicate.save, updated.save);
  for (const [goal, at] of [["anything", "2026-08-31T17:03:00.000Z"], ["world-log", "bad"], ["world-log", "2026-08-31T16:59:00.000Z"]]) {
    const rejected = updateOpenStationGoal(updated.save, goal, at);
    assert.equal(rejected.updated, false);
    assert.strictEqual(rejected.save, updated.save);
  }
  const once = normalizeSave(JSON.parse(JSON.stringify(updated.save)));
  const twice = normalizeSave(JSON.parse(JSON.stringify(once)));
  assert.deepEqual(twice, once);
});

test("hostile dashboard collections are bounded and inherited unlocks are ignored", () => {
  const inherited = Object.create({ unlocked: true, firstGoal: "world-log", activeGoal: "world-log", goalUpdatedAt: NOW });
  const save = unlockedSave();
  const locked = { ...save, storyContinuationState: { ...save.storyContinuationState, openStation: inherited } };
  assert.equal(buildOpenStationDashboard(locked).unlocked, false);
  const huge = new Array(10_000).fill({ id: "junk" });
  const dashboard = buildOpenStationDashboard({ ...save, qsoLogs: huge, operatorRelationships: huge, qslRecords: huge });
  assert.ok(dashboard.recent.length <= 8);
  assert.ok(dashboard.lines.every(({ facts }) => Object.values(facts).every((value) => typeof value === "string" || Number.isSafeInteger(value))));
});
