import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { CONTEST_PHASES } from "../src/game/contestRun.js";
import { CONTEST_SETTLED_TEXT, CONTEST_TEXT, contestLeaveRisk } from "../src/screens/contestText.js";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("Chapter 10 screen exposes RUN, S&P, real keying, scoring, penalties, and no portrait", () => {
  const screen = read("src/screens/ContestScreen.jsx");
  assert.match(screen, /data-testid="contest-screen"/);
  assert.match(screen, /data-simulation="fictional-five-minute-contest"/);
  assert.match(screen, /data-contest-phase=\{run\.phase\}/);
  assert.match(screen, /data-contest-mode=\{run\.mode \?\? ""\}/);
  assert.match(screen, /data-contest-contact-count=\{run\.contacts\.length\}/);
  assert.match(screen, /data-contest-score=\{score\.score\}/);
  assert.match(screen, /data-contest-wpm=\{save\.automaticKeyWpm\}/);
  assert.match(screen, /data-contest-paused=\{inputBlocked \|\| !windowActive\}/);
  assert.match(screen, /data-contest-keying=\{cw\.isKeying\}/);
  assert.match(screen, /data-action="contest-mode-run"/);
  assert.match(screen, /data-action="contest-mode-sp"/);
  assert.match(screen, /data-action="contest-submit"/);
  assert.match(screen, /data-action="contest-agn"/);
  assert.match(screen, /data-action="contest-qrs"/);
  assert.doesNotMatch(screen, /transmit\("(?:AGN|QRS) K"\)/);
  assert.match(screen, /prepareRecovery\("AGN K"\)/);
  assert.match(screen, /prepareRecovery\("QRS K"\)/);
  assert.match(screen, /data-action="contest-finish"/);
  assert.match(screen, /data-action="contest-settle"/);
  assert.match(screen, /data-settlement-attempts=\{settlementAttempts\}/);
  assert.match(screen, /data-action="contest-settle" disabled=\{inputBlocked\}/);
  assert.match(screen, /settled && <p className="contest-settlement-banner" role="status">\{settledText\}/);
  assert.equal(Object.keys(CONTEST_SETTLED_TEXT).length, 7);
  assert.match(screen, /useCwCore/);
  assert.match(screen, /cw\.beginAutomatic\("\."\)/);
  assert.match(screen, /cw\.beginAutomatic\("-"\)/);
  assert.match(screen, /cwgameSystem\?\.interpretCwTraffic/);
  assert.match(screen, /data-portrait-visible="false"/);
  assert.doesNotMatch(screen, /<img[^>]+portrait/i);
  assert.doesNotMatch(screen, /leaderboard|online ranking|ARRL|CQ WW/i);
});

test("Chapter 10 copy is complete and localized in all seven interface languages", () => {
  const keys = Object.keys(CONTEST_TEXT.en);
  assert.deepEqual(Object.keys(CONTEST_TEXT), ["zh-CN", "zh-TW", "ja", "en", "es", "de", "ru"]);
  for (const [language, dictionary] of Object.entries(CONTEST_TEXT)) {
    assert.deepEqual(Object.keys(dictionary), keys, `${language} keys`);
    assert.ok(Object.values(dictionary).every((value) => typeof value === "string" && value.trim()), `${language} text`);
  }
  for (const language of ["es", "de", "ru"]) assert.notDeepEqual(CONTEST_TEXT[language], CONTEST_TEXT.en);
});

test("Chapter 10 route, mission, replay, leave guard, and responsive contracts stay connected", () => {
  const app = read("src/App.jsx");
  const home = read("src/screens/HomeScreen.jsx");
  const mission = read("src/screens/MissionCenterModal.jsx");
  const css = read("src/pixel-theme.css");
  assert.match(app, /screen === "contest"/);
  assert.match(home, /contestReplayAvailable\(save\)/);
  assert.match(home, /data-action="enter-contest-home"/);
  assert.match(mission, /mission\.id === "story-10" && \(active \|\| contestReplay\)/);
  assert.match(mission, /data-action="launch-contest"/);
  assert.match(css, /@media \(max-width: 820px\)[\s\S]*\.contest-screen/);
  assert.equal(contestLeaveRisk({ phase: CONTEST_PHASES.RUN_PILEUP }, false), "active");
  assert.equal(contestLeaveRisk({ phase: CONTEST_PHASES.COMPLETED }, false), "unsaved");
  assert.equal(contestLeaveRisk({ phase: CONTEST_PHASES.COMPLETED }, true), "none");
  assert.equal(contestLeaveRisk({ phase: CONTEST_PHASES.FAILED }, false), "none");
});
