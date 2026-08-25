const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const {
  automaticQaGapAfterElement, automaticQaShouldWaitForIdleAfterSymbol,
  buildLightsQaPlan, formatLightsWaitFailure, lightsKeyInputForSymbol, LIGHTS_QA_WPM,
  runLightsQaCapture, selectLightsCallerFromRuntimeSnapshot, sendAutomaticLightsText,
  validateLightsQaEvidence, validateStationEntryProbe,
} = require("../electron/qa-capture.cjs");

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

test("Lights evidence validator rejects incomplete or non-idempotent gameplay facts", () => {
  const valid = {
    schemaVersion: 1,
    activity: "lights-across-air",
    screenshots: [
      "lights-chase-1280x720.png", "lights-control-1280x720.png",
      "lights-result-1280x720.png", "lights-reloaded-history-1280x720.png",
    ],
    checkpoints: {
      "story-ready": { prerequisiteClaimed: true, story05Active: true },
      "keying-probe": { text: "RRR RST", wpm: 12, exact: true },
      "story-launch": { phase: "CHASE_PLAYER_CALL", mode: "story" },
      "chase-complete": { phase: "CONTROL_CQ", completed: true },
      "control-entered": { phase: "CONTROL_CQ" },
      "escape-paused": { phase: "CONTROL_CQ", settingsVisible: true },
      "escape-resumed": { phase: "CONTROL_CQ", settingsVisible: false },
      "failed-run": { phase: "RUN_COMPLETE", grade: "none" },
      "retry-control": { phase: "CONTROL_CQ" },
      settled: { grade: "base", validQsoCount: 3, distinctRegionCount: 2, resolvedPileupCount: 3, moneyDelta: 100, qsoLogDelta: 3, settledRunIds: ["failed", "base"], money: 100, qsoLogCount: 3 },
      "duplicate-settlement": {
        noOp: true,
        before: { settledRunIds: ["failed", "base"], money: 0, qsoLogCount: 3 },
        after: { settledRunIds: ["failed", "base"], money: 0, qsoLogCount: 3 },
      },
      "reloaded-history": { settledRunIds: ["failed", "base"], money: 100, qsoLogCount: 3 },
    },
  };

  assert.doesNotThrow(() => validateLightsQaEvidence(valid));
  const withoutKeyingProbe = structuredClone(valid);
  delete withoutKeyingProbe.checkpoints["keying-probe"];
  assert.throws(() => validateLightsQaEvidence(withoutKeyingProbe), /keying-probe checkpoint/);
  assert.throws(
    () => validateLightsQaEvidence({
      ...valid,
      checkpoints: { ...valid.checkpoints, settled: { ...valid.checkpoints.settled, moneyDelta: 0 } },
    }),
    /positive money delta/,
  );
  assert.throws(
    () => validateLightsQaEvidence({
      ...valid,
      checkpoints: {
        ...valid.checkpoints,
        settled: { ...valid.checkpoints.settled, validQsoCount: undefined },
      },
    }),
    /Base-grade overlapping pile-up run/,
  );
  assert.throws(
    () => validateLightsQaEvidence({
      ...valid,
      checkpoints: { ...valid.checkpoints, "duplicate-settlement": { ...valid.checkpoints["duplicate-settlement"], noOp: false } },
    }),
    /duplicate settlement no-op/,
  );
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

test("automatic Lights typing runs one renderer-side loop for the repeated-R timing probe", async () => {
  let executions = 0;
  let script = "";
  const window = {
    webContents: {
      async executeJavaScript(source) {
        executions += 1;
        script = source;
        return { screenPresent: true, pulseCount: executions, decoded: "RRR RST" };
      },
    },
  };

  await sendAutomaticLightsText(window, "RRR RST", 12);
  assert.equal(executions, 1);
  const keyDownAt = script.indexOf('new KeyboardEvent("keydown"');
  const pulseAt = script.indexOf('await waitUntil(() => pulseCount() >= before + 1');
  const keyUpAt = script.indexOf('new KeyboardEvent("keyup"');
  assert.ok(keyDownAt >= 0 && keyDownAt < pulseAt && pulseAt < keyUpAt);
});

test("Lights QA drives the real Z/X input path", () => {
  assert.deepEqual(lightsKeyInputForSymbol("."), { keyCode: "Z" });
  assert.deepEqual(lightsKeyInputForSymbol("-"), { keyCode: "X" });
  assert.throws(() => lightsKeyInputForSymbol("?"), /Unsupported/);
});

test("Lights keying uses one deliberately slow QA WPM for the seed and timing gaps", () => {
  assert.equal(LIGHTS_QA_WPM, 12);
  assert.equal(automaticQaGapAfterElement("character", LIGHTS_QA_WPM), 200);
  const capture = fs.readFileSync(path.join(__dirname, "..", "electron", "qa-capture.cjs"), "utf8");
  assert.match(capture, /automaticKeyWpm: \$\{LIGHTS_QA_WPM\}/);
});

test("Lights renderer exposes its live keyer pulse state for DOM-driven QA", () => {
  const screen = fs.readFileSync(path.join(__dirname, "..", "src", "screens", "LightsEventScreen.jsx"), "utf8");
  assert.match(screen, /data-pulse-count=\{cw\.analysis\.pulseCount\}/);
  assert.match(screen, /data-decoded=\{cw\.analysis\.decoded\}/);
  assert.match(screen, /data-valid-qso-count=\{model\.result\?\.validQsoCount/);
  assert.match(screen, /data-distinct-region-count=\{model\.result\?\.distinctRegionCount/);
  assert.match(screen, /data-resolved-pileup-count=\{model\.result\?\.resolvedPileupCount/);
});

test("Lights reload evidence records the durable QSO log count required by its validator", () => {
  const capture = fs.readFileSync(path.join(__dirname, "..", "electron", "qa-capture.cjs"), "utf8");
  assert.match(capture, /checkpoint\("reloaded-history", \{[\s\S]*qsoLogCount: reloaded\.qsoLogCount,/);
});

test("Lights reload validation reports both durable fact sets when they disagree", () => {
  const valid = {
    schemaVersion: 1, activity: "lights-across-air",
    screenshots: ["lights-chase-x.png", "lights-control-x.png", "lights-result-x.png", "lights-reloaded-history-x.png"],
    checkpoints: {
      "story-ready": { prerequisiteClaimed: true, story05Active: true },
      "keying-probe": { text: "RRR RST", wpm: 12, exact: true },
      "story-launch": { phase: "CHASE_PLAYER_CALL" }, "chase-complete": { phase: "CONTROL_CQ" },
      "control-entered": { phase: "CONTROL_CQ" }, "escape-paused": { phase: "CONTROL_CQ" },
      "escape-resumed": { phase: "CONTROL_CQ" }, "failed-run": { phase: "RUN_COMPLETE" },
      "retry-control": { phase: "CONTROL_CQ" },
      settled: { grade: "base", validQsoCount: 3, distinctRegionCount: 2, resolvedPileupCount: 1, moneyDelta: 1, qsoLogDelta: 3, settledRunIds: ["x"], money: 1, qsoLogCount: 3 },
      "duplicate-settlement": { noOp: true, before: { settledRunIds: ["x"], money: 0, qsoLogCount: 3 }, after: { settledRunIds: ["x"], money: 0, qsoLogCount: 3 } },
      "reloaded-history": { settledRunIds: ["x"], money: 1, qsoLogCount: 2 },
    },
  };
  assert.throws(() => validateLightsQaEvidence(valid), /settled.*reloaded/s);
});
