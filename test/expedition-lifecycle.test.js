import assert from "node:assert/strict";
import test from "node:test";

import { createExpeditionLoadout } from "../src/game/expeditionCatalog.js";
import {
  advanceExpeditionSetup, attemptExpeditionSetup, beginExpeditionCq, createExpeditionRun,
  selectExpeditionSite, tickExpeditionRun,
} from "../src/game/expeditionRun.js";
import {
  createExpeditionActiveClock, expeditionPageIsActive, expeditionReplayAvailable,
  expeditionTimerShouldRun, registerExpeditionPageVisibility,
} from "../src/game/expeditionLifecycle.js";
import { expeditionUiModel } from "../src/screens/expeditionText.js";

function freshRun(runId) {
  return createExpeditionRun({
    runId,
    playerCallsign: "BH1ABC",
    loadout: createExpeditionLoadout({}, { source: "loan" }),
    startedAt: "2026-08-26T09:00:00.000Z",
  });
}

function activeRun(runId) {
  let run = selectExpeditionSite(freshRun(runId), "sunward-hill", "2026-08-26T09:00:01.000Z");
  run = advanceExpeditionSetup(run, "antenna", "2026-08-26T09:00:02.000Z");
  run = advanceExpeditionSetup(run, "power", "2026-08-26T09:00:03.000Z");
  return beginExpeditionCq(run, { observedAt: "2026-08-26T09:00:04.000Z" });
}

test("the active expedition clock uses monotonic deltas and never charges a paused interval", () => {
  let monotonicNow = 100;
  let scheduled = null;
  const cleared = [];
  const elapsed = [];
  const clock = createExpeditionActiveClock({
    now: () => monotonicNow,
    setIntervalFn(callback, milliseconds) {
      assert.equal(milliseconds, 250);
      scheduled = callback;
      return "timer-1";
    },
    clearIntervalFn(timer) { cleared.push(timer); },
    onElapsed(milliseconds) { elapsed.push(milliseconds); },
  });

  clock.setActive(true);
  monotonicNow = 350;
  scheduled();
  clock.setActive(false);
  monotonicNow = 10_350;
  assert.equal(clock.sample(), 0);
  clock.setActive(true);
  monotonicNow = 10_600;
  scheduled();
  clock.dispose();

  assert.deepEqual(elapsed, [250, 250]);
  assert.ok(cleared.length >= 2);
});

test("settings, terminal phases, hidden documents and blurred windows pause expedition time", () => {
  assert.equal(expeditionTimerShouldRun({ status: "site-selection" }), false);
  assert.equal(expeditionTimerShouldRun({ status: "setup" }), true);
  assert.equal(expeditionTimerShouldRun({ status: "calling" }), true);
  assert.equal(expeditionTimerShouldRun({ status: "calling", inputBlocked: true }), false);
  assert.equal(expeditionTimerShouldRun({ status: "calling", windowActive: false }), false);
  assert.equal(expeditionTimerShouldRun({ status: "completed" }), false);
  assert.equal(expeditionTimerShouldRun({ status: "failed" }), false);

  function target() {
    const listeners = new Map();
    return {
      listeners,
      addEventListener(type, listener) { listeners.set(type, listener); },
      removeEventListener(type, listener) {
        if (listeners.get(type) === listener) listeners.delete(type);
      },
    };
  }
  const windowTarget = target();
  const documentTarget = {
    ...target(),
    visibilityState: "visible",
    focused: true,
    hasFocus() { return this.focused; },
  };
  const activeStates = [];
  const unregister = registerExpeditionPageVisibility({
    windowTarget,
    documentTarget,
    onActiveChange(active) { activeStates.push(active); },
  });
  assert.equal(expeditionPageIsActive(documentTarget), true);
  windowTarget.listeners.get("blur")();
  documentTarget.visibilityState = "hidden";
  documentTarget.listeners.get("visibilitychange")();
  documentTarget.visibilityState = "visible";
  documentTarget.focused = true;
  windowTarget.listeners.get("focus")();
  unregister();

  assert.deepEqual(activeStates, [true, false, false, true]);
  assert.equal(windowTarget.listeners.size, 0);
  assert.equal(documentTarget.listeners.size, 0);
});

test("runtime clock reaches the fifteen-minute timeout and legal setup can deplete the battery", () => {
  let monotonicNow = 0;
  let timeoutRun = activeRun("runtime-timeout");
  const timeoutClock = createExpeditionActiveClock({
    now: () => monotonicNow,
    setIntervalFn: () => 1,
    clearIntervalFn: () => {},
    onElapsed(milliseconds) {
      timeoutRun = tickExpeditionRun(
        timeoutRun,
        { seconds: milliseconds / 1_000, transmitting: false },
        "2026-08-26T09:15:00.000Z",
      );
    },
  });
  timeoutClock.setActive(true);
  monotonicNow = 900_000;
  timeoutClock.sample();
  assert.equal(timeoutRun.status, "failed");
  assert.equal(timeoutRun.failureReason, "TIMED_OUT");
  assert.match(expeditionUiModel(timeoutRun, { language: "en" }).failureText, /time/i);

  let batteryRun = selectExpeditionSite(
    freshRun("runtime-battery"),
    "sunward-hill",
    "2026-08-26T10:00:01.000Z",
  );
  batteryRun = advanceExpeditionSetup(batteryRun, "antenna", "2026-08-26T10:00:02.000Z");
  for (let mistake = 1; mistake <= 3; mistake += 1) {
    batteryRun = attemptExpeditionSetup(
      batteryRun,
      "power",
      { valid: false, errorCode: "INVALID_POWER" },
      `2026-08-26T10:00:0${2 + mistake}.000Z`,
    );
  }
  assert.equal(batteryRun.status, "failed");
  assert.equal(batteryRun.failureReason, "POWER_DEPLETED");
  assert.equal(batteryRun.power.remainingWh, 0);
  assert.match(expeditionUiModel(batteryRun, { language: "en" }).failureText, /battery/i);
});

test("expedition replay remains locked before acceptance and survives either durable unlock proof", () => {
  const beforeAcceptance = {
    missionState: { claimedMissionIds: ["story-01", "story-02", "story-03", "story-04", "story-05"] },
    expeditionState: { expeditionTreeUnlocked: false },
  };
  assert.equal(expeditionReplayAvailable(beforeAcceptance), false);
  assert.equal(expeditionReplayAvailable({
    ...beforeAcceptance,
    missionState: { claimedMissionIds: [...beforeAcceptance.missionState.claimedMissionIds, "story-06"] },
  }), true);
  const unlocked = { ...beforeAcceptance, expeditionState: { expeditionTreeUnlocked: true } };
  assert.equal(expeditionReplayAvailable(unlocked), true);
  assert.equal(expeditionReplayAvailable(JSON.parse(JSON.stringify(unlocked))), true);
});
