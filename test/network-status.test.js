import test from "node:test";
import assert from "node:assert/strict";
import networkStatus from "../electron/network-status.cjs";

const { parseNetshWlan, stateForSignalPercent } = networkStatus;

test("maps Windows WLAN signal percentages to four game states", () => {
  assert.equal(stateForSignalPercent(100), "good");
  assert.equal(stateForSignalPercent(75), "good");
  assert.equal(stateForSignalPercent(74), "medium");
  assert.equal(stateForSignalPercent(40), "medium");
  assert.equal(stateForSignalPercent(39), "poor");
  assert.equal(stateForSignalPercent(1), "poor");
  assert.equal(stateForSignalPercent(0), "offline");
});

test("parses the strongest connected interface from netsh output", () => {
  const parsed = parseNetshWlan(`\n    Signal                 : 100%\n    Signal                 : 58%\n`);
  assert.deepEqual(parsed, { state: "good", signalPercent: 100, source: "windows-wlan" });
});

test("leaves browser online state as fallback when WLAN telemetry is unavailable", () => {
  assert.deepEqual(parseNetshWlan("There is no wireless interface on the system."), {
    state: null, signalPercent: null, source: "windows-wlan",
  });
});
