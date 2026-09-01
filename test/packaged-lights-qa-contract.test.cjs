const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const Module = require("node:module");
const os = require("node:os");
const path = require("node:path");
const vm = require("node:vm");

const {
  automaticQaGapAfterElement, automaticQaShouldWaitForIdleAfterSymbol,
  buildLightsQaMoneyFlow, buildLightsQaPlan, capturePageWithVizRetry, formatLightsWaitFailure,
  focusQaWindow, lightsKeyInputForSymbol, LIGHTS_QA_WPM,
  QA_QSO_LOG_VERSION, runLightsQaCapture, selectLightsCallerFromRuntimeSnapshot, sendAutomaticLightsText,
  startGuidedQaWatch,
  validateLightsQaEvidence, validateStationEntryProbe,
} = require("../electron/qa-capture.cjs");

const QA_RUN_ID = "11111111-2222-4333-8444-555555555555";

test("capturePage retries only bounded UnknownViz compositor failures", async () => {
  let attempts = 0;
  const expectedImage = { toPNG: () => Buffer.from("image") };
  const recovered = await capturePageWithVizRetry({
    async capturePage() {
      attempts += 1;
      if (attempts < 3) throw new Error("UnknownVizError");
      return expectedImage;
    },
  }, { maxAttempts: 3, retryDelayMs: 0 });
  assert.equal(recovered, expectedImage);
  assert.equal(attempts, 3);

  let nonVizAttempts = 0;
  await assert.rejects(() => capturePageWithVizRetry({
    async capturePage() {
      nonVizAttempts += 1;
      throw new Error("RendererCrashed");
    },
  }, { maxAttempts: 3, retryDelayMs: 0 }), /RendererCrashed/);
  assert.equal(nonVizAttempts, 1);

  let exhaustedAttempts = 0;
  await assert.rejects(() => capturePageWithVizRetry({
    async capturePage() {
      exhaustedAttempts += 1;
      throw new Error("UnknownVizError");
    },
  }, { maxAttempts: 3, retryDelayMs: 0 }), /UnknownVizError/);
  assert.equal(exhaustedAttempts, 3);
});

test("capturePage bounds compositor calls that never settle", async () => {
  let attempts = 0;
  const capture = capturePageWithVizRetry({
    capturePage() {
      attempts += 1;
      return new Promise(() => {});
    },
  }, { maxAttempts: 2, retryDelayMs: 0, captureTimeoutMs: 10 });
  const outerTimeout = new Promise((_, reject) => {
    setTimeout(() => reject(new Error("TEST_TIMEOUT")), 250);
  });

  await assert.rejects(() => Promise.race([capture, outerTimeout]), /capturePage timed out after 10ms/);
  assert.equal(attempts, 2);
});

test("packaged QA refocuses the real renderer before starting a guided QSO watch", async () => {
  const calls = [];
  let focused = false;
  const qaWindow = {
    isMinimized: () => true,
    restore() { calls.push("restore"); },
    show() { calls.push("show"); },
    focus() { calls.push("window-focus"); focused = true; },
    webContents: {
      focus() { calls.push("renderer-focus"); focused = true; },
      async executeJavaScript(source) {
        if (source.trim().startsWith("({ hasFocus:")) {
          calls.push("renderer-focus-precheck");
          return { hasFocus: focused, visibilityState: "visible" };
        }
        if (source.includes("document.hasFocus()")) {
          calls.push("renderer-focus-check");
          assert.equal(focused, true);
          return true;
        }
        if (source.includes('data-action=\\"start-guided-watch\\"')) {
          calls.push("guided-watch-click");
          assert.equal(focused, true);
          return true;
        }
        if (source.includes('Boolean(document.querySelector') && source.includes('qso-briefing-modal')) {
          calls.push("briefing-present-check");
          return true;
        }
        if (source.includes('data-testid=\\"qso-briefing-modal\\"')) return true;
        if (source.includes('data-qso-phase=\\"PLAYER_CQ\\"')) return true;
        throw new Error(`Unexpected QA script: ${source}`);
      },
    },
  };

  await startGuidedQaWatch(qaWindow);

  assert.deepEqual(calls, [
    "renderer-focus-precheck", "restore", "show", "window-focus", "renderer-focus", "renderer-focus-check",
    "briefing-present-check", "guided-watch-click",
  ]);
});

