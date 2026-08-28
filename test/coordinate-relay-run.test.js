import assert from "node:assert/strict";
import test from "node:test";

import {
  COORDINATE_RELAY_PHASES, abandonCoordinateRelayRun, beginCoordinateRelayRun,
  computeCoordinatePacketCheck, coordinatePacketText, createCoordinateRelayRun,
  receiveCoordinatePacket, receiveRelayConfirmation, retryCoordinateRelayRun,
  submitCoordinateRelayText, tickCoordinateRelayRun,
} from "../src/game/coordinateRelayRun.js";

const T0 = "2026-08-28T02:00:00.000Z";
const safe = { safeToCommit: true };

function readback(packet) { return coordinatePacketText(packet); }
function readyRun(seed = "story-09") {
  let run = beginCoordinateRelayRun(createCoordinateRelayRun({ playerCallsign: "BH1ABC", seed, startedAt: T0 }));
  return receiveCoordinatePacket(run, "2026-08-28T02:00:10.000Z");
}

test("coordinate packets freeze bounded Pixel Grid, UTC, people, and a computed mod-97 check", () => {
  const first = createCoordinateRelayRun({ playerCallsign: "BH1ABC", seed: "story-09", startedAt: T0 });
  const second = createCoordinateRelayRun({ playerCallsign: "BH1ABC", seed: "story-09", startedAt: T0 });
  assert.deepEqual(first, second);
  assert.match(first.packet.packetId, /^\d{3}$/);
  assert.match(first.packet.grid, /^PX-\d{4}-\d{4}$/);
  assert.match(first.packet.utc, /^(?:[01]\d|2[0-3])[0-5]\dZ$/);
  assert.ok(first.packet.people >= 0 && first.packet.people <= 99);
  assert.equal(first.packet.check, computeCoordinatePacketCheck(first.packet));
  const [east, north] = first.packet.grid.slice(3).split("-");
  assert.match(coordinatePacketText(first.packet), new RegExp(`GRID PX ${east} ${north} .* CHECK ${String(first.packet.check).padStart(2, "0")}$`));
  assert.doesNotMatch(coordinatePacketText(first.packet), /PX-\d{4}-\d{4}/);
  assert.equal(first.simulation, "fictional-pixel-grid");
});

test("readback and relay require every deterministic hard field", () => {
  const run = readyRun();
  const packet = run.packet;
  const correct = submitCoordinateRelayText(run, readback(packet), safe, "2026-08-28T02:00:20.000Z");
  assert.equal(correct.phase, COORDINATE_RELAY_PHASES.RELAY_PACKET);
  for (const [field, replacement, reason] of [
    [`TIME ${packet.utc}`, "TIME 2400Z", "TIME_MISMATCH"],
    [coordinatePacketText(packet).match(/GRID PX \d{4} \d{4}/)[0], "GRID PX 9999 9999", "GRID_MISMATCH"],
    [`PEOPLE ${String(packet.people).padStart(2, "0")}`, "PEOPLE 99", "PEOPLE_MISMATCH"],
    [`CHECK ${String(packet.check).padStart(2, "0")}`, `CHECK ${String((packet.check + 1) % 97).padStart(2, "0")}`, "CHECK_MISMATCH"],
  ]) {
    const failed = submitCoordinateRelayText(run, readback(packet).replace(field, replacement), safe, "2026-08-28T02:00:20.000Z");
    assert.equal(failed.phase, COORDINATE_RELAY_PHASES.FIELD_CORRECTION);
    assert.equal(failed.lastError, reason);
  }
  const relayed = submitCoordinateRelayText(correct, readback(packet), safe, "2026-08-28T02:00:30.000Z");
  assert.equal(relayed.phase, COORDINATE_RELAY_PHASES.RELAY_CONFIRMATION);
  const completed = receiveRelayConfirmation(relayed, `QSL MSG ${packet.packetId} CHECK ${String(packet.check).padStart(2, "0")} K`, "2026-08-28T02:00:40.000Z");
  assert.equal(completed.phase, COORDINATE_RELAY_PHASES.COMPLETED);
});

