import assert from "node:assert/strict";
import test from "node:test";

import {
  EXPEDITION_FIELD_COMPATIBILITY,
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
    battery: { id: "loan-lifepo4-12wh", capacityWh: 12 },
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
    batteryId: "loan-lifepo4-12wh",
    outputPowerWatts: 5,
    receiveDrawWatts: 2,
    transmitDrawWatts: 12,
    antennaCode: "WIRE",
    capacityWh: 12,
  });
  assert.deepEqual(save, snapshot);
  assert.equal(save.ownedEquipment.includes(loadout.radioId), false);
  assert.equal(save.ownedAntennas.includes(loadout.antennaId), false);
});

test("owned field loadouts fail closed until a real battery component is catalogued", () => {
  const save = {
    ownedEquipment: ["usdr-8"],
    ownedAntennas: ["dipole"],
    accessories: ["cw-filter-500"],
  };
  const attack = {
    source: "owned",
    radioId: "usdr-8", antennaId: "dipole", batteryId: "cw-filter-500",
    outputPowerWatts: 100, receiveDrawWatts: 0.1, transmitDrawWatts: 0.1,
    antennaCode: "MOON", capacityWh: 2_000,
  };
  assert.equal(createExpeditionLoadout(save, attack), null);
  assert.equal(normalizeExpeditionLoadout(attack), null);
  assert.deepEqual(EXPEDITION_FIELD_COMPATIBILITY.batteries, []);
  assert.deepEqual(EXPEDITION_FIELD_COMPATIBILITY.ownedCombinations, []);
  assert.equal(Object.isFrozen(EXPEDITION_FIELD_COMPATIBILITY), true);
  assert.equal(Object.isFrozen(EXPEDITION_FIELD_COMPATIBILITY.radios), true);
  assert.deepEqual(save, {
    ownedEquipment: ["usdr-8"],
    ownedAntennas: ["dipole"],
    accessories: ["cw-filter-500"],
  });
});

test("loan allowlist ignores caller-supplied performance fields", () => {
  const loadout = createExpeditionLoadout({}, {
    source: "loan", radioId: "usdr-8", antennaId: "yagi-3el", batteryId: "cw-filter-500",
    outputPowerWatts: 100, receiveDrawWatts: 0.1, transmitDrawWatts: 0.1,
    antennaCode: "MOON", capacityWh: 2_000,
  });
  assert.deepEqual(loadout, createExpeditionLoadout({}, { source: "loan" }));
});

test("owned-loadout rejection inspects only bounded recent inventory entries", () => {
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
    ownedEquipment: guardedInventory("usdr-8"),
    ownedAntennas: guardedInventory("dipole"),
    accessories: guardedInventory("cw-filter-500"),
  }, {
    source: "owned", radioId: "usdr-8", antennaId: "dipole", batteryId: "cw-filter-500",
    outputPowerWatts: 100, receiveDrawWatts: 0.1, transmitDrawWatts: 0.1,
    antennaCode: "MOON", capacityWh: 2_000,
  });
  assert.equal(loadout, null);
});

test("loadout validation never trusts inherited equipment fields", () => {
  const inheritedLoan = Object.create(createExpeditionLoadout({}, { source: "loan" }));
  assert.equal(normalizeExpeditionLoadout(inheritedLoan), null);

  const inheritedInventory = Object.create({
    ownedEquipment: ["usdr-8"], ownedAntennas: ["dipole"], accessories: ["cw-filter-500"],
  });
  const owned = {
    source: "owned", radioId: "usdr-8", antennaId: "dipole", batteryId: "cw-filter-500",
    outputPowerWatts: 100, receiveDrawWatts: 0.1, transmitDrawWatts: 0.1,
    antennaCode: "MOON", capacityWh: 2_000,
  };
  assert.equal(createExpeditionLoadout(inheritedInventory, owned), null);
});
