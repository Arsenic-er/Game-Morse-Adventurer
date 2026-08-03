import test from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_PLAYER_LOCATION, GRID_HEIGHT, GRID_WIDTH, NPC_STATIONS, baseLevelAt,
  channelProfileForLevel, evaluatedNpcStations, finalPropagationLevel,
  cqResponseProbabilityForLevel, generatePropagationMap, locationFromNormalizedPoint,
  normalizedPointFromLocation, selectNpcForQso, selectNpcListenerForCq, selectNpcResponseForCq,
} from "../src/propagation/propagationEngine.js";

test("generates a deterministic 72x36 offline propagation map", () => {
  const options = { playerLocation: DEFAULT_PLAYER_LOCATION, utc: new Date("2026-07-15T09:00:00Z") };
  const first = generatePropagationMap(options);
  const second = generatePropagationMap(options);
  assert.equal(first.cells.length, GRID_WIDTH * GRID_HEIGHT);
  assert.deepEqual(first.cells, second.cells);
  assert.equal(first.source, "OFFLINE_DEFAULT");
  assert.ok(first.cells.every((level) => Number.isInteger(level) && level >= 0 && level <= 4));
  assert.deepEqual([...new Set(first.cells)].sort(), [0, 1, 2, 3, 4]);
});

test("map result changes with UTC template or player location", () => {
  const morning = generatePropagationMap({ utc: "2026-07-15T03:00:00Z" });
  const evening = generatePropagationMap({ utc: "2026-07-15T15:00:00Z" });
  assert.notDeepEqual(morning.cells, evening.cells);
});

test("final propagation level clamps equipment and station bonuses", () => {
  assert.equal(finalPropagationLevel(3, 0, 1), 4);
  assert.equal(finalPropagationLevel(4, 1, 2), 4);
  assert.equal(finalPropagationLevel(0, 0, 0), 0);
});

test("NPC eligibility and deterministic selection use map levels", () => {
  const map = generatePropagationMap({ utc: "2026-07-15T09:00:00Z" });
  const evaluated = evaluatedNpcStations(map);
  assert.equal(evaluated.length, NPC_STATIONS.length);
  assert.ok(evaluated.every((npc) => npc.finalLevel === finalPropagationLevel(baseLevelAt(map, npc), 0, npc.stationBonus)));
  assert.deepEqual(selectNpcForQso(map, { seed: "fixed" }), selectNpcForQso(map, { seed: "fixed" }));
});

test("weak levels produce more noise and deeper QSB", () => {
  const weak = channelProfileForLevel(1, { callsign: "SIM1" });
  const strong = channelProfileForLevel(4, { callsign: "SIM1" });
  assert.ok(weak.noiseGain > strong.noiseGain);
  assert.ok(weak.qsbDepth > strong.qsbDepth);
  assert.ok(weak.signalGain < strong.signalGain);
});

test("antenna modifiers can reduce QSB without changing the propagation level", () => {
  const base = channelProfileForLevel(2, { callsign: "SIM1" });
  const vertical = channelProfileForLevel(2, { callsign: "SIM1" }, { qsbDepthMultiplier: 0.85 });
  assert.equal(vertical.level, base.level);
  assert.equal(vertical.noiseGain, base.noiseGain);
  assert.equal(vertical.signalGain, base.signalGain);
  assert.equal(vertical.qsbDepth, base.qsbDepth * 0.85);
});

test("accessory modifiers reduce receiver noise without changing signal or propagation", () => {
  const base = channelProfileForLevel(2, { callsign: "SIM1" });
  const filtered = channelProfileForLevel(2, { callsign: "SIM1" }, {
    noiseGainMultiplier: 0.65,
    noiseFilterCenterHz: 650,
    noiseFilterQ: 1.3,
  });
  assert.equal(filtered.level, base.level);
  assert.equal(filtered.noiseGain, base.noiseGain * 0.65);
  assert.equal(filtered.signalGain, base.signalGain);
  assert.equal(filtered.qsbDepth, base.qsbDepth);
  assert.equal(filtered.qsbRateHz, base.qsbRateHz);
  assert.equal(filtered.noiseFilterCenterHz, 650);
  assert.equal(filtered.noiseFilterQ, 1.3);
});

