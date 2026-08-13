import assert from "node:assert/strict";
import test from "node:test";

import { normalizeMissionState, recordMissionQsoEvent } from "../src/game/missionSystem.js";

function activeStoryFourSave() {
  return {
    missionState: normalizeMissionState({
      activeMissions: [{
        id: "story-04",
        acceptedAt: "2026-08-12T09:00:00.000Z",
        contract: {
          missionPhase: "weak-weather-exchange",
          targetCallsign: "SIM2DX",
          requiredTopics: ["WEATHER"],
          maximumPropagationLevel: 2,
          recoveryRequired: true,
          recoveryActions: ["AGN", "QRS"],
        },
      }],
      claimedMissionIds: ["story-01", "story-02", "story-03"],
    }),
  };
}

test("mission communication events explain why a contact did not advance the contract", () => {
  const save = activeStoryFourSave();
  const updated = recordMissionQsoEvent(save, {
    id: "off-contract",
    completedAt: "2026-08-12T10:00:00.000Z",
    callsign: "SIM3RA",
    sent: "579",
    finalPropagationLevel: 4,
    optionalExchangeQuestion: "weather",
    optionalExchangeOutcome: "skipped",
    repeatRequests: 0,
    attemptHistory: [],
    equipmentId: "squid-01",
    antennaId: "dipole",
  });
  const event = updated.missionState.events.at(-1);
  assert.equal(event.outcome, "unmatched");
  assert.deepEqual(event.missionIds, []);
  assert.deepEqual(event.missionPhases, ["weak-weather-exchange"]);
  assert.deepEqual(event.requiredTopics, ["WEATHER"]);
  assert.deepEqual(event.recoveryActions, ["AGN", "QRS"]);
  assert.deepEqual(new Set(event.failureReasons), new Set([
    "TARGET_NOT_REACHED",
    "PROPAGATION_OUTSIDE_CONTRACT",
    "RECOVERY_NOT_OBSERVED",
    "WEATHER_NOT_EXCHANGED",
  ]));
  assert.equal(event.facts.equipmentId, "squid-01");
  assert.equal(event.facts.antennaId, "dipole");
});

test("mission communication events record a successful recovery without leaking free text", () => {
  const updated = recordMissionQsoEvent(activeStoryFourSave(), {
    id: "on-contract",
    completedAt: "2026-08-12T10:05:00.000Z",
    callsign: "SIM2DX",
    sent: "579",
    finalPropagationLevel: 1,
    optionalExchangeQuestion: "weather",
    optionalExchangeOutcome: "answered",
    copyQueries: 1,
    attemptHistory: [{ message: "AGN K", result: "repeat", remoteOutcome: "query" }],
  });
  const event = updated.missionState.events.at(-1);
  assert.equal(event.outcome, "progress");
  assert.deepEqual(event.missionIds, ["story-04"]);
  assert.deepEqual(event.failureReasons, []);
  assert.equal(event.facts.recovered, true);
  assert.equal("message" in event.facts, false);
});
