import test from "node:test";
import assert from "node:assert/strict";
import { ACCESSORIES, accessoryName, getAccessory } from "../src/game/accessoryCatalog.js";

test("accessory catalog provides an empty sentinel and the CW-500 filter", () => {
  assert.deepEqual(ACCESSORIES.map((item) => item.id), ["none", "cw-filter-500"]);

  const filter = getAccessory("cw-filter-500");
  assert.equal(filter.price, 300);
  assert.equal(filter.purchasable, true);
  assert.equal(filter.noiseGainMultiplier, 0.65);
  assert.equal(filter.bandwidthHz, 500);
  assert.equal(filter.filterCenterHz, 650);
  assert.equal(filter.filterQ, 1.3);
  assert.equal(filter.image, "./assets/accessories/cw-filter-500.png");

  const empty = getAccessory("none");
  assert.equal(empty.noiseGainMultiplier, 1);
  assert.equal(empty.bandwidthHz, null);
  assert.equal(empty.filterCenterHz, null);
  assert.equal(empty.filterQ, null);
});

test("accessory names support all interface languages and unknown ids are safe", () => {
  const filter = getAccessory("cw-filter-500");
  for (const language of ["zh-CN", "zh-TW", "ja", "en"]) {
    assert.ok(accessoryName(filter, language));
  }
  assert.equal(getAccessory("unknown").id, "none");
});
