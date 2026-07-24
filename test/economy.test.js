import test from "node:test";
import assert from "node:assert/strict";
import {
  ECONOMY_RESULT,
  equipOwnedItem,
  purchaseItem,
} from "../src/game/economy.js";

function saveFixture(overrides = {}) {
  return {
    id: "save-economy-test",
    callsign: "BH1ABC",
    equipmentId: "squid-01",
    antennaId: "dipole",
    keyType: "manual",
    credits: 700,
    ownedEquipment: ["squid-01"],
    ownedAntennas: ["dipole"],
    accessories: [],
    updatedAt: "2026-07-24T00:00:00.000Z",
    ...overrides,
  };
}

test("a successful purchase deducts the price once and adds the item to inventory", () => {
  const original = saveFixture();
  const result = purchaseItem(original, { category: "antenna", itemId: "yagi-3el" });

  assert.equal(result.purchased, true);
  assert.equal(result.reason, ECONOMY_RESULT.PURCHASED);
  assert.notStrictEqual(result.save, original);
  assert.equal(result.save.credits, 200);
  assert.deepEqual(result.save.ownedAntennas, ["dipole", "yagi-3el"]);

  assert.equal(original.credits, 700);
  assert.deepEqual(original.ownedAntennas, ["dipole"]);
});

test("purchasing an item never equips it automatically", () => {
  const original = saveFixture();
  const result = purchaseItem(original, { category: "antenna", itemId: "vertical" });

  assert.equal(result.purchased, true);
  assert.equal(result.reason, ECONOMY_RESULT.PURCHASED);
  assert.equal(result.save.antennaId, "dipole");
  assert.ok(result.save.ownedAntennas.includes("vertical"));
});

test("an unaffordable purchase fails without cloning or mutating the save", () => {
  const original = saveFixture({ credits: 499 });
  const result = purchaseItem(original, { category: "antenna", itemId: "yagi-3el" });

  assert.equal(result.purchased, false);
  assert.equal(result.reason, ECONOMY_RESULT.INSUFFICIENT_CREDITS);
  assert.strictEqual(result.save, original);
  assert.equal(original.credits, 499);
  assert.deepEqual(original.ownedAntennas, ["dipole"]);
});

test("a repeated purchase is rejected and cannot deduct credits twice", () => {
  const first = purchaseItem(saveFixture(), { category: "antenna", itemId: "yagi-3el" });
  const retry = purchaseItem(first.save, { category: "antenna", itemId: "yagi-3el" });

  assert.equal(first.purchased, true);
  assert.equal(retry.purchased, false);
  assert.equal(retry.reason, ECONOMY_RESULT.ALREADY_OWNED);
  assert.strictEqual(retry.save, first.save);
  assert.equal(retry.save.credits, 200);
  assert.deepEqual(retry.save.ownedAntennas, ["dipole", "yagi-3el"]);
});

test("unknown store item ids are rejected without changing the save", () => {
  const original = saveFixture();
  const result = purchaseItem(original, { category: "antenna", itemId: "not-a-store-item" });

  assert.equal(result.purchased, false);
  assert.equal(result.reason, ECONOMY_RESULT.UNKNOWN_ITEM);
  assert.strictEqual(result.save, original);
});

test("an antenna cannot be equipped until it is owned", () => {
  const original = saveFixture();
  const result = equipOwnedItem(original, { category: "antenna", itemId: "yagi-3el" });

  assert.equal(result.equipped, false);
  assert.equal(result.reason, ECONOMY_RESULT.NOT_OWNED);
  assert.strictEqual(result.save, original);
  assert.equal(result.save.antennaId, "dipole");
});

test("the none sentinel can always unequip an antenna without entering inventory", () => {
  const original = saveFixture({
    antennaId: "yagi-3el",
    ownedAntennas: ["dipole", "yagi-3el"],
  });
  const result = equipOwnedItem(original, { category: "antenna", itemId: "none" });

  assert.equal(result.equipped, true);
  assert.equal(result.reason, ECONOMY_RESULT.EQUIPPED);
  assert.notStrictEqual(result.save, original);
  assert.equal(result.save.antennaId, "none");
  assert.equal(result.save.ownedAntennas.includes("none"), false);
});
