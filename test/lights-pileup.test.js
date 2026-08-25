import test from "node:test";
import assert from "node:assert/strict";
import { LIGHTS_EVENT_REGIONS } from "../src/game/lightsEventCatalog.js";
import { createLightsPileup, resolveLightsCallsignSelection } from "../src/game/lightsPileup.js";

test("pile-up generation is deterministic, bounded, and makes five regions reachable", () => {
  const first = createLightsPileup({ seed: "alpha", worldSeed: "world-a", round: 1, guidance: "off" });
  const repeated = createLightsPileup({ seed: "alpha", worldSeed: "world-a", round: 1, guidance: "off" });
  assert.deepEqual(first, repeated);
  assert.ok(first.callers.length >= 3 && first.callers.length <= 4);
  assert.equal(first.callers.every(({ callsign }) => /^[A-Z0-9]{1,7}$/.test(callsign)), true);
  assert.equal(first.callers.every(({ npcId, personId, stationId, timeZone }) => (
    personId === `person:procedural:${npcId}`
      && stationId === `station:procedural:${npcId}`
      && typeof timeZone === "string"
      && timeZone.includes("/")
  )), true);
  assert.equal(first.callers.every(({ callsign, regionCode, wpm, toneHz, signalGain, startOffsetMs, text }) => (
    LIGHTS_EVENT_REGIONS.includes(regionCode)
      && wpm >= 18 && wpm <= 24
      && toneHz >= 500 && toneHz <= 780
      && signalGain >= .55 && signalGain <= 1
      && startOffsetMs >= 80 && startOffsetMs <= 560
      && text.match(new RegExp(`${callsign} ${callsign} K$`))
  )), true);
  const tones = first.callers.map(({ toneHz }) => toneHz).sort((a, b) => a - b);
  assert.equal(tones.slice(1).every((tone, index) => tone - tones[index] >= 35), true);

  const reachable = new Set();
  for (let round = 1; round <= 7; round += 1) {
    for (const caller of createLightsPileup({ seed: "alpha", worldSeed: "world-a", round, guidance: "full" }).callers) {
      reachable.add(caller.regionCode);
    }
  }
  assert.ok(reachable.size >= 5);
});

test("guidance levels set the caller-count and radio envelopes", () => {
  const full = createLightsPileup({ seed: "g", round: 2, guidance: "full" });
  const hints = createLightsPileup({ seed: "g", round: 2, guidance: "hints" });
  const off = createLightsPileup({ seed: "g", round: 2, guidance: "off" });
  assert.equal(full.callers.length, 2);
  assert.ok(hints.callers.length >= 2 && hints.callers.length <= 3);
  assert.ok(off.callers.length >= 3 && off.callers.length <= 4);
  assert.equal(full.callers.every(({ wpm }) => wpm >= 12 && wpm <= 16), true);
  assert.equal(hints.callers.every(({ wpm }) => wpm >= 15 && wpm <= 20), true);
});

test("callsign selection handles exact, unique partial, ambiguous partial, repeats, and wrong full calls", () => {
  const pileup = {
    callers: [
      { callsign: "SIMU4K2", regionCode: "US" },
      { callsign: "SIMU4K9", regionCode: "US" },
      { callsign: "SIMCABC", regionCode: "CN" },
    ],
  };
  assert.deepEqual(resolveLightsCallsignSelection(pileup, "SIMCABC DE SIM5LT KN"), {
    kind: "selected", selected: pileup.callers[2], callers: [pileup.callers[2]], partial: false,
  });
  assert.deepEqual(resolveLightsCallsignSelection(pileup, "?ABC K"), {
    kind: "selected", selected: pileup.callers[2], callers: [pileup.callers[2]], partial: true,
  });
  assert.deepEqual(resolveLightsCallsignSelection(pileup, "SIMU4K? K"), {
    kind: "ambiguous", selected: null, callers: pileup.callers.slice(0, 2), partial: true,
  });
  assert.deepEqual(resolveLightsCallsignSelection(pileup, "AGN K"), {
    kind: "repeat", selected: null, callers: pileup.callers, partial: false,
  });
  assert.deepEqual(resolveLightsCallsignSelection(pileup, "SIMF000 K"), {
    kind: "misidentified", selected: null, callers: pileup.callers, partial: false,
  });
  assert.equal(resolveLightsCallsignSelection(pileup, "?X K").kind, "no-match");
});
