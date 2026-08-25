import test from "node:test";
import assert from "node:assert/strict";
import { LOCATIONS } from "../src/game/locations.js";
import {
  LIGHTS_EVENT, LIGHTS_EVENT_REGIONS, lightsEntryModes, lightsRegionForLocation,
} from "../src/game/lightsEventCatalog.js";

test("event identity is fictional, bounded, and localized in all interface languages", () => {
  assert.equal(LIGHTS_EVENT.id, "lights-across-air");
  assert.equal(LIGHTS_EVENT.callsign, "SIM5LT");
  assert.match(LIGHTS_EVENT.callsign, /^[A-Z0-9]{1,7}$/);
  assert.equal(LIGHTS_EVENT.token, "LGT");
  assert.deepEqual(Object.keys(LIGHTS_EVENT.names).sort(), ["de", "en", "es", "ja", "ru", "zh-CN", "zh-TW"]);
  assert.equal(Object.values(LIGHTS_EVENT.names).every((name) => name.trim().length > 0), true);
});

test("event regions map every playable location and reserve GE instead of DE", () => {
  assert.equal(lightsRegionForLocation("europe-rhine-valley"), "GE");
  assert.deepEqual(
    new Set(LOCATIONS.map(({ id }) => lightsRegionForLocation(id))),
    new Set(["JP", "US", "CN", "GE", "CH", "FI"]),
  );
  assert.equal(LIGHTS_EVENT_REGIONS.includes("DE"), false);
  assert.equal(lightsRegionForLocation("unknown-place"), null);
});

test("entry modes project story, annual, and practice from the station-local calendar", () => {
  const base = {
    locationId: "japan-tokyo-kanto",
    missionState: { claimedMissionIds: ["story-01", "story-02", "story-03", "story-04"] },
    worldCalendarState: null,
  };
  const story = lightsEntryModes(base, "2026-08-25T12:00:00.000Z");
  assert.equal(story.preferredMode, "story");
  assert.equal(story.storyAvailable, true);
  assert.equal(story.annualAvailable, false);
  assert.equal(story.practiceAvailable, false);

  const completed = {
    ...base,
    missionState: { claimedMissionIds: [...base.missionState.claimedMissionIds, "story-05"] },
  };
  const annual = lightsEntryModes(completed, "2026-05-04T15:30:00.000Z");
  assert.equal(annual.stationDate.dateKey, "2026-05-05");
  assert.equal(annual.preferredMode, "annual");
  assert.equal(annual.annualAvailable, true);
  assert.equal(annual.practiceAvailable, true);
  assert.equal(annual.specialDay, true);

  const practice = lightsEntryModes(completed, "2026-08-25T12:00:00.000Z");
  assert.equal(practice.preferredMode, "practice");
  assert.equal(practice.annualAvailable, false);
  assert.equal(practice.practiceAvailable, true);
});
