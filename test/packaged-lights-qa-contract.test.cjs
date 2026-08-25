const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const {
  automaticQaGapAfterElement, automaticQaShouldWaitForIdleAfterSymbol,
  buildLightsQaMoneyFlow, buildLightsQaPlan, formatLightsWaitFailure, lightsKeyInputForSymbol, LIGHTS_QA_WPM,
  runLightsQaCapture, selectLightsCallerFromRuntimeSnapshot, sendAutomaticLightsText,
  validateLightsQaEvidence, validateStationEntryProbe,
} = require("../electron/qa-capture.cjs");

function durableSnapshot({ money, qsoLogCount, settledRunIds, claimedAchievementRewards = [] }) {
  return { money, qsoLogCount, eventQsoCredits: 0, settledRunIds, claimedAchievementRewards };
}

function validLightsEvidence() {
  const seed = durableSnapshot({ money: 0, qsoLogCount: 0, settledRunIds: [] });
  const beforeBaseClick = durableSnapshot({ money: 0, qsoLogCount: 0, settledRunIds: ["failed"] });
  const afterAchievementSettlement = durableSnapshot({
    money: 420, qsoLogCount: 3, settledRunIds: ["failed", "base"],
    claimedAchievementRewards: ["first-qso", "regions-3"],
  });
  const afterMissionClaim = durableSnapshot({
    money: 1020, qsoLogCount: 3, settledRunIds: ["failed", "base"],
    claimedAchievementRewards: ["first-qso", "regions-3", "first-name"],
  });
  return {
    schemaVersion: 1,
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
            achievementMoneyAwarded: 420,
            newlyClaimedAchievementRewards: ["first-qso", "regions-3"],
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
  assert.doesNotThrow(() => validateLightsQaEvidence(valid));
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
    ["achievement award", (value) => { value.checkpoints.settled.moneyFlow.afterAchievementSettlement.achievementMoneyAwarded = 419; }, /achievement/],
    ["mission award", (value) => { value.checkpoints.settled.moneyFlow.missionClaim.missionMoneyAwarded = 600; }, /mission/],
    ["claim total", (value) => { value.checkpoints.settled.moneyFlow.missionClaim.totalMoneyAwarded = 500; }, /mission claim/],
    ["final balance", (value) => { value.checkpoints.settled.final.money = 1019; }, /mission claim|final/],
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
    money: 420, qsoLogCount: 3, settledRunIds: ["failed", "base"],
    claimedAchievementRewards: ["first-qso", "regions-3"],
  });
  const afterMissionClaim = {
    ...durableSnapshot({
      money: 1020, qsoLogCount: 3, settledRunIds: ["failed", "base"],
      claimedAchievementRewards: ["first-qso", "regions-3", "first-name"],
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
