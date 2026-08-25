import test from "node:test";
import assert from "node:assert/strict";
import { parseLightsReport } from "../src/game/lightsExchange.js";

const CONTEXT = Object.freeze({
  selfCallsign: "BH1ABC",
  peerCallsign: "SIM5LT",
  expectedRegion: "CN",
});

test("event reports accept canonical, compact, and harmless procedure variants", () => {
  for (const message of [
    "SIM5LT DE BH1ABC RST 579 CN K",
    "SIM5LTDEBH1ABC579CNK",
    "SIM5LT DE BH1ABC R 579 CN PSE K",
    "SIM5LT DE BH1ABC RST 579 CN TU 73 SK",
  ]) {
    const result = parseLightsReport(message, CONTEXT);
    assert.equal(result.accepted, true, message);
    assert.equal(result.rst, "579");
    assert.equal(result.region, "CN");
  }
});

test("event report hard fields reject wrong identities, RST values, and regions", () => {
  assert.equal(parseLightsReport("SIM5LT DE BH1ABX RST 579 CN K", CONTEXT).reason, "wrongCallsign");
  assert.equal(parseLightsReport("BH1ABC DE SIM5LT RST 579 CN K", CONTEXT).reason, "wrongCallsignOrder");
  assert.equal(parseLightsReport("SIM5LT DE BH1ABC RST 999 CN K", CONTEXT).reason, "invalidRst");
  assert.equal(parseLightsReport("SIM5LT DE BH1ABC RST 579 US K", CONTEXT).reason, "wrongRegion");
  assert.equal(parseLightsReport("SIM5LT DE BH1ABC RST 579 DE K", CONTEXT).reason, "wrongRegion");
  assert.equal(parseLightsReport("SIM5LT DE BH1ABC RST 579 K", CONTEXT).reason, "missingRegion");
  assert.equal(parseLightsReport("SIM5LT DE BH1ABC RST 579 CN", CONTEXT).reason, "missingHandoff");
});

test("an explicitly unsafe semantic result fails closed", () => {
  const result = parseLightsReport("SIM5LT DE BH1ABC RST 579 CN K", {
    ...CONTEXT,
    semanticResult: { safeToCommit: false },
  });
  assert.deepEqual(result, {
    accepted: false, reason: "unsafeSemanticResult", rst: null, region: null,
  });
});

test("three-digit callsign suffixes are never parsed as the signal report", () => {
  const result = parseLightsReport("SIMJ182 DE SIM5LT RST 579 CN K", {
    selfCallsign: "SIM5LT",
    peerCallsign: "SIMJ182",
    expectedRegion: "CN",
  });
  assert.deepEqual(result, { accepted: true, reason: null, rst: "579", region: "CN" });
});
