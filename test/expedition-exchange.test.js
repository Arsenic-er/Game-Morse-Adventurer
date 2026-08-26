import assert from "node:assert/strict";
import test from "node:test";

import { parseExpeditionExchange } from "../src/game/expeditionExchange.js";

const EXPECTED = Object.freeze({ qthCode: "SUNWARD", powerWatts: 5, antennaCode: "WIRE" });

test("canonical and compact QTH-PWR-ANT exchanges are accepted deterministically", () => {
  for (const message of [
    "QTH SUNWARD PWR 5W ANT WIRE K",
    "QTH=SUNWARD PWR=5W ANT=WIRE",
    "SUNWARD 5W WIRE",
  ]) {
    const parsed = parseExpeditionExchange(message, EXPECTED, { safeToCommit: true });
    assert.equal(parsed.accepted, true, message);
    assert.deepEqual(parsed.fields, { qthCode: "SUNWARD", powerWatts: 5, antennaCode: "WIRE" });
    assert.deepEqual(parsed.topics, ["QTH", "POWER", "ANTENNA"]);
    assert.deepEqual(parsed.errors, []);
  }
});

test("harmless CW procedure words do not change hard-field meaning", () => {
  const parsed = parseExpeditionExchange(
    "DE BH1ABC PSE QTH SUNWARD / PWR 5 W / ANT WIRE BK K",
    EXPECTED,
    { safeToCommit: true },
  );
  assert.equal(parsed.accepted, true);
  assert.deepEqual(parsed.fields, { qthCode: "SUNWARD", powerWatts: 5, antennaCode: "WIRE" });
});

test("wrong or missing hard fields fail closed with field-specific reasons", () => {
  assert.deepEqual(
    parseExpeditionExchange("QTH LAKEVIEW PWR 5W ANT WIRE", EXPECTED).errors,
    ["WRONG_QTH"],
  );
  assert.deepEqual(
    parseExpeditionExchange("QTH SUNWARD PWR 50W ANT WIRE", EXPECTED).errors,
    ["WRONG_POWER"],
  );
  assert.deepEqual(
    parseExpeditionExchange("QTH SUNWARD PWR 5W ANT EFHW", EXPECTED).errors,
    ["WRONG_ANTENNA"],
  );
  assert.deepEqual(
    parseExpeditionExchange("QTH SUNWARD PWR 5W", EXPECTED).errors,
    ["MISSING_ANTENNA"],
  );
});

test("semantic safety can veto but never supply deterministic hard fields", () => {
  const unsafe = parseExpeditionExchange(
    "QTH SUNWARD PWR 5W ANT WIRE",
    EXPECTED,
    { safeToCommit: false, topics: ["QTH", "POWER", "ANTENNA"] },
  );
  assert.equal(unsafe.accepted, false);
  assert.deepEqual(unsafe.errors, ["UNSAFE_SEMANTICS"]);

  const semanticOnly = parseExpeditionExchange(
    "PSE K",
    EXPECTED,
    { safeToCommit: true, topics: ["QTH", "POWER", "ANTENNA"] },
  );
  assert.equal(semanticOnly.accepted, false);
  assert.deepEqual(semanticOnly.errors, ["MISSING_QTH", "MISSING_POWER", "MISSING_ANTENNA"]);
});

test("hostile and oversized exchange input is bounded and rejected", () => {
  const parsed = parseExpeditionExchange(`QTH SUNWARD PWR 5W ANT WIRE\u0000${"X".repeat(1000)}`, EXPECTED);
  assert.equal(parsed.accepted, false);
  assert.ok(parsed.normalizedText.length <= 240);
  assert.ok(parsed.errors.includes("UNSAFE_INPUT"));

  const oversized = parseExpeditionExchange(
    `QTH SUNWARD PWR 5W ANT WIRE ${"X".repeat(1000)}`,
    EXPECTED,
  );
  assert.equal(oversized.accepted, false);
  assert.ok(oversized.errors.includes("UNSAFE_INPUT"));
});