test("packaged QA resumes an already briefed QSO without requiring the one-time modal", async () => {
  const calls = [];
  const qaWindow = {
    isMinimized: () => false,
    show() { calls.push("show"); },
    focus() { calls.push("window-focus"); },
    webContents: {
      focus() { calls.push("renderer-focus"); },
      async executeJavaScript(source) {
        if (source.trim().startsWith("({ hasFocus:")) return { hasFocus: true, visibilityState: "visible" };
        if (source.includes('Boolean(document.querySelector') && source.includes('qso-briefing-modal')) {
          calls.push("briefing-present-check");
          return false;
        }
        if (source.includes('data-action=\\"start-guided-watch\\"')) {
          throw new Error("The guided-watch button must not be clicked when its modal is absent");
        }
        if (source.includes('data-qso-phase=\\"PLAYER_CQ\\"')) {
          calls.push("player-cq-wait");
          return true;
        }
        throw new Error(`Unexpected QA script: ${source}`);
      },
    },
  };

  await startGuidedQaWatch(qaWindow);
  assert.deepEqual(calls, ["briefing-present-check", "player-cq-wait"]);
});

test("focusQaWindow is idempotent while the real renderer remains focused", async () => {
  const nativeCalls = [];
  const qaWindow = {
    isMinimized: () => false,
    restore() { nativeCalls.push("restore"); },
    show() { nativeCalls.push("show"); },
    focus() { nativeCalls.push("window-focus"); },
    webContents: {
      focus() { nativeCalls.push("renderer-focus"); },
      async executeJavaScript(source) {
        if (source.trim().startsWith("({ hasFocus:")) {
          return { hasFocus: true, visibilityState: "visible" };
        }
        throw new Error(`Unexpected QA script: ${source}`);
      },
    },
  };

  await focusQaWindow(qaWindow, "character one");
  await focusQaWindow(qaWindow, "character two");
  await focusQaWindow(qaWindow, "character three");
  assert.deepEqual(nativeCalls, []);
});

test("focusQaWindow restores a real blur once and fails closed when native focus cannot recover", async () => {
  let focused = false;
  const restoredCalls = [];
  const recoveredWindow = {
    isMinimized: () => true,
    restore() { restoredCalls.push("restore"); },
    show() { restoredCalls.push("show"); },
    focus() { restoredCalls.push("window-focus"); focused = true; },
    isFocused: () => focused,
    webContents: {
      focus() { restoredCalls.push("renderer-focus"); focused = true; },
      async executeJavaScript(source) {
        if (source.trim().startsWith("({ hasFocus:")) {
          return { hasFocus: focused, visibilityState: "visible" };
        }
        if (source.includes("new Promise")) {
          assert.equal(focused, true);
          return true;
        }
        throw new Error(`Unexpected QA script: ${source}`);
      },
    },
  };
  await focusQaWindow(recoveredWindow, "recover blur");
  assert.deepEqual(restoredCalls, ["restore", "show", "window-focus", "renderer-focus"]);

  const failedWindow = {
    isMinimized: () => false,
    show() {}, focus() {}, isFocused: () => false,
    webContents: {
      focus() {},
      async executeJavaScript(source) {
        if (source.trim().startsWith("({ hasFocus:")) {
          return { hasFocus: false, visibilityState: "visible" };
        }
        if (source.includes("new Promise")) throw new Error("renderer did not gain focus");
        throw new Error(`Unexpected QA script: ${source}`);
      },
    },
  };
  await assert.rejects(
    () => focusQaWindow(failedWindow, "unrecoverable blur"),
    /unrecoverable blur.*"windowIsFocused":false.*"hasFocus":false.*renderer did not gain focus/,
  );
});

test("packaged QA follows the production QSO log schema version", async () => {
  const { normalizeQsoLogEntry, QSO_LOG_VERSION } = await import("../src/qso/qsoLog.js");
  const normalized = normalizeQsoLogEntry({
    startedAt: "2026-08-25T00:00:00.000Z",
    completedAt: "2026-08-25T00:01:00.000Z",
    playerCallsign: "BH1ABC",
    callsign: "SIM5TU",
  });

  assert.equal(normalized.version, QSO_LOG_VERSION);
  assert.equal(QSO_LOG_VERSION, 9);
  assert.equal(QA_QSO_LOG_VERSION, QSO_LOG_VERSION);
  const qaSource = fs.readFileSync(path.join(__dirname, "..", "electron", "qa-capture.cjs"), "utf8");
  assert.match(qaSource, /savedEquipmentSnapshot\.version !== QA_QSO_LOG_VERSION/);
  assert.doesNotMatch(qaSource, /savedEquipmentSnapshot\.version !== 7/);
});

function durableSnapshot({ money, qsoLogCount, settledRunIds, claimedAchievementRewards = [] }) {
  return { money, qsoLogCount, eventQsoCredits: 0, settledRunIds, claimedAchievementRewards };
}

