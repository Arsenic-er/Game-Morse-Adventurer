import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  createSave, touchSaveWorldCalendar,
} from "../src/game/saveStore.js";
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
    createSave({ callsign: "K1CLOCK", locationId: "usa-boston-new-england" }),
    "2026-05-01T00:00:00.000Z",
  );
  assert.equal(touchSaveWorldCalendar(save, "2026-04-30T23:57:00.000Z"), save);
});

test("save heartbeat persists rollback protection and clears it only after catch-up", () => {
  const baseline = touchSaveWorldCalendar(
    createSave({ callsign: "DL1TIME", locationId: "europe-berlin-brandenburg" }),
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

test("renderer touches only an active played save on the shared heartbeat contract", () => {
  const source = readFileSync(new URL("../src/App.jsx", import.meta.url), "utf8");
  assert.match(source, /touchSaveWorldCalendar/);
  assert.match(source, /WORLD_CALENDAR_HEARTBEAT_MS/);
  assert.match(source, /\["home",\s*"station",\s*"practice"\]\.includes\(screen\)/);
  assert.match(source, /window\.setInterval\([^,]+,\s*WORLD_CALENDAR_HEARTBEAT_MS\)/s);
});
