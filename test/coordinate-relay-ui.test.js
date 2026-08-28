import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { COORDINATE_RELAY_PHASES } from "../src/game/coordinateRelayRun.js";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("Chapter 9 screen exposes fictional Pixel Grid source, relay, fields, recovery, and no portrait", async () => {
  const screen = read("src/screens/CoordinateRelayScreen.jsx");
  const { COORDINATE_RELAY_SETTLED_TEXT, COORDINATE_RELAY_TEXT } = await import("../src/screens/coordinateRelayText.js");
  assert.match(screen, /data-testid="coordinate-relay-screen"/);
  assert.match(screen, /data-simulation="fictional-pixel-grid"/);
  assert.match(screen, /data-coordinate-phase=/);
  assert.match(screen, /data-packet-grid=/);
  assert.match(screen, /data-packet-utc=/);
  assert.match(screen, /data-packet-check=/);
  assert.match(screen, /data-action="coordinate-submit"/);
  assert.match(screen, /useStructuredCwInput/);
  assert.match(screen, /data-pulse-count=\{cw\.analysis\.pulseCount\}/);
  assert.match(screen, /data-decoded=\{cw\.analysis\.decoded\}/);
  assert.doesNotMatch(screen, /<input\b/);
  assert.match(screen, /data-action="coordinate-settle"/);
  assert.match(screen, /data-settlement-attempts=\{settlementAttempts\}/);
  assert.match(screen, /data-action="coordinate-settle" disabled=\{inputBlocked\}/);
  assert.match(screen, /settled && <p className="coordinate-relay-settlement-banner" role="status">\{settledText\}/);
  assert.equal(Object.keys(COORDINATE_RELAY_SETTLED_TEXT).length, 7);
  assert.match(screen, /cwgameSystem\?\.interpretCwTraffic/);
  assert.match(screen, /data-portrait-visible="false"/);
  assert.doesNotMatch(screen, /<img[^>]+portrait/i);
  assert.doesNotMatch(screen, /LATITUDE|LONGITUDE|911|112|POLICE|FIRE|HOSPITAL|EMERGENCY/i);
  const keys = Object.keys(COORDINATE_RELAY_TEXT.en);
  assert.equal(Object.keys(COORDINATE_RELAY_TEXT).length, 7);
  for (const dictionary of Object.values(COORDINATE_RELAY_TEXT)) {
    assert.deepEqual(Object.keys(dictionary), keys);
    assert.ok(Object.values(dictionary).every((value) => typeof value === "string" && value.trim()));
  }
});

test("structured message log renders canonical packet fields and never player input", () => {
  const source = read("src/screens/StructuredMessageLogModal.jsx");
  assert.match(source, /normalizeCoordinateRelayState/);
  for (const field of ["packetId", "grid", "utc", "people", "check", "completedAt"]) assert.match(source, new RegExp(`packet\\.${field}|record\\.${field}`));
  assert.doesNotMatch(source, /rawInput|playerInput|decodedText|freeText/);
  assert.match(source, /window\.addEventListener\("keydown"/);
  assert.match(source, /event\.key === "Escape"/);
});

test("Chapter 9 has active mission, durable replay, tool, route, leave guard, and responsive entry contracts", async () => {
  const app = read("src/App.jsx");
  const home = read("src/screens/HomeScreen.jsx");
  const mission = read("src/screens/MissionCenterModal.jsx");
  const css = read("src/pixel-theme.css");
  const { coordinateRelayLeaveRisk } = await import("../src/screens/coordinateRelayText.js");
  assert.match(app, /screen === "coordinate-relay"/);
  assert.match(home, /import\s*\{[^}]*\bGridFour\b[^}]*\}\s*from "@phosphor-icons\/react"/);
  assert.match(home, /data-action="enter-coordinate-relay-home"/);
  assert.match(home, /data-action="open-structured-messages"/);
  assert.match(mission, /data-action="launch-coordinate-relay"/);
  assert.match(css, /@media \(max-width: 820px\)[\s\S]*\.coordinate-relay-screen/);
  assert.equal(coordinateRelayLeaveRisk({ phase: COORDINATE_RELAY_PHASES.PLAYER_READBACK }, false), "active");
  assert.equal(coordinateRelayLeaveRisk({ phase: COORDINATE_RELAY_PHASES.COMPLETED }, false), "unsaved");
  assert.equal(coordinateRelayLeaveRisk({ phase: COORDINATE_RELAY_PHASES.COMPLETED }, true), "none");
});