function validLightsEvidence() {
  const seed = durableSnapshot({ money: 0, qsoLogCount: 0, settledRunIds: [] });
  const beforeBaseClick = durableSnapshot({ money: 0, qsoLogCount: 0, settledRunIds: ["failed"] });
  const afterAchievementSettlement = durableSnapshot({
    money: 540, qsoLogCount: 3, settledRunIds: ["failed", "base"],
    claimedAchievementRewards: ["first-qso", "regions-3", "lights-base"],
  });
  const afterMissionClaim = durableSnapshot({
    money: 1140, qsoLogCount: 3, settledRunIds: ["failed", "base"],
    claimedAchievementRewards: ["first-qso", "regions-3", "first-name", "lights-base"],
  });
  return {
    schemaVersion: 1,
    qaRunId: QA_RUN_ID,
    activity: "lights-across-air",
    resultFile: "lights-qa-result.json",
    screenshots: [
      "lights-story-launch-1280x720.png", "lights-chase-1280x720.png",
      "lights-control-1280x720.png", "lights-failed-1280x720.png",
      "lights-result-1280x720.png", "lights-reloaded-history-1280x720.png",
    ],
    checkpoints: {
      "story-ready": { prerequisiteClaimed: true, story05Active: true, seed },
      "keying-probe": { text: "RRR RST", wpm: 12, exact: true },
      "story-launch": { phase: "CHASE_PLAYER_CALL", mode: "story" },
      "chase-complete": { phase: "CONTROL_CQ", completed: true },
      "control-entered": { phase: "CONTROL_CQ" },
      "escape-paused": { phase: "CONTROL_CQ", settingsVisible: true },
      "escape-resumed": { phase: "CONTROL_CQ", settingsVisible: false },
      "failed-run": { phase: "RUN_COMPLETE", grade: "none" },
      "retry-control": { phase: "CONTROL_CQ", failedRunSettlementCount: 1 },
      settled: {
        phase: "RUN_COMPLETE", grade: "base", contacts: 3,
        validQsoCount: 3, distinctRegionCount: 3, resolvedPileupCount: 3,
        selectedContacts: [
          { callsign: "SIMJP1", regionCode: "JP" },
          { callsign: "SIMUS2", regionCode: "US" },
          { callsign: "SIMCN3", regionCode: "CN" },
        ],
        moneyFlow: {
          seed,
          beforeBaseClick,
          baseSettlement: {
            gradeMoneyAwarded: 0, eventQsoCreditsAwarded: 0, qsoLogDelta: 3, settledRunIdDelta: 1,
          },
          afterAchievementSettlement: {
            ...afterAchievementSettlement,
            achievementMoneyAwarded: 540,
            newlyClaimedAchievementRewards: ["first-qso", "regions-3", "lights-base"],
          },
          missionClaim: {
            missionMoneyAwarded: 500, achievementMoneyAwarded: 100, totalMoneyAwarded: 600,
            newlyClaimedAchievementRewards: ["first-name"], after: afterMissionClaim,
          },
        },
        final: afterMissionClaim,
      },
      "duplicate-settlement": {
        noOp: true, before: afterAchievementSettlement, after: afterAchievementSettlement,
      },
      "reloaded-history": { ...afterMissionClaim, storyBestGrade: "base" },
    },
  };
}

