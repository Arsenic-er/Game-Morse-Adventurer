import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createLightsRun, LIGHTS_PHASES } from "../src/game/lightsRun.js";
import { activityUnloadRisk } from "../src/game/lightsUiModel.js";
import { createQso, QSO_PHASES } from "../src/qso/qsoEngine.js";
import { qsoExitRisk } from "../src/qso/qsoExitGuard.js";

test("generic activity unload guard protects live and completed-unsettled lights, ordinary QSOs, and Home", () => {
  const liveLights = {
    ...createLightsRun({ mode: "practice", playerCallsign: "BH1ABC", playerRegion: "CN", seed: "guard-live" }),
    elapsedMs: 1,
  };
  const completedLights = { ...liveLights, phase: LIGHTS_PHASES.RUN_COMPLETE };
  const liveQso = { ...createQso({ npc: { callsign: "SIM7QX", regionId: "NA-SIM", finalLevel: 3, wpm: 18 } }), phase: QSO_PHASES.WAITING_RESPONSE };

  assert.equal(activityUnloadRisk({ activity: "lights", run: liveLights, settled: false }), "active");
  assert.equal(activityUnloadRisk({ activity: "lights", run: completedLights, settled: false }), "unsaved");
  assert.equal(activityUnloadRisk({ activity: "qso", risk: qsoExitRisk(liveQso) }), "active");
  assert.equal(activityUnloadRisk({ activity: "home" }), "none");
});

test("ordinary QSO visibility loss stops all playback and receiver noise", () => {
  const source = readFileSync(new URL("../src/App.jsx", import.meta.url), "utf8");
  const stationScreen = source.slice(source.indexOf("function StationScreen"), source.indexOf("export function App"));
  assert.match(stationScreen, /function onVisibilityChange\(\)\s*\{[\s\S]*document\.visibilityState === "hidden"[\s\S]*cw\.stopAll\(\)[\s\S]*cw\.stopListening\(\)/);
  assert.match(stationScreen, /document\.addEventListener\("visibilitychange", onVisibilityChange\)/);
  assert.match(stationScreen, /document\.removeEventListener\("visibilitychange", onVisibilityChange\)/);
});