test("parser rejects reordered, duplicate, conflicting, oversized, and semantically unsafe readbacks", () => {
  const run = readyRun("hostile");
  const packet = run.packet;
  for (const input of [
    `TIME ${packet.utc} MSG ${packet.packetId} GRID PX 9999 9999 PEOPLE ${packet.people} CHECK ${packet.check}`,
    `${readback(packet)} MSG ${packet.packetId}`,
    `${readback(packet)} CHECK ${packet.check}`,
    `${readback(packet)} ${"X".repeat(300)}`,
  ]) assert.equal(submitCoordinateRelayText(run, input, safe, "2026-08-28T02:00:20.000Z").phase, COORDINATE_RELAY_PHASES.FIELD_CORRECTION);
  assert.equal(submitCoordinateRelayText(run, readback(packet), { safeToCommit: false }, "2026-08-28T02:00:20.000Z").lastError, "SEMANTIC_UNSAFE");
  let accessorReads = 0;
  const accessor = {};
  Object.defineProperty(accessor, "safeToCommit", { get() { accessorReads += 1; return true; } });
  for (const semantic of [null, Object.create({ safeToCommit: true }), accessor]) {
    const rejected = submitCoordinateRelayText(run, readback(packet), semantic, "2026-08-28T02:00:20.000Z");
    assert.equal(rejected.phase, COORDINATE_RELAY_PHASES.FIELD_CORRECTION);
    assert.equal(rejected.lastError, "SEMANTIC_UNSAFE");
  }
  assert.equal(accessorReads, 0);
});

test("exact AGN and QRS preserve the packet when semantic safety cannot classify procedure-only text", () => {
  let run = readyRun("recovery");
  const packet = run.packet;
  const agn = submitCoordinateRelayText(run, "AGN K", { safeToCommit: false }, "2026-08-28T02:00:20.000Z");
  assert.equal(agn.phase, COORDINATE_RELAY_PHASES.RECEIVE_PACKET);
  assert.deepEqual(agn.packet, packet);
  run = receiveCoordinatePacket(agn, "2026-08-28T02:00:21.000Z");
  const qrs = submitCoordinateRelayText(run, "QRS K", { safeToCommit: false }, "2026-08-28T02:00:22.000Z");
  assert.equal(qrs.replyWpm, run.replyWpm - 3);
  run = receiveCoordinatePacket(qrs, "2026-08-28T02:00:23.000Z");
  for (let index = 0; index < 3; index += 1) {
    run = submitCoordinateRelayText(run, "MSG 999 GRID PX 9999 9999 TIME 0000Z PEOPLE 99 CHECK 99", safe, `2026-08-28T02:00:${30 + index}.000Z`);
    if (index < 2) run = receiveCoordinatePacket(run, `2026-08-28T02:00:${35 + index}.000Z`);
  }
  assert.equal(run.phase, COORDINATE_RELAY_PHASES.FAILED);
  const retried = retryCoordinateRelayRun(run, "2026-08-28T02:01:00.000Z");
  assert.equal(retried.phase, COORDINATE_RELAY_PHASES.RECEIVE_PACKET);
  assert.deepEqual(retried.packet, packet);
  assert.notEqual(retried.runId, run.runId);
});

test("timer pause, timeout, abandon, and hostile normalization fail closed", async () => {
  const { normalizeCoordinateRelayRun, normalizeCoordinateRelayState } = await import("../src/game/coordinateRelayRun.js");
  const run = readyRun("clock");
  assert.equal(tickCoordinateRelayRun(run, { seconds: 500, paused: true }, "2026-08-28T02:08:20.000Z"), run);
  const timed = tickCoordinateRelayRun(run, { seconds: 600 }, "2026-08-28T02:10:00.000Z");
  assert.equal(timed.phase, COORDINATE_RELAY_PHASES.FAILED);
  assert.equal(timed.failureReason, "TIMED_OUT");
  assert.equal(abandonCoordinateRelayRun(run, "2026-08-28T02:00:30.000Z").phase, COORDINATE_RELAY_PHASES.ABANDONED);
  assert.equal(normalizeCoordinateRelayRun({ ...run, packet: { ...run.packet, check: 96 - run.packet.check } }), null);
  assert.deepEqual(normalizeCoordinateRelayState(JSON.parse(JSON.stringify(normalizeCoordinateRelayState({ activeRun: run })))), normalizeCoordinateRelayState({ activeRun: run }));
  assert.equal(normalizeCoordinateRelayState({ packets: new Array(80) }).packets.length, 0);
});
