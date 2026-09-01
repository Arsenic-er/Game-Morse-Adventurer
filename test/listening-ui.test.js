import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { LISTENING_PHASES } from "../src/game/listeningRun.js";
import {
  LISTENING_SETTLED_TEXT, LISTENING_TEXT, listeningLeaveRisk,
} from "../src/screens/listeningText.js";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("Chapter 11 screen uses physical CW and records bounded silence without a portrait", () => {
  const screen = read("src/screens/ListeningScreen.jsx");
  assert.match(screen, /data-testid="listening-screen"/);
  assert.match(screen, /data-simulation="fictional-listening-story"/);
  assert.match(screen, /data-listening-phase=\{run\.phase\}/);
  assert.match(screen, /data-listening-paused=\{inputBlocked \|\| !windowActive\}/);
  assert.match(screen, /data-pulse-count=\{cw\.analysis\.pulseCount\}/);
  assert.match(screen, /data-decoded=\{cw\.analysis\.decoded\}/);
  assert.match(screen, /data-portrait-visible="false"/);
  assert.match(screen, /useCwCore/);
  assert.match(screen, /cw\.beginManual\(\)/);
  assert.match(screen, /cw\.beginAutomatic\("\."\)/);
  assert.match(screen, /cw\.beginAutomatic\("-"\)/);
  assert.match(screen, /cwgameSystem\?\.interpretCwTraffic/);
  assert.match(screen, /data-action="listening-observe"/);
  assert.match(screen, /data-action="listening-submit"/);
  assert.match(screen, /data-action="listening-call-again"/);
  assert.match(screen, /data-action="listening-record-silence"/);
  assert.match(screen, /data-action="listening-retry"/);
  assert.match(screen, /data-action="listening-settle"/);
  assert.doesNotMatch(screen, /<input|<textarea/);
  assert.doesNotMatch(screen, /<img[^>]+portrait/i);
});

test("Chapter 11 decision timer survives active-clock run updates", () => {
  const screen = read("src/screens/ListeningScreen.jsx");
  assert.match(
    screen,
    /setRun\(\(current\) => \{[\s\S]*finishListeningWait\(current, nowIso\(\)\)[\s\S]*onRunChangeRef\.current\(next\)[\s\S]*return next;/,
  );
  assert.match(
    screen,
    /\}, \[inputBlocked, run\.phase, windowActive\]\);/,
  );
  assert.doesNotMatch(
    screen,
    /finishListeningWait\(run, nowIso\(\)\)[\s\S]*\[inputBlocked, run, update, windowActive\]/,
  );
});

test("Chapter 11 copy is nonempty and shape-identical in all seven languages", () => {
  const keys = Object.keys(LISTENING_TEXT.en);
  assert.deepEqual(Object.keys(LISTENING_TEXT), ["zh-CN", "zh-TW", "ja", "en", "es", "de", "ru"]);
  for (const [language, dictionary] of Object.entries(LISTENING_TEXT)) {
    assert.deepEqual(Object.keys(dictionary), keys, `${language} keys`);
    assert.ok(Object.values(dictionary).every((value) => typeof value === "string" && value.trim()), `${language} text`);
  }
  assert.equal(Object.keys(LISTENING_SETTLED_TEXT).length, 7);
  for (const language of ["es", "de", "ru"]) assert.notDeepEqual(LISTENING_TEXT[language], LISTENING_TEXT.en);
});

test("Chapter 11 route, mission, replay, leave guard, and responsive contracts are connected", () => {
  const app = read("src/App.jsx");
  const home = read("src/screens/HomeScreen.jsx");
  const mission = read("src/screens/MissionCenterModal.jsx");
  const css = read("src/pixel-theme.css");
  assert.match(app, /screen === "listening"/);
  assert.match(home, /listeningReplayAvailable\(save\)/);
  assert.match(home, /data-action="enter-listening-home"/);
  assert.match(mission, /mission\.id === "story-11" && \(active \|\| listeningReplay\)/);
  assert.match(mission, /data-action="launch-listening"/);
  assert.match(css, /@media \(max-width: 820px\)[\s\S]*\.listening-screen/);
  assert.equal(listeningLeaveRisk({ phase: LISTENING_PHASES.LISTENING }, false), "active");
  assert.equal(listeningLeaveRisk({ phase: LISTENING_PHASES.COMPLETED }, false), "unsaved");
  assert.equal(listeningLeaveRisk({ phase: LISTENING_PHASES.COMPLETED }, true), "none");
  assert.equal(listeningLeaveRisk({ phase: LISTENING_PHASES.FAILED }, false), "none");
});
