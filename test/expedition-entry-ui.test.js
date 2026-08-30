import assert from "node:assert/strict";
import { PassThrough } from "node:stream";
import test from "node:test";
import React from "react";
import { renderToPipeableStream } from "react-dom/server";
import { createServer } from "vite";

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

function save({ storySixClaimed = false, expeditionTreeUnlocked = false } = {}) {
  const claimedMissionIds = ["story-01", "story-02", "story-03", "story-04", "story-05"];
  if (storySixClaimed) claimedMissionIds.push("story-06");
  return {
    id: "entry-save",
    callsign: "BH1ABC",
    locationId: "japan-tokyo-kanto",
    antennaId: "none",
    money: 0,
    technologyPoints: 0,
    qsoLogs: [],
    qsoRecords: { total: 0 },
    missionState: { claimedMissionIds, activeMissions: [], history: [], events: [] },
    expeditionState: { expeditionTreeUnlocked },
  };
}

const callbacks = {
  onPurchase() {}, onEquipItem() {}, onUnlockTechnology() {}, onAcceptMission() {},
  onClaimMission() {}, onAbandonMission() {}, onEnterLights() {}, onEnterExpedition() {},
  onConfirmQslChoice() {}, onEnterStation() {}, onEnterPractice() {}, onBack() {}, onSettings() {},
};

test("Home and Mission Center render a durable expedition replay entry, never a pre-acceptance shortcut", async () => {
  const vite = await createServer({
    appType: "custom", logLevel: "silent", optimizeDeps: { noDiscovery: true },
    server: { middlewareMode: true },
  });
  try {
    const [{ HomeScreen }, { MissionCenterModal }] = await Promise.all([
      vite.ssrLoadModule("/src/screens/HomeScreen.jsx"),
      vite.ssrLoadModule("/src/screens/MissionCenterModal.jsx"),
    ]);
    const locked = save();
    const lockedHome = await render(React.createElement(HomeScreen, { language: "en", save: locked, ...callbacks }));
    const lockedMissions = await render(React.createElement(MissionCenterModal, {
      language: "en", save: locked,
      onAccept() {}, onClaim() {}, onAbandon() {}, onLaunchLights() {}, onLaunchExpedition() {}, onClose() {},
    }));
    assert.doesNotMatch(lockedHome, /data-action="enter-expedition-home"/);
    assert.doesNotMatch(lockedMissions, /data-action="launch-expedition-replay"/);

    for (const durableSave of [
      save({ storySixClaimed: true }),
      save({ expeditionTreeUnlocked: true }),
      JSON.parse(JSON.stringify(save({ expeditionTreeUnlocked: true }))),
    ]) {
      const home = await render(React.createElement(HomeScreen, { language: "en", save: durableSave, ...callbacks }));
      const missions = await render(React.createElement(MissionCenterModal, {
        language: "en", save: durableSave,
        onAccept() {}, onClaim() {}, onAbandon() {}, onLaunchLights() {}, onLaunchExpedition() {}, onClose() {},
      }));
      assert.match(home, /data-action="enter-expedition-home"/);
      assert.match(missions, /data-action="launch-expedition-replay"/);
    }
  } finally {
    await vite.close();
  }
});
