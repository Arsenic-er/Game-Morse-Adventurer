import test from "node:test";
import assert from "node:assert/strict";
import { createLightsRun, LIGHTS_PHASES } from "../src/game/lightsRun.js";
import {
  activityUnloadRisk, createActivityPlaybackLifecycle, registerActivityPlaybackVisibility,
} from "../src/game/lightsUiModel.js";
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

test("ordinary QSO playback cancels while hidden, stops audio, and resumes exactly once when visible", () => {
  const callbacks = new Map();
  let nextTimerId = 0;
  let stopAllCalls = 0;
  let stopListeningCalls = 0;
  let playCalls = 0;
  const lifecycle = createActivityPlaybackLifecycle({
    setTimeoutFn: (callback) => {
      const id = ++nextTimerId;
      callbacks.set(id, callback);
      return id;
    },
    clearTimeoutFn: (id) => callbacks.delete(id),
    stopAll: () => { stopAllCalls += 1; },
    stopListening: () => { stopListeningCalls += 1; },
  });

  lifecycle.requestPlayback(250, () => { playCalls += 1; });
  const staleCallback = callbacks.get(1);
  lifecycle.setVisible(false);
  assert.equal(stopAllCalls, 1);
  assert.equal(stopListeningCalls, 1);
  assert.equal(callbacks.size, 0);
  staleCallback();
  assert.equal(playCalls, 0);

  lifecycle.setVisible(true);
  lifecycle.setVisible(true);
  assert.equal(callbacks.size, 1);
  callbacks.get(2)();
  assert.equal(playCalls, 1);
});

test("activity visibility listeners wait for focus, handle mount-hidden, and clean up", () => {
  function eventTarget() {
    const listeners = new Map();
    return {
      addEventListener(type, listener) { listeners.set(type, listener); },
      removeEventListener(type, listener) { if (listeners.get(type) === listener) listeners.delete(type); },
      emit(type) { listeners.get(type)?.(); },
      listenerCount() { return listeners.size; },
    };
  }
  const fakeWindow = eventTarget();
  const fakeDocument = { ...eventTarget(), visibilityState: "visible", focused: true, hasFocus() { return this.focused; } };
  const callbacks = new Map();
  let nextTimerId = 0;
  let stopCalls = 0;
  let playCalls = 0;
  const lifecycle = createActivityPlaybackLifecycle({
    setTimeoutFn: (callback) => {
      const id = ++nextTimerId;
      callbacks.set(id, () => { callbacks.delete(id); callback(); });
      return id;
    },
    clearTimeoutFn: (id) => callbacks.delete(id),
    stopAll: () => { stopCalls += 1; },
    stopListening: () => { stopCalls += 1; },
  });
  const activeStates = [];
  const cleanup = registerActivityPlaybackVisibility({
    windowTarget: fakeWindow, documentTarget: fakeDocument, lifecycle,
    onActiveChange: (active) => activeStates.push(active),
  });
  lifecycle.requestPlayback(250, () => { playCalls += 1; });
  const staleCallback = callbacks.get(1);
  fakeWindow.emit("blur");
  staleCallback();
  assert.equal(playCalls, 0);
  assert.equal(stopCalls, 2);

  fakeDocument.visibilityState = "hidden";
  fakeDocument.emit("visibilitychange");
  fakeDocument.visibilityState = "visible";
  fakeDocument.focused = false;
  fakeDocument.emit("visibilitychange");
  assert.equal(callbacks.size, 0);
  fakeDocument.focused = true;
  fakeWindow.emit("focus");
  callbacks.get(2)();
  assert.equal(playCalls, 1);
  assert.deepEqual(activeStates, [true, false, false, false, true]);

  cleanup();
  assert.equal(fakeWindow.listenerCount(), 0);
  assert.equal(fakeDocument.listenerCount(), 0);

  const hiddenDocument = { ...eventTarget(), visibilityState: "hidden", focused: false, hasFocus() { return this.focused; } };
  const hiddenLifecycle = createActivityPlaybackLifecycle({
    setTimeoutFn: (callback) => {
      const id = ++nextTimerId;
      callbacks.set(id, () => { callbacks.delete(id); callback(); });
      return id;
    },
    clearTimeoutFn: (id) => callbacks.delete(id),
    stopAll: () => { stopCalls += 1; },
    stopListening: () => { stopCalls += 1; },
  });
  hiddenLifecycle.requestPlayback(250, () => { playCalls += 1; });
  const cleanupHidden = registerActivityPlaybackVisibility({
    windowTarget: eventTarget(), documentTarget: hiddenDocument, lifecycle: hiddenLifecycle,
  });
  assert.equal(callbacks.size, 0);
  cleanupHidden();
});
