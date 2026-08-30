import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { OPEN_STATION_TEXT } from "../src/screens/openStationText.js";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("Open Station renders five offline progress lines, goal controls, and bounded history", () => {
  const modal = read("src/screens/OpenStationModal.jsx");
  assert.match(modal, /data-testid="open-station-modal"/);
  assert.match(modal, /buildOpenStationDashboard/);
  assert.match(modal, /data-open-station-line/);
  assert.match(modal, /data-open-station-active-goal/);
  assert.match(modal, /data-action="update-open-station-goal"/);
  assert.match(modal, /data-testid="open-station-recent"/);
  assert.doesNotMatch(modal, /fetch\(|WebSocket|EventSource|leaderboard|<input|<textarea/);
});

test("Open Station copy is complete in all seven languages", () => {
  const keys = Object.keys(OPEN_STATION_TEXT.en);
  assert.deepEqual(Object.keys(OPEN_STATION_TEXT), ["zh-CN", "zh-TW", "ja", "en", "es", "de", "ru"]);
  for (const [language, dictionary] of Object.entries(OPEN_STATION_TEXT)) {
    assert.deepEqual(Object.keys(dictionary), keys, `${language} keys`);
    assert.ok(Object.values(dictionary).every((value) => typeof value === "string" && value.trim()), `${language} text`);
  }
});

test("Home and claimed Chapter 15 expose the permanent responsive Open Station entry", () => {
  const app = read("src/App.jsx");
  const home = read("src/screens/HomeScreen.jsx");
  const mission = read("src/screens/MissionCenterModal.jsx");
  const css = read("src/pixel-theme.css");
  assert.match(app, /updateOpenStationGoalForActiveSave/);
  assert.match(home, /data-action="open-open-station"/);
  assert.match(home, /OPEN_STATION_TEXT/);
  assert.match(home, /openStationText\.title/);
  assert.match(home, /<OpenStationModal/);
  assert.match(mission, /mission\.id === "story-15" && mission\.status === "claimed"/);
  assert.match(mission, /data-action="open-station-dashboard"/);
  assert.match(mission, /openStationTitle/);
  assert.match(mission, /onOpenStation/);
  assert.match(css, /@media \(max-width: 820px\)[\s\S]*\.open-station-modal/);
});
