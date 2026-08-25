import test from "node:test";
import assert from "node:assert/strict";
import { LANGUAGE_IDS } from "../src/i18n/languageRegistry.js";
import {
  LIGHTS_PHASES, advanceLightsPlayback, createLightsRun, submitLightsTransmission, tickLightsRun,
} from "../src/game/lightsRun.js";
import { lightsUiModel } from "../src/game/lightsUiModel.js";
import { LIGHTS_TEXT } from "../src/screens/lightsEventText.js";

function run(mode = "story", guidance = "full") {
  return createLightsRun({
    mode, guidance, playerCallsign: "BH1ABC", playerRegion: "CN", seed: "ui-model",
    startedAt: "2026-05-05T09:00:00.000Z",
  });
}

test("event copy is complete and distinct across all seven interface languages", () => {
  assert.deepEqual(Object.keys(LIGHTS_TEXT), LANGUAGE_IDS);
  const keys = Object.keys(LIGHTS_TEXT.en);
  for (const language of LANGUAGE_IDS) {
    assert.deepEqual(Object.keys(LIGHTS_TEXT[language]), keys);
    assert.ok(keys.every((key) => String(LIGHTS_TEXT[language][key]).trim()));
  }
  for (const language of ["zh-CN", "zh-TW", "ja", "es", "de", "ru"]) {
    assert.notEqual(LIGHTS_TEXT[language].title, LIGHTS_TEXT.en.title);
  }
});

test("UI model exposes chase playback, operator prompts, and a frozen timer", () => {
  let current = run();
  let model = lightsUiModel(current, "en");
  assert.equal(model.needsPlayback, true);
  assert.equal(model.incomingText, "CQ LGT CQ LGT DE SIM5LT K");
  assert.equal(model.canTransmit, false);
  assert.equal(model.timerText, "08:00");

  current = advanceLightsPlayback(current);
  model = lightsUiModel(current, "en");
  assert.equal(model.canTransmit, true);
  assert.match(model.instruction, /SIM5LT/);
  assert.equal(model.canSettle, false);
});

test("pile-up hints, errors, and elapsed time reflect the run without mutating it", () => {
  let current = submitLightsTransmission(run("annual", "full"), "CQ LGT CQ LGT DE SIM5LT K");
  const snapshot = structuredClone(current);
  let model = lightsUiModel(current, "en");
  assert.equal(current.phase, LIGHTS_PHASES.CONTROL_PILEUP);
  assert.equal(model.needsLayeredPlayback, true);
  assert.match(model.callerHint, /^2 /);
  assert.deepEqual(current, snapshot);

  current = advanceLightsPlayback(current);
  current = submitLightsTransmission(current, "SIMF000 K");
  current = tickLightsRun(current, 65_000);
  model = lightsUiModel(current, "en");
  assert.match(model.errorText, /callsign/i);
  assert.equal(model.timerText, "06:55");
});

test("completed runs expose the recomputed grade and enable settlement", () => {
  const complete = {
    ...run("practice"),
    phase: LIGHTS_PHASES.RUN_COMPLETE,
    elapsedMs: 480_000,
    contacts: [],
  };
  const model = lightsUiModel(complete, "en");
  assert.equal(model.canSettle, true);
  assert.equal(model.grade, "none");
  assert.equal(model.timerText, "00:00");
});