async function delayedLightsRenderer({ keyerTimerLagMs = 0, projectionDelayMs = 150, wpm = 12 } = {}) {
  const [{ AutomaticKeyer }, { analyzeKeying }] = await Promise.all([
    import("../src/cw/automaticKeyer.js"),
    import("../src/cw/inputAnalyzer.js"),
  ]);
  const pulses = [];
  const projectionTimers = new Set();
  let projectedPulseCount = 0;
  let projectedDecoded = "";
  let keyerActive = false;
  let rendererFocused = true;
  let focusLossAfterPulseCount = null;
  let focusLossApplied = false;
  const focusCalls = [];
  const keyer = new AutomaticKeyer({
    getWpm: () => wpm,
    now: () => performance.now(),
    setTimer: (callback, delay) => setTimeout(callback, delay + keyerTimerLagMs),
    onSessionChange: (active) => { keyerActive = active; },
    onPulse: (pulse) => {
      pulses.push(pulse);
      const snapshot = [...pulses];
      const timer = setTimeout(() => {
        projectionTimers.delete(timer);
        projectedPulseCount = snapshot.length;
        projectedDecoded = analyzeKeying(snapshot, { fallbackWpm: wpm }).decoded;
        if (!focusLossApplied && Number.isInteger(focusLossAfterPulseCount)
          && projectedPulseCount >= focusLossAfterPulseCount) {
          rendererFocused = false;
          focusLossApplied = true;
        }
      }, projectionDelayMs);
      projectionTimers.add(timer);
    },
  });
  class FakeKeyboardEvent {
    constructor(type, options) {
      this.type = type;
      Object.assign(this, options);
    }
  }
  const document = {
    visibilityState: "visible",
    hasFocus: () => rendererFocused,
    querySelector(selector) {
      if (selector === ".lights-event-screen") {
        return { dataset: { eventPhase: "CHASE_PLAYER_CALL", pulseCount: String(projectedPulseCount) } };
      }
      if (selector === ".lights-tx-line strong") return { textContent: projectedDecoded || "_" };
      if (selector === '[data-action="lights-transmit"]:not([disabled])') return keyerActive ? null : {};
      return null;
    },
  };
  const rendererWindow = {
    dispatchEvent(event) {
      if (!rendererFocused) return false;
      const symbol = event.code === "KeyZ" ? "." : event.code === "KeyX" ? "-" : null;
      if (!symbol) return false;
      if (event.type === "keydown") keyer.begin(symbol);
      if (event.type === "keyup") keyer.end(symbol);
      return true;
    },
  };
  const context = {
    Boolean, Date, Error, JSON, KeyboardEvent: FakeKeyboardEvent, Number, Promise,
    clearInterval, clearTimeout, document, performance, setInterval, setTimeout, window: rendererWindow,
  };
  return {
    decoded: () => projectedDecoded,
    focusCalls,
    loseFocusAfterPulses(count) { focusLossAfterPulseCount = count; },
    pulses,
    window: {
      isMinimized: () => false,
      show() { focusCalls.push("show"); },
      focus() { focusCalls.push("window-focus"); rendererFocused = true; },
      webContents: {
        focus() { focusCalls.push("renderer-focus"); rendererFocused = true; },
        executeJavaScript(source) {
          return vm.runInNewContext(source, context);
        },
      },
    },
    cleanup() {
      keyer.stop();
      for (const timer of projectionTimers) clearTimeout(timer);
    },
  };
}

test("packaged lights QA plan names every real gameplay checkpoint", () => {
  const plan = buildLightsQaPlan({ suffix: "1280x720" });

  assert.deepEqual(
    plan.checkpoints.map((checkpoint) => checkpoint.id),
    [
      "story-ready", "keying-probe",
      "story-launch",
      "chase-complete",
      "control-entered",
      "escape-paused",
      "escape-resumed",
      "failed-run",
      "retry-control",
      "settled",
      "reloaded-history",
      "duplicate-settlement",
    ],
  );
  assert.deepEqual(
    plan.screenshots,
    [
      "lights-story-launch-1280x720.png",
      "lights-chase-1280x720.png",
      "lights-control-1280x720.png",
      "lights-failed-1280x720.png",
      "lights-result-1280x720.png",
      "lights-reloaded-history-1280x720.png",
    ],
  );
  assert.equal(plan.resultFile, "lights-qa-result.json");
});

test("Lights evidence validator accepts the complete literal gameplay schema", () => {
  const valid = validLightsEvidence();
  assert.doesNotThrow(() => validateLightsQaEvidence(valid, { qaRunId: QA_RUN_ID }));
  assert.throws(
    () => validateLightsQaEvidence(valid, {
      qaRunId: "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee",
    }),
    /run id/i,
  );
});

test("Lights evidence validator rejects missing and false protocol facts", () => {
  const valid = validLightsEvidence();
  const withoutKeyingProbe = structuredClone(valid);
  delete withoutKeyingProbe.checkpoints["keying-probe"];
  assert.throws(() => validateLightsQaEvidence(withoutKeyingProbe), /keying-probe checkpoint/);
  const mutations = [
    ["story launch mode", (value) => { value.checkpoints["story-launch"].mode = "practice"; }, /story-launch/],
    ["chase completion", (value) => { value.checkpoints["chase-complete"].completed = false; }, /chase-complete/],
    ["pause visibility", (value) => { value.checkpoints["escape-paused"].settingsVisible = false; }, /escape-paused/],
    ["resume visibility", (value) => { value.checkpoints["escape-resumed"].settingsVisible = true; }, /escape-resumed/],
    ["failed grade", (value) => { value.checkpoints["failed-run"].grade = "base"; }, /failed-run/],
    ["retry count", (value) => { value.checkpoints["retry-control"].failedRunSettlementCount = 0; }, /retry-control/],
    ["reload grade", (value) => { value.checkpoints["reloaded-history"].storyBestGrade = "none"; }, /reloaded-history/],
  ];
  for (const [name, mutate, expected] of mutations) {
    const candidate = structuredClone(valid);
    mutate(candidate);
    assert.throws(() => validateLightsQaEvidence(candidate), expected, name);
  }
});

