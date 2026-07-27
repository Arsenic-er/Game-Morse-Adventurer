import test from "node:test";
import assert from "node:assert/strict";
import { getAntenna } from "../src/game/antennaCatalog.js";
import { TRANSMITTERS, getKeyOption, getTransmitter } from "../src/game/equipmentCatalog.js";

test("equipment catalogs normalize unknown ids to safe defaults", () => {
  assert.equal(getAntenna("unknown").id, "none");
  assert.equal(getKeyOption("unknown").id, "manual");
  assert.equal(getTransmitter("unknown").id, "squid-01");
});

test("the Yagi improves propagation while an empty antenna slot blocks RF", () => {
  assert.equal(getAntenna("yagi-3el").propagationBonus, 1);
  assert.ok(getAntenna("none").propagationBonus < 0);
});

test("radio catalog exposes stable gameplay modifiers and swappable artwork", () => {
  const squid = getTransmitter("squid-01");
  const usdr = getTransmitter("usdr-8");

  assert.deepEqual(TRANSMITTERS.map((item) => item.id), ["squid-01", "usdr-8"]);
  assert.deepEqual({
    powerWatts: squid.powerWatts,
    propagationBonus: squid.propagationBonus,
    noiseGainMultiplier: squid.noiseGainMultiplier,
    qsbDepthMultiplier: squid.qsbDepthMultiplier,
  }, { powerWatts: 5, propagationBonus: 0, noiseGainMultiplier: 1, qsbDepthMultiplier: 1 });

  assert.equal(usdr.price, 800);
  assert.equal(usdr.purchasable, true);
  assert.equal(usdr.starter, false);
  assert.equal(usdr.fixed, false);
  assert.equal(usdr.powerWatts, 5);
  assert.equal(usdr.propagationBonus, 0);
  assert.equal(usdr.noiseGainMultiplier, 0.8);
  assert.equal(usdr.qsbDepthMultiplier, 0.85);
  assert.equal(usdr.panelLabel, "MICA-8");
  assert.equal(usdr.supplyVoltage, 13.8);
  assert.deepEqual(usdr.supportedBandsMeters, [80, 40, 30, 20, 17, 15, 12, 10]);
  assert.deepEqual(usdr.modes, ["CW"]);
  assert.deepEqual(usdr.receiverFeatures, ["DSP", "AGC", "NR"]);
  assert.match(usdr.stationImageOff, /usdr-8-off\.png$/);
  assert.match(usdr.stationImageOn, /usdr-8-on\.png$/);
});
