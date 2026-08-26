import test from "node:test";
import assert from "node:assert/strict";
import {
  buildLightsHistoryModel,
  buildLightsMapModel,
} from "../src/game/lightsNarrative.js";
import {
  LIGHTS_ACTIVITY_RULES,
  lightsAnnualWindowModel,
} from "../src/game/lightsEventCatalog.js";

function archivedRun(overrides = {}) {
  return {
    version: 1,
    eventRunId: "annual:2026",
    mode: "annual",
    startedAt: "2026-05-05T00:00:00.000Z",
    completedAt: "2026-05-05T00:10:00.000Z",
    stationDate: "2026-05-05",
    score: 820,
    grade: "gold",
    stamp: "special",
    playerCallsign: "BH1ABC",
    contacts: [
      { personId: "person:procedural:ja", stationId: "station:procedural:ja", onAirCallsign: "JA1SIM", eventRegionCode: "JP", locationId: "japan-tokyo-kanto", timeZone: "Asia/Tokyo", completedAt: "2026-05-05T00:02:00.000Z", weatherCode: "clear", messageKey: "lights.archive.message.shared-sky" },
      { personId: "person:procedural:us", stationId: "station:procedural:us", onAirCallsign: "N7SIM", eventRegionCode: "US", locationId: "usa-seattle-washington", timeZone: "America/Los_Angeles", completedAt: "2026-05-05T00:04:00.000Z", weatherCode: "rain", messageKey: "lights.archive.message.return" },
      { personId: "person:procedural:ja2", stationId: "station:procedural:ja2", onAirCallsign: "JA2SIM", eventRegionCode: "JP", locationId: "japan-osaka-kansai", timeZone: "Asia/Tokyo", completedAt: "2026-05-05T00:06:00.000Z", weatherCode: "wind", messageKey: "lights.archive.message.signal" },
    ],
    ...overrides,
  };
}

test("map lights only regions actually contacted and uses the stored contact timezone", () => {
  const archive = { version: 1, storyBest: null, annualBests: [archivedRun()], practiceBests: [] };
  const model = buildLightsMapModel(archive, {
    eventRunId: "annual:2026",
    selectedPersonId: "person:procedural:ja",
  });
  assert.deepEqual(model.litRegions, ["JP", "US"]);
  assert.equal(model.lights.find(({ regionCode }) => regionCode === "JP").contacts.length, 2);
  assert.equal(model.lights.some(({ regionCode }) => regionCode === "CN"), false);
  assert.equal(model.selected.localDateTime, "2026-05-05 09:02");
  assert.equal(model.selected.timeZone, "Asia/Tokyo");
});

test("archive weather and localized message keys survive JSON reload without rerolling", () => {
  const archive = JSON.parse(JSON.stringify({ version: 1, storyBest: archivedRun({ mode: "story", eventRunId: "story:1" }), annualBests: [], practiceBests: [] }));
  const first = buildLightsMapModel(archive, { selectedPersonId: "person:procedural:us" });
  const second = buildLightsMapModel(JSON.parse(JSON.stringify(archive)), { selectedPersonId: "person:procedural:us" });
  assert.equal(first.selected.weatherCode, "rain");
  assert.equal(first.selected.messageKey, "lights.archive.message.return");
  assert.deepEqual(second, first);
});

test("history and annual-window copy expose durable record facts", () => {
  const run = archivedRun();
  const save = {
    eventRunArchive: { version: 1, storyBest: null, annualBests: [run], practiceBests: [] },
    worldCalendarState: { annualRecords: [{ year: 2026, rewardClaimed: true, bestScore: 820, bestGrade: "gold", stamp: "special" }] },
    missionState: { claimedMissionIds: ["story-05"] },
  };
  assert.deepEqual(LIGHTS_ACTIVITY_RULES.annualWindow, { month: 5, firstDay: 1, lastDay: 7, specialDay: 5 });
  assert.equal(LIGHTS_ACTIVITY_RULES.timeZone, "Asia/Tokyo");
  const window = lightsAnnualWindowModel(save, "2026-05-05T01:00:00.000Z");
  assert.equal(window.open, true);
  assert.equal(window.timeZone, "Asia/Tokyo");
  assert.equal(window.nextOpeningAt, "2027-04-30T15:00:00.000Z");
  assert.equal(window.claimed, true);
  assert.equal(window.bestGrade, "gold");
  assert.equal(window.stamp, "special");
  const history = buildLightsHistoryModel(save.eventRunArchive);
  assert.equal(history.storyBest, null);
  assert.equal(history.annualRecords[0].eventRunId, "annual:2026");
  assert.equal(history.annualRecords[0].stamp, "special");
});