test("Lights evidence validator rejects malformed contacts, ledgers, and numeric facts", () => {
  const valid = validLightsEvidence();
  const mutations = [
    ["checkpoint array", (value) => { value.checkpoints["story-ready"] = []; }, /plain object/],
    ["missing callsign", (value) => { value.checkpoints.settled.selectedContacts[0].callsign = ""; }, /selectedContacts/],
    ["one region", (value) => {
      value.checkpoints.settled.selectedContacts.forEach((contact) => { contact.regionCode = "JP"; });
    }, /selectedContacts/],
    ["empty run id", (value) => { value.checkpoints.settled.final.settledRunIds[1] = ""; }, /settledRunIds/],
    ["nonempty seed achievements", (value) => {
      value.checkpoints["story-ready"].seed.claimedAchievementRewards = ["preclaimed"];
      value.checkpoints.settled.moneyFlow.seed.claimedAchievementRewards = ["preclaimed"];
      value.checkpoints.settled.moneyFlow.beforeBaseClick.claimedAchievementRewards = ["preclaimed"];
    }, /seed/],
    ["mismatched duplicate ids", (value) => { value.checkpoints["duplicate-settlement"].after.settledRunIds = ["failed"]; }, /duplicate settlement/],
    ["mismatched reload ids", (value) => { value.checkpoints["reloaded-history"].settledRunIds = ["base"]; }, /reload/],
    ["mission drops earlier achievements", (value) => {
      value.checkpoints.settled.moneyFlow.missionClaim.after.claimedAchievementRewards = ["first-name"];
      value.checkpoints.settled.final.claimedAchievementRewards = ["first-name"];
      value.checkpoints["reloaded-history"].claimedAchievementRewards = ["first-name"];
    }, /mission claim/],
    ["NaN money", (value) => { value.checkpoints.settled.final.money = Number.NaN; }, /money/],
    ["fractional QSO count", (value) => { value.checkpoints.settled.final.qsoLogCount = 2.5; }, /qsoLogCount/],
  ];
  for (const [name, mutate, expected] of mutations) {
    const candidate = structuredClone(valid);
    mutate(candidate);
    assert.throws(() => validateLightsQaEvidence(candidate), expected, name);
  }
});

test("Lights evidence validator enforces the staged zero-credit and achievement money flow", () => {
  const valid = validLightsEvidence();
  const mutations = [
    ["Base grade bonus", (value) => { value.checkpoints.settled.moneyFlow.baseSettlement.gradeMoneyAwarded = 1; }, /gradeMoneyAwarded/],
    ["event QSO credits", (value) => { value.checkpoints.settled.moneyFlow.baseSettlement.eventQsoCreditsAwarded = 3; }, /eventQsoCredits/],
    ["achievement award", (value) => { value.checkpoints.settled.moneyFlow.afterAchievementSettlement.achievementMoneyAwarded = 539; }, /achievement/],
    ["activity achievement id", (value) => {
      value.checkpoints.settled.moneyFlow.afterAchievementSettlement.newlyClaimedAchievementRewards = ["first-qso", "regions-3"];
    }, /achievement/],
    ["mission award", (value) => { value.checkpoints.settled.moneyFlow.missionClaim.missionMoneyAwarded = 600; }, /mission/],
    ["claim total", (value) => { value.checkpoints.settled.moneyFlow.missionClaim.totalMoneyAwarded = 500; }, /mission claim/],
    ["final balance", (value) => { value.checkpoints.settled.final.money = 1139; }, /mission claim|final/],
  ];
  for (const [name, mutate, expected] of mutations) {
    const candidate = structuredClone(valid);
    mutate(candidate);
    assert.throws(() => validateLightsQaEvidence(candidate), expected, name);
  }
});

test("Lights money-flow helper separates Base, achievement, and mission claim awards", () => {
  const seed = durableSnapshot({ money: 0, qsoLogCount: 0, settledRunIds: [] });
  const beforeBaseClick = durableSnapshot({ money: 0, qsoLogCount: 0, settledRunIds: ["failed"] });
  const afterAchievementSettlement = durableSnapshot({
    money: 540, qsoLogCount: 3, settledRunIds: ["failed", "base"],
    claimedAchievementRewards: ["first-qso", "regions-3", "lights-base"],
  });
  const afterMissionClaim = {
    ...durableSnapshot({
      money: 1140, qsoLogCount: 3, settledRunIds: ["failed", "base"],
      claimedAchievementRewards: ["first-qso", "regions-3", "first-name", "lights-base"],
    }),
    story05MissionMoneyAwarded: 500,
  };

  assert.deepEqual(buildLightsQaMoneyFlow({
    seed, beforeBaseClick, afterAchievementSettlement, afterMissionClaim, gradeMoneyAwarded: 0,
  }), validLightsEvidence().checkpoints.settled.moneyFlow);
});

