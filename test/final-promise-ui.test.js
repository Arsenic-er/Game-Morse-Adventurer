import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { FINAL_PROMISE_PHASES } from "../src/game/finalPromiseRun.js";
import { FINAL_PROMISE_TEXT, finalPromiseLeaveRisk } from "../src/screens/finalPromiseText.js";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("Chapter 14 screen recalls fixed facts and transmits only through physical CW", () => {
  const screen = read("src/screens/FinalPromiseScreen.jsx");
  assert.match(screen, /data-testid="final-promise-screen"/);
  assert.match(screen, /data-final-promise-phase=\{run\.phase\}/);
  assert.match(screen, /data-pulse-count=\{cw\.analysis\.pulseCount\}/);
  assert.match(screen, /data-decoded=\{cw\.analysis\.decoded\}/);
  assert.match(screen, /data-portrait-visible="false"/);
  assert.match(screen, /useCwCore/);
  assert.match(screen, /cw\.beginManual\(\)/);
  assert.match(screen, /cw\.beginAutomatic\("\."\)/);
  assert.match(screen, /cw\.beginAutomatic\("-"\)/);
  assert.match(screen, /cwgameSystem\?\.interpretCwTraffic/);
  assert.match(screen, /data-action="final-promise-review"/);
  assert.match(screen, /data-action="final-promise-submit"/);
  assert.match(screen, /data-action="final-promise-clear"/);
  assert.match(screen, /data-action="final-promise-tone"/);
  assert.match(screen, /data-action="final-promise-settle"/);
  assert.doesNotMatch(screen, /<input|<textarea/);
  assert.doesNotMatch(screen, /<img[^>]+portrait/iu);
});

test("Chapter 14 copy is nonempty and shape-identical in all seven languages", () => {
  const keys = Object.keys(FINAL_PROMISE_TEXT.en);
  assert.deepEqual(Object.keys(FINAL_PROMISE_TEXT), ["zh-CN", "zh-TW", "ja", "en", "es", "de", "ru"]);
  for (const [language, dictionary] of Object.entries(FINAL_PROMISE_TEXT)) {
    assert.deepEqual(Object.keys(dictionary), keys, `${language} keys`);
    assert.ok(Object.values(dictionary).every((value) => typeof value === "string" && value.trim()), `${language} text`);
  }
});

test("mission launch, Home replay, final-page archive, leave guard, and responsive route are connected", () => {
  const app = read("src/App.jsx");
  const home = read("src/screens/HomeScreen.jsx");
  const mission = read("src/screens/MissionCenterModal.jsx");
  const people = read("src/screens/PeopleAndQslModal.jsx");
  const css = read("src/pixel-theme.css");
  assert.match(app, /screen === "final-promise"/);
  assert.match(home, /finalPromiseReplayAvailable\(save\)/);
  assert.match(home, /data-action="enter-final-promise-home"/);
  assert.match(mission, /mission\.id === "story-14" && \(active \|\| finalPromiseReplay\)/);
  assert.match(mission, /data-action="launch-final-promise"/);
  assert.match(people, /data-final-page-run-id/);
  assert.match(people, /chapter14\.archive/);
  assert.match(css, /@media \(max-width: 820px\)[\s\S]*\.final-promise-screen/);
  assert.equal(finalPromiseLeaveRisk({ phase: FINAL_PROMISE_PHASES.REVIEW }, false), "active");
  assert.equal(finalPromiseLeaveRisk({ phase: FINAL_PROMISE_PHASES.COMPLETED }, false), "unsaved");
  assert.equal(finalPromiseLeaveRisk({ phase: FINAL_PROMISE_PHASES.COMPLETED }, true), "none");
  assert.equal(finalPromiseLeaveRisk({ phase: FINAL_PROMISE_PHASES.FAILED }, false), "none");
});
