import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { NIGHT_OPERATIONS_TEXT, nightOperationsLeaveRisk } from "../src/screens/nightOperationsText.js";
import { NIGHT_OPERATIONS_PHASES } from "../src/game/nightOperationsRun.js";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("Chapter 13 screen schedules and exchanges through physical CW with no portrait or text input", () => {
  const screen = read("src/screens/NightOperationsScreen.jsx");
  assert.match(screen, /data-testid="night-operations-screen"/);
  assert.match(screen, /data-night-phase=\{run\.phase\}/);
  assert.match(screen, /data-night-paused=\{inputBlocked \|\| !windowActive\}/);
  assert.match(screen, /data-pulse-count=\{cw\.analysis\.pulseCount\}/);
  assert.match(screen, /data-decoded=\{cw\.analysis\.decoded\}/);
  assert.match(screen, /data-portrait-visible="false"/);
  assert.match(screen, /useCwCore/);
  assert.match(screen, /cw\.beginManual\(\)/);
  assert.match(screen, /cw\.beginAutomatic\("\."\)/);
  assert.match(screen, /cw\.beginAutomatic\("-"\)/);
  assert.match(screen, /cwgameSystem\?\.interpretCwTraffic/);
  assert.match(screen, /data-action="night-select-window"/);
  assert.match(screen, /data-action="night-submit"/);
  assert.match(screen, /data-action="night-settle"/);
  assert.match(screen, /data-action="night-retry"/);
  assert.doesNotMatch(screen, /<input|<textarea/);
  assert.doesNotMatch(screen, /<img[^>]+portrait/i);
});

test("Chapter 13 copy is nonempty and shape-identical in all seven languages", () => {
  const keys = Object.keys(NIGHT_OPERATIONS_TEXT.en);
  assert.deepEqual(Object.keys(NIGHT_OPERATIONS_TEXT), ["zh-CN", "zh-TW", "ja", "en", "es", "de", "ru"]);
  for (const [language, dictionary] of Object.entries(NIGHT_OPERATIONS_TEXT)) {
    assert.deepEqual(Object.keys(dictionary), keys, `${language} keys`);
    assert.ok(Object.values(dictionary).every((value) => typeof value === "string" && value.trim()), `${language} text`);
  }
});

test("Chapter 13 mission, replay, operations archive, leave guard, and responsive routes are connected", () => {
  const app = read("src/App.jsx");
  const home = read("src/screens/HomeScreen.jsx");
  const mission = read("src/screens/MissionCenterModal.jsx");
  const operations = read("src/screens/StationOperationsModal.jsx");
  const css = read("src/pixel-theme.css");
  assert.match(app, /screen === "night-operations"/);
  assert.match(home, /nightOperationsReplayAvailable\(save\)/);
  assert.match(home, /data-action="enter-night-operations-home"/);
  assert.match(home, /data-action="open-station-operations"/);
  assert.match(mission, /mission\.id === "story-13" && \(active \|\| nightOperationsReplay\)/);
  assert.match(mission, /data-action="launch-night-operations"/);
  assert.match(operations, /data-testid="station-operations-modal"/);
  assert.match(operations, /data-operation-run-id/);
  assert.match(css, /@media \(max-width: 820px\)[\s\S]*\.night-operations-screen/);
  assert.equal(nightOperationsLeaveRisk({ phase: NIGHT_OPERATIONS_PHASES.BOARD }, false), "active");
  assert.equal(nightOperationsLeaveRisk({ phase: NIGHT_OPERATIONS_PHASES.COMPLETED }, false), "unsaved");
  assert.equal(nightOperationsLeaveRisk({ phase: NIGHT_OPERATIONS_PHASES.COMPLETED }, true), "none");
  assert.equal(nightOperationsLeaveRisk({ phase: NIGHT_OPERATIONS_PHASES.FAILED }, false), "none");
});
