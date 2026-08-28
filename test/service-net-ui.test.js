import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  SERVICE_NET_PHASES, beginServiceNetRun, createServiceNetRun,
  receiveServiceNetMessage, submitServiceNetText,
} from "../src/game/serviceNetRun.js";
import { SERVICE_NET_SETTLED_TEXT, SERVICE_NET_TEXT, serviceNetLeaveRisk } from "../src/screens/serviceNetText.js";

const screenSource = readFileSync(new URL("../src/screens/ServiceNetScreen.jsx", import.meta.url), "utf8");
const homeSource = readFileSync(new URL("../src/screens/HomeScreen.jsx", import.meta.url), "utf8");
const missionSource = readFileSync(new URL("../src/screens/MissionCenterModal.jsx", import.meta.url), "utf8");

function ackRun() {
  let run = beginServiceNetRun(createServiceNetRun({
    playerCallsign: "BH1ABC", seed: "ui", startedAt: "2026-08-28T10:00:00.000Z",
  }));
  run = submitServiceNetText(run, "BH1ABC CHECK IN K", { safeToCommit: true }, "2026-08-28T10:00:10.000Z");
  return receiveServiceNetMessage(run, "2026-08-28T10:00:20.000Z");
}

test("Chapter 8 exposes the fictional service queue, hard fields, recovery, and no portrait", () => {
  assert.match(screenSource, /data-testid="service-net-screen"/);
  assert.match(screenSource, /data-simulation="fictional-public-service"/);
  assert.match(screenSource, /data-service-message-id=/);
  assert.match(screenSource, /data-service-priority=/);
  assert.match(screenSource, /data-service-receipt-count=/);
  assert.match(screenSource, /data-action="service-net-submit"/);
  assert.match(screenSource, /data-settlement-attempts=\{settlementAttempts\}/);
  assert.match(screenSource, /data-action="service-net-settle" disabled=\{inputBlocked\}/);
  assert.match(screenSource, /settled && <p className="service-net-settlement-banner" role="status">\{settledText\}/);
  assert.match(screenSource, /run\.phase !== SERVICE_NET_PHASES\.COMPLETED && run\.errors\.length > 0/);
  assert.equal(Object.keys(SERVICE_NET_SETTLED_TEXT).length, 7);
  assert.match(screenSource, /useStructuredCwInput/);
  assert.match(screenSource, /data-pulse-count=\{cw\.analysis\.pulseCount\}/);
  assert.match(screenSource, /data-decoded=\{cw\.analysis\.decoded\}/);
  assert.doesNotMatch(screenSource, /<input\b/);
  assert.match(screenSource, /data-portrait-visible="false"/);
  assert.doesNotMatch(screenSource, /<img[^>]+portrait/i);
  assert.doesNotMatch(screenSource, /911|112|POLICE|FIRE|HOSPITAL|EMERGENCY/i);
  const keys = Object.keys(SERVICE_NET_TEXT.en);
  assert.equal(Object.keys(SERVICE_NET_TEXT).length, 7);
  for (const dictionary of Object.values(SERVICE_NET_TEXT)) {
    assert.deepEqual(Object.keys(dictionary), keys);
    assert.ok(Object.values(dictionary).every((value) => typeof value === "string" && value.trim()));
  }
});

test("Chapter 8 leave risk distinguishes active, completed-unsettled, and safe state", () => {
  const run = ackRun();
  assert.equal(serviceNetLeaveRisk(run, false), "active");
  assert.equal(serviceNetLeaveRisk({ ...run, phase: SERVICE_NET_PHASES.COMPLETED, completedAt: "2026-08-28T10:01:00.000Z", currentPosition: 3 }, false), "unsaved");
  assert.equal(serviceNetLeaveRisk(run, true), "none");
  assert.equal(serviceNetLeaveRisk({ ...run, phase: SERVICE_NET_PHASES.ABANDONED, completedAt: "2026-08-28T10:01:00.000Z" }, false), "none");
});

test("accepted Chapter 8 and its durable unlock expose the intended entry actions", () => {
  assert.match(missionSource, /mission\.id === "story-08" && \(active \|\| serviceNetReplay\)/);
  assert.match(missionSource, /data-action="launch-service-net"/);
  assert.match(homeSource, /serviceNetReplayAvailable\(save\)/);
  assert.match(homeSource, /data-action="enter-service-net-home"/);
});
