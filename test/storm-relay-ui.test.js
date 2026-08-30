import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { STORM_RELAY_PHASES } from "../src/game/stormRelayRun.js";
import {
  STORM_RELAY_SETTLED_TEXT, STORM_RELAY_TEXT, stormRelayLeaveRisk,
} from "../src/screens/stormRelayText.js";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("Chapter 12 screen uses physical CW for check-in, verification, and relay without a portrait", () => {
  const screen = read("src/screens/StormRelayScreen.jsx");
  assert.match(screen, /data-testid="storm-relay-screen"/);
  assert.match(screen, /data-simulation="fictional-storm-relay"/);
  assert.match(screen, /data-storm-phase=\{run\.phase\}/);
  assert.match(screen, /data-storm-paused=\{inputBlocked \|\| !windowActive\}/);
  assert.match(screen, /data-pulse-count=\{cw\.analysis\.pulseCount\}/);
  assert.match(screen, /data-decoded=\{cw\.analysis\.decoded\}/);
  assert.match(screen, /data-portrait-visible="false"/);
  assert.match(screen, /useCwCore/);
  assert.match(screen, /cw\.beginManual\(\)/);
  assert.match(screen, /cw\.beginAutomatic\("\."\)/);
  assert.match(screen, /cw\.beginAutomatic\("-"\)/);
  assert.match(screen, /cwgameSystem\?\.interpretCwTraffic/);
  assert.match(screen, /data-action="storm-receive-conflict"/);
  assert.match(screen, /data-action="storm-submit"/);
  assert.match(screen, /data-action="storm-retry"/);
  assert.match(screen, /data-action="storm-settle"/);
  assert.doesNotMatch(screen, /<input|<textarea/);
  assert.doesNotMatch(screen, /<img[^>]+portrait/i);
});

test("Chapter 12 copy is nonempty and shape-identical in all seven languages", () => {
  const keys = Object.keys(STORM_RELAY_TEXT.en);
  assert.deepEqual(Object.keys(STORM_RELAY_TEXT), ["zh-CN", "zh-TW", "ja", "en", "es", "de", "ru"]);
  for (const [language, dictionary] of Object.entries(STORM_RELAY_TEXT)) {
    assert.deepEqual(Object.keys(dictionary), keys, `${language} keys`);
    assert.ok(Object.values(dictionary).every((value) => typeof value === "string" && value.trim()), `${language} text`);
  }
  assert.equal(Object.keys(STORM_RELAY_SETTLED_TEXT).length, 7);
  for (const language of ["es", "de", "ru"]) assert.notDeepEqual(STORM_RELAY_TEXT[language], STORM_RELAY_TEXT.en);
});

test("Chapter 12 route, mission, replay, archive, leave guard, and responsive contracts are connected", () => {
  const app = read("src/App.jsx");
  const home = read("src/screens/HomeScreen.jsx");
  const mission = read("src/screens/MissionCenterModal.jsx");
  const archive = read("src/screens/StructuredMessageLogModal.jsx");
  const css = read("src/pixel-theme.css");
  assert.match(app, /screen === "storm-relay"/);
  assert.match(home, /stormRelayReplayAvailable\(save\)/);
  assert.match(home, /data-action="enter-storm-relay-home"/);
  assert.match(mission, /mission\.id === "story-12" && \(active \|\| stormRelayReplay\)/);
  assert.match(mission, /data-action="launch-storm-relay"/);
  assert.match(archive, /stormRecords/);
  assert.match(css, /@media \(max-width: 820px\)[\s\S]*\.storm-relay-screen/);
  assert.equal(stormRelayLeaveRisk({ phase: STORM_RELAY_PHASES.CONFLICT }, false), "active");
  assert.equal(stormRelayLeaveRisk({ phase: STORM_RELAY_PHASES.COMPLETED }, false), "unsaved");
  assert.equal(stormRelayLeaveRisk({ phase: STORM_RELAY_PHASES.COMPLETED }, true), "none");
  assert.equal(stormRelayLeaveRisk({ phase: STORM_RELAY_PHASES.FAILED }, false), "none");
});
