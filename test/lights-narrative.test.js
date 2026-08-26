import test from "node:test";
import assert from "node:assert/strict";
import { LIGHTS_PHASES } from "../src/game/lightsRun.js";
import {
  LIGHTS_NARRATIVE_KEYS,
  isOnAirLightsPhase,
  lightsNarrativeBeat,
} from "../src/game/lightsNarrative.js";

test("chapter five follows the fixed NOVA to SORA handoff before control", () => {
  assert.deepEqual(lightsNarrativeBeat({ stage: "announcement" }), {
    speaker: "NOVA",
    textKey: LIGHTS_NARRATIVE_KEYS.novaAnnouncement,
    showPortrait: true,
  });
  assert.equal(lightsNarrativeBeat({ phase: LIGHTS_PHASES.CHASE_CQ }).textKey, LIGHTS_NARRATIVE_KEYS.soraChase);
  assert.equal(lightsNarrativeBeat({ phase: LIGHTS_PHASES.CHASE_FINAL }).textKey, LIGHTS_NARRATIVE_KEYS.soraInvitation);
  assert.equal(lightsNarrativeBeat({ phase: LIGHTS_PHASES.CONTROL_CQ, chaseCompleted: true }).textKey, LIGHTS_NARRATIVE_KEYS.soraHandoff);
});

test("success signs off with MORSE while failures receive cause-specific SORA debriefs", () => {
  assert.deepEqual(lightsNarrativeBeat({
    phase: LIGHTS_PHASES.RUN_COMPLETE,
    result: { grade: "gold", validQsoCount: 7, distinctRegionCount: 6, misidentificationCount: 0 },
  }), {
    speaker: "MORSE",
    textKey: LIGHTS_NARRATIVE_KEYS.morseSignoff,
    showPortrait: true,
  });
  assert.equal(lightsNarrativeBeat({
    phase: LIGHTS_PHASES.RUN_COMPLETE,
    result: { grade: "none", validQsoCount: 3, distinctRegionCount: 3, misidentificationCount: 2 },
  }).textKey, LIGHTS_NARRATIVE_KEYS.soraDebriefIdentification);
  assert.equal(lightsNarrativeBeat({
    phase: LIGHTS_PHASES.RUN_COMPLETE,
    result: { grade: "none", validQsoCount: 0, distinctRegionCount: 0, misidentificationCount: 0 },
  }).textKey, LIGHTS_NARRATIVE_KEYS.soraDebriefNoContacts);
  assert.equal(lightsNarrativeBeat({
    phase: LIGHTS_PHASES.RUN_COMPLETE,
    result: { grade: "none", validQsoCount: 4, distinctRegionCount: 1, misidentificationCount: 0 },
  }).textKey, LIGHTS_NARRATIVE_KEYS.soraDebriefCoverage);
});

test("no on-air phase is allowed to request an NPC portrait", () => {
  const onAirPhases = Object.values(LIGHTS_PHASES).filter(isOnAirLightsPhase);
  assert.ok(onAirPhases.length >= 8);
  for (const phase of onAirPhases) {
    assert.equal(lightsNarrativeBeat({ phase, chaseCompleted: true }).showPortrait, false, phase);
  }
});
