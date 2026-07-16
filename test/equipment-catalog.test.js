import test from "node:test";
import assert from "node:assert/strict";
import { getAntenna } from "../src/game/antennaCatalog.js";
import { getKeyOption, getTransmitter } from "../src/game/equipmentCatalog.js";

test("equipment catalogs normalize unknown ids to safe defaults", () => {
  assert.equal(getAntenna("unknown").id, "none");
  assert.equal(getKeyOption("unknown").id, "manual");
  assert.equal(getTransmitter("unknown").id, "squid-01");
});

test("the Yagi improves propagation while an empty antenna slot blocks RF", () => {
  assert.equal(getAntenna("yagi-3el").propagationBonus, 1);
  assert.ok(getAntenna("none").propagationBonus < 0);
});
