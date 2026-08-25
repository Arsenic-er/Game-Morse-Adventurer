import test from "node:test";
import assert from "node:assert/strict";
import { createSave } from "../src/game/saveStore.js";
import { acceptMission, claimMission, missionBoard, normalizeMissionState } from "../src/game/missionSystem.js";
import { settleLightsRun } from "../src/game/lightsSettlement.js";
import {
  LIGHTS_PHASES, advanceLightsPlayback, createLightsRun, currentLightsPileup,
  lightsRunResult, submitLightsTransmission,
} from "../src/game/lightsRun.js";

function enterControl(run) {
  run = advanceLightsPlayback(run);
  run = submitLightsTransmission(run, `SIM5LTDE${run.playerCallsign}PSEK`);
  run = advanceLightsPlayback(run);
  run = submitLightsTransmission(run, `SIM5LTDE${run.playerCallsign}579${run.playerRegion}PSEK`);
  return advanceLightsPlayback(run);
}

function completeRound(run, { partial = false } = {}) {
  run = submitLightsTransmission(run, "CQ LGT CQ LGT DE SIM5LT PSE K");
  const caller = currentLightsPileup(run).callers[0];
  run = advanceLightsPlayback(run);
  const selection = partial ? `${caller.callsign.slice(0, -1)}? K` : `${caller.callsign} DE SIM5LT KN`;
  run = submitLightsTransmission(run, selection);
  run = advanceLightsPlayback(run);
  run = submitLightsTransmission(run, `${caller.callsign}DE SIM5LT 579 ${run.playerRegion} TU PSE K`);
  run = advanceLightsPlayback(run);
  return run;
}

function chapterFiveSave() {
  const save = createSave({ callsign: "BH1ABC", locationId: "china-beijing-outskirts", keyType: "automatic" });
  return {
    ...save,
    missionState: normalizeMissionState({
      claimedMissionIds: ["story-01", "story-02", "story-03", "story-04"],
    }),
  };
}

test("story acceptance drives tolerant chase, pile-up control, settlement, and mission claim", () => {
  const accepted = acceptMission(chapterFiveSave(), "story-05", "2026-05-05T08:00:00.000Z").save;
  let run = createLightsRun({
    mode: "story", playerCallsign: accepted.callsign, playerRegion: "CN", guidance: "hints",
    seed: "acceptance-story", startedAt: "2026-05-05T09:00:00.000Z",
  });
  run = advanceLightsPlayback(submitLightsTransmission(advanceLightsPlayback(run), "QRS PSE K"));
  run = submitLightsTransmission(run, "SIM5LTDEBH1ABCPSEK");
  run = advanceLightsPlayback(run);
  run = submitLightsTransmission(run, "SIM5LTDEBH1ABC579CNPSEK");
  run = advanceLightsPlayback(run);
  assert.equal(run.phase, LIGHTS_PHASES.CONTROL_CQ);
  for (let index = 0; index < 3; index += 1) run = completeRound(run, { partial: index === 1 });
  run = { ...run, phase: LIGHTS_PHASES.RUN_COMPLETE };
  const result = lightsRunResult(run);
  assert.equal(result.grade, "base");
  assert.equal(result.validQsoCount, 3);
  assert.ok(result.distinctRegionCount >= 2);

  const settlement = settleLightsRun(accepted, result, { now: result.completedAt });
  assert.equal(settlement.settled, true);
  assert.equal(settlement.moneyAwarded, 0);
  assert.ok(settlement.save.qsoLogs.every(({ credits, rewardBreakdown }) => credits === 0 && rewardBreakdown === null));
  assert.equal(missionBoard(settlement.save).story[4].status, "ready");
  const claimed = claimMission(settlement.save, "story-05", "2026-05-05T09:10:00.000Z");
  assert.equal(claimed.claimed, true);
  assert.equal(claimed.save.money, 500);
  assert.equal(claimed.save.technologyPoints, 2);
  assert.ok(claimed.save.knownOperatorNames.includes("SORA"));
});

test("poor-copy controls preserve frozen callers and unsafe reports fail closed", () => {
  let run = createLightsRun({
    mode: "practice", playerCallsign: "BH1ABC", playerRegion: "CN", guidance: "off",
    seed: "acceptance-poor", startedAt: "2026-05-05T09:00:00.000Z",
  });
  run = submitLightsTransmission(run, "CQ LGT DE SIM5LT K");
  const frozen = currentLightsPileup(run);
  run = advanceLightsPlayback(run);
  run = submitLightsTransmission(run, "AGN K");
  assert.equal(currentLightsPileup(run), frozen);
  assert.equal(run.agnRequestCount, 1);
  run = advanceLightsPlayback(run);
  run = submitLightsTransmission(run, "SIM? K");
  assert.equal(run.phase, LIGHTS_PHASES.CONTROL_PILEUP);
  run = advanceLightsPlayback(run);
  run = submitLightsTransmission(run, "SIMF000 K");
  assert.equal(run.misidentificationCount, 1);
  const caller = frozen.callers[0];
  run = submitLightsTransmission(run, `${caller.callsign} K`);
  run = advanceLightsPlayback(run);
  const blocked = submitLightsTransmission(run, `${caller.callsign} DE SIM5LT 579 CN K`, {
    semanticResult: { safeToCommit: false },
  });
  assert.equal(blocked.phase, LIGHTS_PHASES.CONTROL_PLAYER_REPORT);
  assert.equal(blocked.lastError, "unsafeSemanticResult");
});

test("annual and practice acceptance keep rewards idempotent across repeat settlement", () => {
  const completed = chapterFiveSave();
  completed.missionState = normalizeMissionState({
    claimedMissionIds: ["story-01", "story-02", "story-03", "story-04", "story-05"],
  });
  let annualRun = createLightsRun({
    mode: "annual", playerCallsign: "BH1ABC", playerRegion: "CN", guidance: "full",
    seed: "acceptance-annual", startedAt: "2026-05-05T09:00:00.000Z",
  });
  for (let index = 0; index < 5; index += 1) annualRun = completeRound(annualRun);
  annualRun = { ...annualRun, phase: LIGHTS_PHASES.RUN_COMPLETE };
  const result = lightsRunResult(annualRun);
  assert.equal(result.grade, "silver");
  const first = settleLightsRun(completed, result, { now: "2026-05-05T09:08:00.000Z" });
  assert.equal(first.moneyAwarded, 400);
  const repeated = settleLightsRun(first.save, result, { now: "2026-05-05T09:08:00.000Z" });
  assert.equal(repeated.settled, false);
  assert.equal(repeated.moneyAwarded, 0);
});
