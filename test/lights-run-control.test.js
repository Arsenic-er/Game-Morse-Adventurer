import test from "node:test";
import assert from "node:assert/strict";
import {
  LIGHTS_PHASES, advanceLightsPlayback, createLightsRun, currentLightsPileup,
  currentLightsPrompt, lightsRunResult, submitLightsTransmission, tickLightsRun,
} from "../src/game/lightsRun.js";

function controlRun(overrides = {}) {
  return createLightsRun({
    mode: "annual", playerCallsign: "BH1ABC", playerRegion: "CN",
    guidance: "full", seed: "control-seed", startedAt: "2026-05-05T09:00:00.000Z",
    ...overrides,
  });
}

function callCq(run) {
  return submitLightsTransmission(run, "CQ LGT CQ LGT DE SIM5LT K");
}

function completeRound(run, selectionMessage = null) {
  run = callCq(run);
  assert.equal(run.phase, LIGHTS_PHASES.CONTROL_PILEUP);
  const caller = currentLightsPileup(run).callers[0];
  run = advanceLightsPlayback(run);
  run = submitLightsTransmission(run, selectionMessage ?? `${caller.callsign} DE SIM5LT KN`);
  assert.equal(run.phase, LIGHTS_PHASES.CONTROL_CALLER_REPORT);
  assert.match(currentLightsPrompt(run), new RegExp(`SIM5LT DE ${caller.callsign} RST 599 ${caller.regionCode} K`));
  run = advanceLightsPlayback(run);
  run = submitLightsTransmission(run, `${caller.callsign} DE SIM5LT RST 579 CN K`);
  assert.equal(run.phase, LIGHTS_PHASES.CONTROL_FINAL);
  run = advanceLightsPlayback(run);
  return { run, caller };
}

test("a control round freezes responders and records an event contact after the signoff", () => {
  let run = controlRun();
  run = callCq(run);
  const pileup = currentLightsPileup(run);
  assert.equal(pileup.callers.length, 2);
  run = advanceLightsPlayback(run);
  const caller = pileup.callers[0];
  run = submitLightsTransmission(run, `${caller.callsign} K`);
  assert.equal(run.selectedCaller, caller);
  run = advanceLightsPlayback(run);
  run = submitLightsTransmission(run, `${caller.callsign} DE SIM5LT 579 CN TU K`);
  run = advanceLightsPlayback(run);
  assert.equal(run.phase, LIGHTS_PHASES.CONTROL_CQ);
  assert.equal(run.contacts.length, 1);
  assert.deepEqual(run.contacts[0], {
    id: `${run.runId}:1:${caller.callsign}`,
    callsign: caller.callsign,
    eventRegionCode: caller.regionCode,
    locationId: caller.locationId,
    operatorName: caller.operatorName,
    operatorProfileId: caller.operatorProfileId,
    remoteRst: "599",
    sentRst: "579",
    onAirCallsign: "SIM5LT",
    operatorCallsign: "BH1ABC",
  });
});

test("partial selection succeeds, ambiguous partial repeats a subset, and wrong full calls penalize", () => {
  let run = advanceLightsPlayback(callCq(controlRun()));
  const pileup = currentLightsPileup(run);
  run = submitLightsTransmission(run, "SIM? K");
  assert.equal(run.phase, LIGHTS_PHASES.CONTROL_PILEUP);
  assert.equal(run.playbackCallers.length, pileup.callers.length);
  assert.equal(run.agnRequestCount, 0);
  run = advanceLightsPlayback(run);
  run = submitLightsTransmission(run, "SIMF000 K");
  assert.equal(run.phase, LIGHTS_PHASES.CONTROL_SELECTION);
  assert.equal(run.misidentificationCount, 1);
  const caller = pileup.callers[0];
  const partial = `${caller.callsign.slice(0, 6)}? K`;
  run = submitLightsTransmission(run, partial);
  assert.equal(run.phase, LIGHTS_PHASES.CONTROL_CALLER_REPORT);
  assert.equal(run.selectedCaller.callsign, caller.callsign);
  assert.equal(run.successfulPartialCount, 1);
});

test("AGN repeats the complete frozen responder set and increments only the repeat count", () => {
  let run = advanceLightsPlayback(callCq(controlRun()));
  const pileup = currentLightsPileup(run);
  run = submitLightsTransmission(run, "AGN K");
  assert.equal(run.phase, LIGHTS_PHASES.CONTROL_PILEUP);
  assert.equal(run.pileup, pileup);
  assert.deepEqual(run.playbackCallers, pileup.callers);
  assert.equal(run.agnRequestCount, 1);
  assert.equal(run.misidentificationCount, 0);
});

test("seven valid rounds complete with a gold result and at least five regions", () => {
  let run = controlRun();
  while (run.phase !== LIGHTS_PHASES.RUN_COMPLETE) run = completeRound(run).run;
  const result = lightsRunResult(run);
  assert.equal(result.contacts.length, 7);
  assert.ok(result.distinctRegionCount >= 5);
  assert.equal(result.grade, "gold");
  assert.equal(result.chaseCompleted, false);
});

test("the eight-minute timer ends an unfinished run and ignores invalid ticks", () => {
  const run = controlRun();
  assert.equal(tickLightsRun(run, -100), run);
  const almost = tickLightsRun(run, 479_999);
  assert.equal(almost.phase, LIGHTS_PHASES.CONTROL_CQ);
  const ended = tickLightsRun(almost, 1);
  assert.equal(ended.phase, LIGHTS_PHASES.RUN_COMPLETE);
  assert.equal(ended.elapsedMs, 480_000);
  assert.equal(lightsRunResult(ended).grade, "none");
});

test("invalid event CQ and wrong report regions preserve the active round", () => {
  let run = submitLightsTransmission(controlRun(), "CQ DE SIM5LT K");
  assert.equal(run.phase, LIGHTS_PHASES.CONTROL_CQ);
  assert.equal(run.lastError, "missingEventToken");
  run = advanceLightsPlayback(callCq(run));
  const caller = currentLightsPileup(run).callers[0];
  run = submitLightsTransmission(run, `${caller.callsign} K`);
  run = advanceLightsPlayback(run);
  run = submitLightsTransmission(run, `${caller.callsign} DE SIM5LT RST 579 US K`);
  assert.equal(run.phase, LIGHTS_PHASES.CONTROL_PLAYER_REPORT);
  assert.equal(run.lastError, "wrongRegion");
});
