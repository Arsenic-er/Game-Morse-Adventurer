import test from "node:test";
import assert from "node:assert/strict";
import {
  LIGHTS_PHASES, advanceLightsPlayback, createLightsRun, currentLightsPrompt,
  submitLightsTransmission,
} from "../src/game/lightsRun.js";

function storyRun() {
  return createLightsRun({
    mode: "story", playerCallsign: "BH1ABC", playerRegion: "CN",
    guidance: "full", seed: "chase-seed", startedAt: "2026-05-05T09:00:00.000Z",
  });
}

test("story chase moves through SORA call, report exchange, and final signoff", () => {
  let run = storyRun();
  assert.equal(run.phase, LIGHTS_PHASES.CHASE_CQ);
  assert.equal(currentLightsPrompt(run), "CQ LGT CQ LGT DE SIM5LT K");

  run = advanceLightsPlayback(run);
  assert.equal(run.phase, LIGHTS_PHASES.CHASE_PLAYER_CALL);
  run = submitLightsTransmission(run, "SIM5LT DE BH1ABC K");
  assert.equal(run.phase, LIGHTS_PHASES.CHASE_NPC_REPORT);
  assert.equal(currentLightsPrompt(run), "BH1ABC DE SIM5LT RST 599 JP K");

  run = advanceLightsPlayback(run);
  run = submitLightsTransmission(run, "SIM5LTDEBH1ABCRST579CNK");
  assert.equal(run.phase, LIGHTS_PHASES.CHASE_FINAL);
  assert.equal(currentLightsPrompt(run), "BH1ABC DE SIM5LT TU 73 SK");

  run = advanceLightsPlayback(run);
  assert.equal(run.phase, LIGHTS_PHASES.CONTROL_CQ);
  assert.equal(run.chaseCompleted, true);
  assert.equal(run.lastError, null);
});

test("AGN and QRS replay the same frozen SORA traffic without rerolling facts", () => {
  let run = advanceLightsPlayback(storyRun());
  const before = run.chase;
  run = submitLightsTransmission(run, "AGN K");
  assert.equal(run.phase, LIGHTS_PHASES.CHASE_CQ);
  assert.equal(run.chase, before);
  run = advanceLightsPlayback(run);
  run = submitLightsTransmission(run, "QRS PSE K");
  assert.equal(run.phase, LIGHTS_PHASES.CHASE_CQ);
  assert.equal(run.chase, before);
  assert.ok(run.chaseWpm < 18);
});

test("invalid chase reports preserve the contact and return a field reason", () => {
  let run = advanceLightsPlayback(storyRun());
  run = submitLightsTransmission(run, "SIM5LT DE BH1ABC K");
  run = advanceLightsPlayback(run);
  const before = run.chase;
  run = submitLightsTransmission(run, "SIM5LT DE BH1ABC RST 579 US K");
  assert.equal(run.phase, LIGHTS_PHASES.CHASE_PLAYER_REPORT);
  assert.equal(run.lastError, "wrongRegion");
  assert.equal(run.chase, before);
});

test("annual and practice runs begin directly at the control stage", () => {
  for (const mode of ["annual", "practice"]) {
    const run = createLightsRun({
      mode, playerCallsign: "BH1ABC", playerRegion: "CN", seed: mode,
      startedAt: "2026-05-05T09:00:00.000Z",
    });
    assert.equal(run.phase, LIGHTS_PHASES.CONTROL_CQ);
    assert.equal(run.chaseCompleted, false);
  }
});