test("station-entry probe rejects a renderer failure before Lights QA starts", () => {
  assert.doesNotThrow(() => validateStationEntryProbe({
    passed: true,
    afterClick: { stationPresent: true },
    consoleErrors: [],
  }));
  assert.throws(
    () => validateStationEntryProbe({
      passed: false,
      afterClick: { stationPresent: false },
      consoleErrors: [{ level: 3, message: "Uncaught ReferenceError: QSO_EXIT_RISKS is not defined" }],
    }),
    /Station entry probe failed/,
  );
});

test("Lights capture runner is independently callable by the packaged CLI", () => {
  assert.equal(typeof runLightsQaCapture, "function");
});

test("Lights capture runner reaches its keying probe through the shared renderer focus boundary", async () => {
  const outputDir = fs.mkdtempSync(path.join(os.tmpdir(), "cwgame-lights-focus-runner-"));
  const preparedSave = {
    id: "qa-lights-save",
    callsign: "QA5LGT",
    claimedMissionIds: ["story-04"],
    activeMissionIds: ["story-05"],
    settledRunIds: [],
    storyBest: null,
    qsoLogCount: 0,
    eventQsoCredits: 0,
    claimedAchievementRewards: [],
    story05MissionMoneyAwarded: null,
    money: 0,
  };
  const qaWindow = {
    isMinimized: () => false,
    show() {},
    focus() {},
    async reload() {},
    webContents: {
      focus() {},
      async executeJavaScript(source) {
        if (source.includes("story05MissionMoneyAwarded")) return preparedSave;
        if (source.includes('expected = "RRR RST"')) throw new Error("KEYING_PROBE_REACHED");
        return true;
      },
    },
  };

  try {
    await assert.rejects(
      () => runLightsQaCapture(qaWindow, outputDir, "focus-contract", { qaRunId: QA_RUN_ID }),
      /KEYING_PROBE_REACHED/,
    );
  } finally {
    fs.rmSync(outputDir, { recursive: true, force: true });
  }
});

