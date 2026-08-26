import assert from "node:assert/strict";
import test from "node:test";

import {
  EXPEDITION_LOAN_KIT,
  EXPEDITION_SITES,
  createExpeditionLoadout,
  expeditionSiteById,
  normalizeExpeditionLoadout,
} from "../src/game/expeditionCatalog.js";

test("the expedition catalogue exposes exactly three immutable fictional hill sites", () => {
  assert.equal(EXPEDITION_SITES.length, 3);
  assert.deepEqual(EXPEDITION_SITES.map(({ id }) => id), [
    "sunward-hill",
    "cedar-breeze-hill",
    "lakeview-hill",
  ]);
  assert.ok(EXPEDITION_SITES.every((site) => site.fictional === true
    && Number.isFinite(site.latitude) && Math.abs(site.latitude) <= 90
    && Number.isFinite(site.longitude) && Math.abs(site.longitude) <= 180
    && /^[A-Za-z_]+\/[A-Za-z_]+$/.test(site.timeZone)
    && /^[A-Z]{3,12}$/.test(site.qthCode)
    && Object.isFrozen(site)));
  assert.equal(Object.isFrozen(EXPEDITION_SITES), true);
  assert.equal(expeditionSiteById("not-real"), null);
});

test("the story loan creates an isolated portable-radio wire-antenna battery loadout", () => {
  assert.deepEqual(EXPEDITION_LOAN_KIT, {
    radio: {
      id: "loan-portable-cw",
      exchangePowerWatts: 5,
      receiveDrawWatts: 2,
      transmitDrawWatts: 12,
    },
    antenna: { id: "loan-wire-dipole", exchangeCode: "WIRE" },
    battery: { id: "loan-lifepo4-96wh", capacityWh: 96 },
  });
  const save = {
    locationId: "japan-tokyo-kanto",
    equipmentId: "squid-01",
    antennaId: "dipole",
    ownedEquipment: ["squid-01"],
    ownedAntennas: ["dipole"],
    accessories: [],
  };
  const snapshot = structuredClone(save);
  const loadout = createExpeditionLoadout(save, { source: "loan" });

  assert.deepEqual(loadout, {
    source: "loan",
    radioId: "loan-portable-cw",
    antennaId: "loan-wire-dipole",
    batteryId: "loan-lifepo4-96wh",
    outputPowerWatts: 5,
    receiveDrawWatts: 2,
    transmitDrawWatts: 12,
    antennaCode: "WIRE",
    capacityWh: 96,
  });
  assert.deepEqual(save, snapshot);
  assert.equal(save.ownedEquipment.includes(loadout.radioId), false);
  assert.equal(save.ownedAntennas.includes(loadout.antennaId), false);
});

test("owned field choices stay separate from the loan kit and must already be owned", () => {
  const save = {
    ownedEquipment: ["usdx-01"],
    ownedAntennas: ["endfed"],
    accessories: ["field-battery"],
  };
  const owned = createExpeditionLoadout(save, {
    source: "owned",
    radioId: "usdx-01",
    antennaId: "endfed",
    batteryId: "field-battery",
    outputPowerWatts: 8,
    receiveDrawWatts: 3,
    transmitDrawWatts: 18,
    antennaCode: "EFHW",
    capacityWh: 72,
  });
  assert.equal(owned.source, "owned");
  assert.equal(owned.radioId, "usdx-01");
  assert.equal(createExpeditionLoadout(save, { ...owned, radioId: "not-owned" }), null);
  assert.equal(normalizeExpeditionLoadout({ ...owned, source: "loan", radioId: "forged" }), null);
  assert.deepEqual(save, {
    ownedEquipment: ["usdx-01"],
    ownedAntennas: ["endfed"],
    accessories: ["field-battery"],
  });
});

test("owned-loadout validation inspects only bounded recent inventory entries", () => {
  const guardedInventory = (finalValue) => new Proxy(
    [...Array(9_999).fill("old-item"), finalValue],
    {
      get(target, property, receiver) {
        if (/^\d+$/.test(String(property)) && Number(property) < 9_000) {
          throw new Error("unbounded inventory scan");
        }
        return Reflect.get(target, property, receiver);
      },
    },
  );
  const loadout = createExpeditionLoadout({
    ownedEquipment: guardedInventory("usdx-01"),
    ownedAntennas: guardedInventory("endfed"),
    accessories: guardedInventory("field-battery"),
  }, {
    source: "owned", radioId: "usdx-01", antennaId: "endfed", batteryId: "field-battery",
    outputPowerWatts: 8, receiveDrawWatts: 3, transmitDrawWatts: 18,
    antennaCode: "EFHW", capacityWh: 72,
  });
  assert.equal(loadout.radioId, "usdx-01");
});
