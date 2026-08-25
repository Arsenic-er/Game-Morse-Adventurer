import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  createSave, touchSaveWorldCalendar,
} from "../src/game/saveStore.js";
import {
  isWorldCalendarGameplayActive, touchActiveWorldCalendarSaves,
} from "../src/game/worldCalendarHeartbeat.js";
import {
  WORLD_CALENDAR_HEARTBEAT_MS,
} from "../src/game/worldCalendar.js";

test("world calendar heartbeat is fixed at one minute", () => {
  assert.equal(WORLD_CALENDAR_HEARTBEAT_MS, 60_000);
});

test("touching a save advances trusted time without changing player activity time", () => {
  const save = createSave({ callsign: "JA1TIME", locationId: "japan-tokyo-kanto" });
  const touched = touchSaveWorldCalendar(save, "2026-05-01T00:00:00.000Z");
  assert.notEqual(touched, save);
  assert.equal(touched.worldCalendarState.lastTrustedAt, "2026-05-01T00:00:00.000Z");
  assert.equal(touched.worldCalendarState.rollbackGuardUntil, null);
  assert.equal(touched.updatedAt, save.updatedAt);
});

test("a no-op heartbeat preserves save identity and avoids redundant storage writes", () => {
  const save = touchSaveWorldCalendar(
    createSave({ callsign: "K1CLOCK", locationId: "usa-new-england" }),
    "2026-05-01T00:00:00.000Z",
  );
  assert.equal(touchSaveWorldCalendar(save, "2026-04-30T23:57:00.000Z"), save);
});

test("save heartbeat persists rollback protection and clears it only after catch-up", () => {
  const baseline = touchSaveWorldCalendar(
    createSave({ callsign: "DL1TIME", locationId: "europe-rhine-valley" }),
    "2026-05-05T12:00:00.000Z",
  );
  const rolledBack = touchSaveWorldCalendar(baseline, "2026-05-05T10:00:00.000Z");
  assert.equal(rolledBack.worldCalendarState.lastTrustedAt, "2026-05-05T12:00:00.000Z");
  assert.equal(rolledBack.worldCalendarState.rollbackGuardUntil, "2026-05-05T12:00:00.000Z");
  assert.equal(touchSaveWorldCalendar(rolledBack, "2026-05-05T11:59:00.000Z"), rolledBack);

  const recovered = touchSaveWorldCalendar(rolledBack, "2026-05-05T12:00:00.000Z");
  assert.equal(recovered.worldCalendarState.rollbackGuardUntil, null);
  assert.equal(recovered.worldCalendarState.lastTrustedAt, "2026-05-05T12:00:00.000Z");
});

test("standalone practice never inherits a previously active save heartbeat", () => {
  assert.equal(isWorldCalendarGameplayActive({ activeSaveId: "save-1", screen: "home", practiceReturnScreen: "start" }), true);
  assert.equal(isWorldCalendarGameplayActive({ activeSaveId: "save-1", screen: "station", practiceReturnScreen: "start" }), true);
  assert.equal(isWorldCalendarGameplayActive({ activeSaveId: "save-1", screen: "practice", practiceReturnScreen: "home" }), true);
  assert.equal(isWorldCalendarGameplayActive({ activeSaveId: "save-1", screen: "practice", practiceReturnScreen: "start" }), false);
  assert.equal(isWorldCalendarGameplayActive({ activeSaveId: null, screen: "home", practiceReturnScreen: "home" }), false);
});

test("active-save touch isolates the selected save and reports no-op ticks", () => {
  const first = createSave({ callsign: "JA1ONE", locationId: "japan-tokyo-kanto" });
  const second = createSave({ callsign: "K1TWO", locationId: "usa-new-england" });
  const touched = touchActiveWorldCalendarSaves([first, second], second.id, "2026-05-01T00:00:00.000Z");
  assert.equal(touched.changed, true);
  assert.equal(touched.saves[0], first);
  assert.equal(touched.saves[1].worldCalendarState.lastTrustedAt, "2026-05-01T00:00:00.000Z");

  const noOp = touchActiveWorldCalendarSaves(touched.saves, second.id, "2026-04-30T23:57:00.000Z");
  assert.equal(noOp.changed, false);
  assert.equal(noOp.saves, touched.saves);
});

test("save heartbeat uses non-Tokyo station zones at a local-year boundary", () => {
  for (const locationId of ["usa-new-england", "europe-rhine-valley"]) {
    const save = createSave({ callsign: locationId.startsWith("usa") ? "K1ZONE" : "DL1ZONE", locationId });
    const poisoned = {
      ...save,
      worldCalendarState: {
        ...save.worldCalendarState,
        annualRecords: [
          { year: 2026, rewardClaimed: true, bestScore: 3, bestGrade: "base" },
          ...Array.from({ length: 20 }, (_, index) => ({
            year: 9980 + index, rewardClaimed: true, bestScore: 7, bestGrade: "gold",
          })),
        ],
      },
    };
    const touched = touchSaveWorldCalendar(poisoned, "2026-12-31T22:30:00.000Z");
    assert.equal(touched.locationId, locationId);
    assert.equal(touched.worldCalendarState.annualRecords.some(({ year }) => year === 2026), true);
  }
});

test("renderer wires heartbeat setup and cleanup to the pure lifecycle helpers", () => {
  const source = readFileSync(new URL("../src/App.jsx", import.meta.url), "utf8");
  assert.match(source, /isWorldCalendarGameplayActive/);
  assert.match(source, /touchActiveWorldCalendarSaves/);
  assert.match(source, /WORLD_CALENDAR_HEARTBEAT_MS/);
  assert.match(source, /window\.setInterval\([^,]+,\s*WORLD_CALENDAR_HEARTBEAT_MS\)/s);
  assert.match(source, /window\.clearInterval\(/);
});
