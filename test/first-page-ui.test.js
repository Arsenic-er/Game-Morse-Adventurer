import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { OPEN_STATION_GOALS } from "../src/game/openStationState.js";
import { FIRST_PAGE_TEXT } from "../src/screens/firstPageText.js";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("Chapter 15 first page exposes only fixed goals and retained ordinary-QSO facts", () => {
  const modal = read("src/screens/FirstPageModal.jsx");
  assert.match(modal, /data-testid="first-page-modal"/);
  assert.match(modal, /OPEN_STATION_GOALS/);
  assert.match(modal, /data-first-page-qso-id/);
  assert.match(modal, /data-first-page-goal/);
  assert.match(modal, /data-action="select-first-page-goal"/);
  assert.match(modal, /data-action="settle-first-page"/);
  assert.match(modal, /callsign/);
  assert.match(modal, /location/);
  assert.doesNotMatch(modal, /<input|<textarea/);
  assert.deepEqual(OPEN_STATION_GOALS, ["world-log", "people-network", "field-operations", "public-service", "contest-craft"]);
});

test("Chapter 15 copy is nonempty and shape-identical in all seven languages", () => {
  const keys = Object.keys(FIRST_PAGE_TEXT.en);
  assert.deepEqual(Object.keys(FIRST_PAGE_TEXT), ["zh-CN", "zh-TW", "ja", "en", "es", "de", "ru"]);
  for (const [language, dictionary] of Object.entries(FIRST_PAGE_TEXT)) {
    assert.deepEqual(Object.keys(dictionary), keys, `${language} keys`);
    assert.ok(Object.values(dictionary).every((value) => typeof value === "string" && value.trim()), `${language} text`);
  }
});

test("mission entry routes through the ordinary station and Home opens the fixed-choice first page", () => {
  const app = read("src/App.jsx");
  const home = read("src/screens/HomeScreen.jsx");
  const mission = read("src/screens/MissionCenterModal.jsx");
  const css = read("src/pixel-theme.css");
  assert.match(app, /settleFirstPageForActiveSave/);
  assert.match(home, /data-action="open-first-page"/);
  assert.match(home, /<FirstPageModal/);
  assert.match(mission, /mission\.id === "story-15" && active/);
  assert.match(mission, /data-action="launch-first-page-qso"/);
  assert.match(mission, /onLaunchFirstPageQso/);
  assert.match(css, /@media \(max-width: 820px\)[\s\S]*\.first-page-modal/);
});
