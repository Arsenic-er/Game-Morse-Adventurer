import test from "node:test";
import assert from "node:assert/strict";
import { LANGUAGE_IDS } from "../src/i18n/languageRegistry.js";
import {
  LIGHTS_PHASES, advanceLightsPlayback, createLightsRun, submitLightsTransmission, tickLightsRun,
} from "../src/game/lightsRun.js";
import {
  lightsExitNeedsConfirmation, lightsRunSeed, lightsTimerShouldRun, lightsUiModel,
} from "../src/game/lightsUiModel.js";
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
  let current = submitLightsTransmission(run("annual", "hints"), "CQ LGT CQ LGT DE SIM5LT K");
  const snapshot = structuredClone(current);
  let model = lightsUiModel(current, "en");
  assert.equal(current.phase, LIGHTS_PHASES.CONTROL_PILEUP);
  assert.equal(model.needsLayeredPlayback, true);
  assert.match(model.callerHint, /^\d+ /);
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

test("control time includes radio playback but pauses for menus and an inactive window", () => {
  const phase = LIGHTS_PHASES.CONTROL_PILEUP;
  assert.equal(lightsTimerShouldRun({ phase, isPlaying: true }), true);
  assert.equal(lightsTimerShouldRun({ phase, inputBlocked: true }), false);
  assert.equal(lightsTimerShouldRun({ phase, windowActive: false }), false);
  assert.equal(lightsTimerShouldRun({ phase: LIGHTS_PHASES.CHASE_CQ }), false);
});

test("completed but unsettled results remain protected from accidental exit", () => {
  const complete = { ...run("practice"), phase: LIGHTS_PHASES.RUN_COMPLETE };
  assert.equal(lightsExitNeedsConfirmation(complete, { settled: false }), true);
  assert.equal(lightsExitNeedsConfirmation(complete, { settled: true }), false);
  assert.equal(lightsExitNeedsConfirmation(run("story"), { settled: false }), false);
});

test("guidance off never reveals the number of callers in a pile-up", () => {
  const fullPileup = submitLightsTransmission(run("annual", "off"), "CQ LGT CQ LGT DE SIM5LT K");
  assert.equal(lightsUiModel(fullPileup, "en").callerHint, "");
  const hintedPileup = submitLightsTransmission(run("annual", "hints"), "CQ LGT CQ LGT DE SIM5LT K");
  assert.match(lightsUiModel(hintedPileup, "en").callerHint, /^\d+ /);
});

test("story rosters stay fixed, annual rosters rotate by station year, and practice runs vary", () => {
  const first = { year: 2026, dateKey: "2026-05-01" };
  const later = { year: 2026, dateKey: "2026-05-06" };
  assert.equal(
    lightsRunSeed({ saveId: "save-1", mode: "story", stationDate: first, startedAt: "2026-05-01T00:00:00Z" }),
    lightsRunSeed({ saveId: "save-1", mode: "story", stationDate: later, startedAt: "2026-05-06T00:00:00Z" }),
  );
  assert.equal(
    lightsRunSeed({ saveId: "save-1", mode: "annual", stationDate: first }),
    lightsRunSeed({ saveId: "save-1", mode: "annual", stationDate: later }),
  );
  assert.notEqual(
    lightsRunSeed({ saveId: "save-1", mode: "annual", stationDate: first }),
    lightsRunSeed({ saveId: "save-1", mode: "annual", stationDate: { year: 2027, dateKey: "2027-05-01" } }),
  );
  assert.notEqual(
    lightsRunSeed({ saveId: "save-1", mode: "practice", stationDate: first, startedAt: "2026-05-01T00:00:00Z" }),
    lightsRunSeed({ saveId: "save-1", mode: "practice", stationDate: first, startedAt: "2026-05-01T00:01:00Z" }),
  );
});