test("every segmented QA startup isolates userData before the Electron instance lock", () => {
  const originalArgv = process.argv;
  const originalOutput = process.env.CWGAME_QA_OUTPUT;
  const originalScope = process.env.CWGAME_QA_SCOPE;
  const originalRunId = process.env.CWGAME_QA_RUN_ID;
  const originalLoad = Module._load;
  const mainPath = require.resolve("../electron/main.cjs");
  const outputDirs = [];
  try {
    for (const scope of ["bootstrap", "inventory", "equipment", "practice", "qso", "lights"]) {
      const calls = [];
      process.argv = [originalArgv[0], mainPath, scope === "lights" ? "--qa-lights-capture" : "--qa-capture"];
      process.env.CWGAME_QA_SCOPE = scope;
      delete process.env.CWGAME_QA_OUTPUT;
      delete process.env.CWGAME_QA_RUN_ID;
      Module._load = function load(request, parent, isMain) {
        if (request !== "electron") return originalLoad.call(this, request, parent, isMain);
        return {
          app: {
            commandLine: { appendSwitch: () => {} },
            disableHardwareAcceleration: () => {},
            quit: () => { calls.push(["quit"]); },
            requestSingleInstanceLock: () => { calls.push(["lock"]); return false; },
            setPath: (name, value) => { calls.push(["setPath", name, value]); },
          },
        };
      };
      delete require.cache[mainPath];
      require(mainPath);
      const outputDir = process.env.CWGAME_QA_OUTPUT;
      outputDirs.push(outputDir);

      const isolation = calls.find(([name]) => name === "setPath");
      assert.ok(outputDir, `${scope} QA startup must choose an isolated output directory`);
      assert.match(process.env.CWGAME_QA_RUN_ID, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
      assert.deepEqual(isolation?.slice(0, 2), ["setPath", "userData"]);
      assert.equal(path.dirname(isolation[2]), outputDir);
      assert.equal(path.basename(isolation[2]), "electron-user-data");
      assert.equal(fs.existsSync(isolation[2]), true);
      assert.ok(calls.findIndex(([name]) => name === "setPath") < calls.findIndex(([name]) => name === "lock"));
      assert.ok(path.resolve(outputDir).startsWith(path.resolve(os.tmpdir())));
    }
  } finally {
    delete require.cache[mainPath];
    Module._load = originalLoad;
    process.argv = originalArgv;
    if (originalOutput === undefined) delete process.env.CWGAME_QA_OUTPUT;
    else process.env.CWGAME_QA_OUTPUT = originalOutput;
    if (originalScope === undefined) delete process.env.CWGAME_QA_SCOPE;
    else process.env.CWGAME_QA_SCOPE = originalScope;
    if (originalRunId === undefined) delete process.env.CWGAME_QA_RUN_ID;
    else process.env.CWGAME_QA_RUN_ID = originalRunId;
    for (const outputDir of outputDirs) {
      if (outputDir && fs.existsSync(outputDir)) fs.rmSync(outputDir, { recursive: true, force: true });
    }
  }
});

test("direct QA CLI preserves a supervisor-provided run id", () => {
  const originalArgv = process.argv;
  const originalOutput = process.env.CWGAME_QA_OUTPUT;
  const originalRunId = process.env.CWGAME_QA_RUN_ID;
  const originalLoad = Module._load;
  const mainPath = require.resolve("../electron/main.cjs");
  const providedRunId = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";
  let outputDir;
  try {
    process.argv = [originalArgv[0], mainPath, "--qa-lights-capture"];
    delete process.env.CWGAME_QA_OUTPUT;
    process.env.CWGAME_QA_RUN_ID = providedRunId;
    Module._load = function load(request, parent, isMain) {
      if (request !== "electron") return originalLoad.call(this, request, parent, isMain);
      return {
        app: {
          commandLine: { appendSwitch: () => {} },
          disableHardwareAcceleration: () => {},
          quit: () => {},
          requestSingleInstanceLock: () => false,
          setPath: () => {},
        },
      };
    };
    delete require.cache[mainPath];
    require(mainPath);
    outputDir = process.env.CWGAME_QA_OUTPUT;
    assert.equal(process.env.CWGAME_QA_RUN_ID, providedRunId);
  } finally {
    delete require.cache[mainPath];
    Module._load = originalLoad;
    process.argv = originalArgv;
    if (originalOutput === undefined) delete process.env.CWGAME_QA_OUTPUT;
    else process.env.CWGAME_QA_OUTPUT = originalOutput;
    if (originalRunId === undefined) delete process.env.CWGAME_QA_RUN_ID;
    else process.env.CWGAME_QA_RUN_ID = originalRunId;
    if (outputDir && fs.existsSync(outputDir)) fs.rmSync(outputDir, { recursive: true, force: true });
  }
});

test("Lights QA selects the current rendered pile-up caller instead of a seeded callsign", () => {
  const caller = selectLightsCallerFromRuntimeSnapshot({
    phase: "CONTROL_SELECTION",
    pileup: {
      callers: [
        { callsign: "SIMACT", regionCode: "JP" },
        { callsign: "SIMNEXT", regionCode: "US" },
      ],
    },
  });

  assert.equal(caller, "SIMACT");
  assert.throws(
    () => selectLightsCallerFromRuntimeSnapshot({ phase: "CONTROL_SELECTION", pileup: { callers: [] } }),
    /current caller/i,
  );
});

test("Lights phase failures name the action and rendered protocol feedback", () => {
  const message = formatLightsWaitFailure("after chase report", "CONTROL_CQ", {
    phase: "CHASE_FINAL",
    lastError: "wrongRegion",
    expectedText: "SIM5LT DE QA5LGT RST 579 CN K",
    documentHasFocus: false,
  });

  assert.match(message, /after chase report/);
  assert.match(message, /CONTROL_CQ/);
  assert.match(message, /wrongRegion/);
  assert.match(message, /documentHasFocus/);
});

test("QA Electron window is shown and focused before real Lights playback", () => {
  const main = fs.readFileSync(path.join(__dirname, "..", "electron", "main.cjs"), "utf8");
  assert.match(main, /if \(qaCaptureMode\) \{\s*mainWindow\.show\(\);\s*mainWindow\.focus\(\);/);
  assert.match(main, /backgroundThrottling: !qaCaptureMode/);
});

test("automatic Lights typing waits for keyer-idle and only adds remaining CW gaps", () => {
  assert.equal(automaticQaGapAfterElement("character", 18), 1200 / 18 * 2);
  assert.equal(automaticQaGapAfterElement("word", 18), 1200 / 18 * 6);
});

test("automatic Lights typing waits for idle only at character boundaries", () => {
  assert.equal(automaticQaShouldWaitForIdleAfterSymbol(0, 3), false);
  assert.equal(automaticQaShouldWaitForIdleAfterSymbol(1, 3), false);
  assert.equal(automaticQaShouldWaitForIdleAfterSymbol(2, 3), true);
});

test("automatic Lights typing queues each character before observing its DOM pulse projection", async () => {
  const focusCalls = [];
  const keyingScripts = [];
  const window = {
    isMinimized: () => false,
    show() { focusCalls.push("show"); },
    focus() { focusCalls.push("window-focus"); },
    webContents: {
      focus() { focusCalls.push("renderer-focus"); },
      async executeJavaScript(source) {
        if (source.trim().startsWith("({ hasFocus:")) {
          return { hasFocus: true, visibilityState: "visible" };
        }
        if (source.includes("const keyCodes =")) {
          keyingScripts.push(source);
          return { pulseCount: keyingScripts.length, decoded: "RRR RST" };
        }
        if (source.includes("const expected =")) return { pulseCount: keyingScripts.length, decoded: "RRR RST" };
        if (source.includes("document.hasFocus()")) return true;
        throw new Error(`Unexpected QA script: ${source}`);
      },
    },
  };

  await sendAutomaticLightsText(window, "RRR RST", 12);
  assert.equal(keyingScripts.length, 6);
  assert.equal(focusCalls.filter((call) => call === "window-focus").length, 0);
  assert.equal(focusCalls.filter((call) => call === "renderer-focus").length, 0);
  for (const script of keyingScripts) {
    const keyDownAt = script.indexOf('new KeyboardEvent("keydown"');
    const pulseAt = script.indexOf("pulseCount() >= before");
    const keyUpAt = script.indexOf('new KeyboardEvent("keyup"');
    assert.ok(keyDownAt >= 0 && keyDownAt < keyUpAt && keyUpAt < pulseAt);
  }
});

test("automatic Lights typing preserves character boundaries when DOM pulse projection is delayed", async () => {
  const renderer = await delayedLightsRenderer({ projectionDelayMs: 150, wpm: 12 });
  try {
    await sendAutomaticLightsText(renderer.window, "LT", 12);
    assert.equal(renderer.decoded(), "LT");
    assert.deepEqual(renderer.pulses.map(({ symbol }) => symbol), [".", "-", ".", ".", "-"]);
  } finally {
    renderer.cleanup();
  }
});

test("automatic Lights typing preserves long-character boundaries when keyer timer chains drift", async () => {
  const renderer = await delayedLightsRenderer({ keyerTimerLagMs: 30, projectionDelayMs: 50, wpm: 12 });
  try {
    await sendAutomaticLightsText(renderer.window, "QA5L", 12);
    assert.equal(renderer.decoded(), "QA5L");
  } finally {
    renderer.cleanup();
  }
});

test("automatic Lights typing restores real renderer focus at character boundaries", async () => {
  const renderer = await delayedLightsRenderer({ projectionDelayMs: 150, wpm: 12 });
  renderer.loseFocusAfterPulses(4); // L completes, then an external window steals focus.
  try {
    await sendAutomaticLightsText(renderer.window, "LT T", 12);
    assert.equal(renderer.decoded(), "LT T");
    assert.deepEqual(renderer.pulses.map(({ symbol }) => symbol), [".", "-", ".", ".", "-", "-"]);
    assert.equal(renderer.focusCalls.filter((call) => call === "window-focus").length, 1);
    assert.equal(renderer.focusCalls.filter((call) => call === "renderer-focus").length, 1);
  } finally {
    renderer.cleanup();
  }
});

test("Lights QA drives the real Z/X input path", () => {
  assert.deepEqual(lightsKeyInputForSymbol("."), { keyCode: "Z" });
  assert.deepEqual(lightsKeyInputForSymbol("-"), { keyCode: "X" });
  assert.throws(() => lightsKeyInputForSymbol("?"), /Unsupported/);
});

test("Lights keying uses one deliberately slow QA WPM for the seed and timing gaps", () => {
  assert.equal(LIGHTS_QA_WPM, 12);
  assert.equal(automaticQaGapAfterElement("character", LIGHTS_QA_WPM), 200);
});

test("Lights renderer exposes its live keyer pulse state for DOM-driven QA", () => {
  const screen = fs.readFileSync(path.join(__dirname, "..", "src", "screens", "LightsEventScreen.jsx"), "utf8");
  assert.match(screen, /data-pulse-count=\{cw\.analysis\.pulseCount\}/);
  assert.match(screen, /data-decoded=\{cw\.analysis\.decoded\}/);
  assert.match(screen, /data-valid-qso-count=\{model\.result\?\.validQsoCount/);
  assert.match(screen, /data-distinct-region-count=\{model\.result\?\.distinctRegionCount/);
  assert.match(screen, /data-resolved-pileup-count=\{model\.result\?\.resolvedPileupCount/);
});

test("Lights reload validation reports both durable fact sets when they disagree", () => {
  const valid = validLightsEvidence();
  valid.checkpoints["reloaded-history"].qsoLogCount = 2;
  assert.throws(() => validateLightsQaEvidence(valid), /settled.*reloaded/s);
});
