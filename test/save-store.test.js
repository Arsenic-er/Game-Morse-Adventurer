import test from "node:test";
import assert from "node:assert/strict";
import {
  createSave, isValidCallsign, loadSaves, persistSaves, sanitizeCallsign,
} from "../src/game/saveStore.js";

function storageStub() {
  const data = new Map();
  return {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => data.set(key, String(value)),
    removeItem: (key) => data.delete(key),
  };
}
test("callsigns are uppercase, alphanumeric, and capped at seven characters", () => {
  assert.equal(sanitizeCallsign("bh-1abcxyz"), "BH1ABCX");
  assert.equal(sanitizeCallsign("ja1 z kq"), "JA1ZKQ");
  assert.equal(isValidCallsign("JA1ZKQ"), true);
  assert.equal(isValidCallsign("JA1-ZKQ"), false);
  assert.equal(isValidCallsign("ABCDEFGH"), false);
});

test("save records preserve a fixed location and swappable antenna id", () => {
  const save = createSave({ callsign: "bh1abc", locationId: "china-beijing-outskirts", antennaId: "none" });
  assert.equal(save.callsign, "BH1ABC");
  assert.equal(save.locationId, "china-beijing-outskirts");
  assert.equal(save.antennaId, "none");
  assert.equal(save.credits, 0);
});

test("only three normalized save slots are persisted", () => {
  const storage = storageStub();
  const saves = Array.from({ length: 4 }, (_, index) => createSave({ callsign: `SIM${index}`, locationId: "japan-tokyo-kanto" }));
  persistSaves(saves, storage);
  assert.equal(loadSaves(storage).length, 3);
});