test("receiver noise modifiers clamp to a safe range and reject invalid values", () => {
  const base = channelProfileForLevel(2, { callsign: "SIM1" });
  assert.equal(channelProfileForLevel(2, {}, { noiseGainMultiplier: -1 }).noiseGain, 0);
  assert.equal(channelProfileForLevel(2, {}, { noiseGainMultiplier: 3 }).noiseGain, base.noiseGain * 2);
  assert.equal(channelProfileForLevel(2, {}, { noiseGainMultiplier: Infinity }).noiseGain, base.noiseGain);
  assert.equal(channelProfileForLevel(2, {}, { noiseGainMultiplier: "0.5" }).noiseGain, base.noiseGain);
  assert.equal(channelProfileForLevel(2, {}, { noiseGainMultiplier: "invalid" }).noiseGain, base.noiseGain);
});

test("normalized map clicks convert to latitude and longitude", () => {
  assert.deepEqual(locationFromNormalizedPoint(.5, .5), { latitude: 0, longitude: 0 });
  assert.deepEqual(locationFromNormalizedPoint(1, 0), { latitude: 90, longitude: 180 });
});

test("station coordinates use the equirectangular map projection", () => {
  assert.deepEqual(normalizedPointFromLocation({ latitude: 0, longitude: 0 }), { x: .5, y: .5 });
  const japan = normalizedPointFromLocation({ latitude: 35.68, longitude: 139.76 });
  assert.ok(Math.abs(japan.x - .888222) < .000001);
  assert.ok(Math.abs(japan.y - .301778) < .000001);
  assert.deepEqual(normalizedPointFromLocation({ latitude: 120, longitude: 220 }), { x: 1, y: 0 });
});

test("the legacy CQ response helper is now an eligibility gate without random loss", () => {
  assert.deepEqual([0, 1, 2, 3, 4].map(cqResponseProbabilityForLevel), [0, 1, 1, 1, 1]);
});

test("CQ responder selection uses current eligibility without a second silence roll", () => {
  const station = {
    callsign: "SIMTEST", latitude: 0, longitude: 0, stationBonus: 0,
    isStrongStation: false, isFictional: true,
  };
  const silentMap = {
    ...generatePropagationMap({ utc: "2026-07-15T09:00:00Z" }),
    cells: new Array(GRID_WIDTH * GRID_HEIGHT).fill(0),
  };
  assert.equal(selectNpcResponseForCq(silentMap, { stations: [station], seed: "fixed" }), null);
  assert.equal(selectNpcResponseForCq(silentMap, { stations: [station], seed: "fixed", rfEnabled: false }), null);

  const strongMap = { ...silentMap, cells: new Array(GRID_WIDTH * GRID_HEIGHT).fill(4) };
  const first = selectNpcResponseForCq(strongMap, { stations: [station], seed: "respond-1" });
  const second = selectNpcResponseForCq(strongMap, { stations: [station], seed: "respond-1" });
  assert.deepEqual(first, second);
  const responses = Array.from({ length: 100 }, (_, index) => (
    selectNpcResponseForCq(strongMap, { stations: [station], seed: `sample-${index}` })
  )).filter(Boolean);
  assert.equal(responses.length, 100);
});

test("live CQ listeners require current eligibility but do not receive a second random silence penalty", () => {
  const station = {
    callsign: "SIMTEST", latitude: 0, longitude: 0, stationBonus: 0,
    isStrongStation: false, isFictional: true,
  };
  const base = generatePropagationMap({ utc: "2026-07-15T09:00:00Z" });
  const silentMap = { ...base, cells: new Array(GRID_WIDTH * GRID_HEIGHT).fill(0) };
  const strongMap = { ...base, cells: new Array(GRID_WIDTH * GRID_HEIGHT).fill(4) };
  assert.equal(selectNpcListenerForCq(silentMap, { stations: [station], seed: "listener" }), null);
  assert.equal(selectNpcListenerForCq(strongMap, { stations: [station], seed: "listener", rfEnabled: false }), null);
  assert.equal(selectNpcListenerForCq(strongMap, { stations: [station], seed: "listener" }).callsign, "SIMTEST");
});
