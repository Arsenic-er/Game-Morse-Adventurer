import assert from "node:assert/strict";
import { PassThrough } from "node:stream";
import test from "node:test";
import React from "react";
import { renderToPipeableStream } from "react-dom/server";
import { createServer } from "vite";

import {
  QSL_STORY_PHASES, createQslStoryRun, reviewQslAccounts,
} from "../src/game/qslStoryRun.js";

const SOURCE_QSL = Object.freeze({
  id: "qsl:expedition:hill-1",
  qsoId: "expedition-qso:hill-1",
  eventRunId: "hill-1",
  personId: "person:sora",
  stationId: "station:sim6jp",
  callsign: "SIM6JP",
  playerNarrativeKey: "qsl.player.hill-signal",
  operatorNarrativeKey: "qsl.operator.sora-hill-reply",
  createdAt: "2026-08-28T09:00:00.000Z",
  confirmedAt: "2026-08-28T09:01:00.000Z",
  choice: "request-review",
});

function render(element) {
  return new Promise((resolve, reject) => {
    const output = new PassThrough();
    let html = "";
    output.setEncoding("utf8");
    output.on("data", (chunk) => { html += chunk; });
    output.on("end", () => resolve(html));
    const stream = renderToPipeableStream(element, {
      onAllReady() { stream.pipe(output); },
      onError(error) { reject(error); },
    });
  });
}

function saveWithRun(run = null) {
  return {
    id: "chapter-seven-ui",
    callsign: "BH1ABC",
    qslRecords: [SOURCE_QSL],
    storyContinuationState: {
      chapter07: { activeRun: run, cases: [], settledRunIds: [], peopleTaskTreeUnlocked: false },
    },
  };
}

test("Chapter 7 renders both accounts, real radio input, choices, and no portrait", async () => {
  const vite = await createServer({ appType: "custom", logLevel: "silent", server: { middlewareMode: true } });
  try {
    const [{ QslStoryScreen }, { QSL_STORY_TEXT }] = await Promise.all([
      vite.ssrLoadModule("/src/screens/QslStoryScreen.jsx"),
      vite.ssrLoadModule("/src/screens/qslStoryText.js"),
    ]);
    const run = reviewQslAccounts(createQslStoryRun({
      sourceQsl: SOURCE_QSL, playerCallsign: "BH1ABC", startedAt: "2026-08-28T10:00:00.000Z",
    }));
    assert.equal(run.phase, QSL_STORY_PHASES.PLAYER_CLARIFICATION_CALL);
    const html = await render(React.createElement(QslStoryScreen, {
      language: "en", save: saveWithRun(run), inputBlocked: false,
      onActivityRisk() {}, onRunChange() {}, onSettle() {}, onConfirmSourceChoice() {}, onBack() {},
    }));
    assert.match(html, /data-testid="qsl-story-screen"/);
    assert.match(html, /data-player-account="true"/);
    assert.match(html, /data-operator-account="true"/);
    assert.match(html, /data-action="qsl-story-submit"/);
    assert.match(html, /data-qsl-choice="request-review"/);
    assert.match(html, /data-portrait-visible="false"/);
    assert.doesNotMatch(html, /qsl\.operator\.sora-clarification/);
    const keys = Object.keys(QSL_STORY_TEXT.en);
    assert.equal(Object.keys(QSL_STORY_TEXT).length, 7);
    for (const dictionary of Object.values(QSL_STORY_TEXT)) {
      assert.deepEqual(Object.keys(dictionary), keys);
      assert.ok(Object.values(dictionary).every((value) => typeof value === "string" && value.trim()));
    }
  } finally {
    await vite.close();
  }
});

test("Chapter 7 leave risk protects live and completed-unsettled cases", async () => {
  const { qslStoryLeaveRisk } = await import("../src/screens/qslStoryText.js");
  const run = createQslStoryRun({
    sourceQsl: SOURCE_QSL, playerCallsign: "BH1ABC", startedAt: "2026-08-28T10:00:00.000Z",
  });
  assert.equal(qslStoryLeaveRisk(run, false), "active");
  assert.equal(qslStoryLeaveRisk({ ...run, phase: QSL_STORY_PHASES.COMPLETED }, false), "unsaved");
  assert.equal(qslStoryLeaveRisk({ ...run, phase: QSL_STORY_PHASES.COMPLETED }, true), "none");
});

test("accepted Chapter 7 and its durable unlock expose only the intended entry actions", async () => {
  const vite = await createServer({ appType: "custom", logLevel: "silent", server: { middlewareMode: true } });
  try {
    const [{ HomeScreen }, { MissionCenterModal }] = await Promise.all([
      vite.ssrLoadModule("/src/screens/HomeScreen.jsx"),
      vite.ssrLoadModule("/src/screens/MissionCenterModal.jsx"),
    ]);
    const linked = {
      ...saveWithRun(null),
      locationId: "japan-tokyo-kanto", antennaId: "none", money: 0, technologyPoints: 0,
      qsoLogs: [{
        id: SOURCE_QSL.qsoId, expeditionRunId: SOURCE_QSL.eventRunId,
        expeditionSiteId: "sunward-hill", playerLocationId: "expedition:sunward-hill",
        personId: "person:sora", stationId: "station:sim6jp", callsign: "SIM6JP",
        completedAt: SOURCE_QSL.createdAt, isFictional: true,
      }],
      qsoRecords: { total: 1 }, operatorRelationships: [], practiceRecords: {},
      expeditionState: {
        settledRunIds: [SOURCE_QSL.eventRunId],
        settledQsoProofs: [{
          runId: SOURCE_QSL.eventRunId, qsoId: SOURCE_QSL.qsoId, siteId: "sunward-hill",
          personId: "person:sora", stationId: "station:sim6jp", completedAt: SOURCE_QSL.createdAt,
          playerLocationId: "expedition:sunward-hill", isFictional: true,
        }],
      },
      missionState: {
        claimedMissionIds: ["story-01", "story-02", "story-03", "story-04", "story-05", "story-06"],
        activeMissions: [{ id: "story-07", acceptedAt: "2026-08-28T09:30:00.000Z", baselineQslStoryRunIds: [] }],
        history: [], events: [],
      },
    };
    const callbacks = {
      onPurchase() {}, onEquipItem() {}, onUnlockTechnology() {}, onAcceptMission() {}, onClaimMission() {},
      onAbandonMission() {}, onEnterLights() {}, onEnterExpedition() {}, onEnterQslStory() {},
      onConfirmQslChoice() {}, onEnterStation() {}, onEnterPractice() {}, onBack() {}, onSettings() {},
    };
    const missionHtml = await render(React.createElement(MissionCenterModal, {
      language: "en", save: linked, onAccept() {}, onClaim() {}, onAbandon() {},
      onLaunchLights() {}, onLaunchExpedition() {}, onLaunchQslStory() {}, onClose() {},
    }));
    assert.match(missionHtml, /data-action="launch-qsl-story"/);

    const replaySave = {
      ...linked,
      missionState: { ...linked.missionState, activeMissions: [], claimedMissionIds: [...linked.missionState.claimedMissionIds, "story-07"] },
      storyContinuationState: { chapter07: { activeRun: null, cases: [], settledRunIds: [], peopleTaskTreeUnlocked: true } },
    };
    const homeHtml = await render(React.createElement(HomeScreen, { language: "en", save: replaySave, ...callbacks }));
    assert.match(homeHtml, /data-action="enter-qsl-story-home"/);
  } finally {
    await vite.close();
  }
});
