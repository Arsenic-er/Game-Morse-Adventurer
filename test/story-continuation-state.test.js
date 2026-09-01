import assert from "node:assert/strict";
import test from "node:test";

import {
  STORY_CONTINUATION_STATE_VERSION,
  emptyStoryContinuationState,
  normalizeStoryContinuationState,
} from "../src/game/storyContinuationState.js";
import { computeCoordinatePacketCheck } from "../src/game/coordinateRelayRun.js";
import { emptyListeningState } from "../src/game/listeningRun.js";
import { emptyStormRelayState } from "../src/game/stormRelayRun.js";
import { emptyNightOperationsState } from "../src/game/nightOperationsRun.js";
import { emptyFinalPromiseState } from "../src/game/finalPromiseRun.js";
import { emptyFirstPageState } from "../src/game/firstPageState.js";
import {
  emptyOpenStationState,
  normalizeOpenStationState,
} from "../src/game/openStationState.js";

const minute = (index) => new Date(Date.UTC(2026, 7, 28, 0, index)).toISOString();
const records = (count, prefix = "case") => Array.from({ length: count }, (_, index) => ({
  id: `${prefix}:${String(index).padStart(3, "0")}`,
  completedAt: minute(index),
}));
const ids = (count, prefix = "run") => Array.from(
  { length: count },
  (_, index) => `${prefix}:${String(index).padStart(3, "0")}`,
);
const qslCases = (count) => Array.from({ length: count }, (_, index) => ({
  id: `qsl-case:${String(index).padStart(3, "0")}`,
  runId: `qsl-story:${String(index).padStart(3, "0")}`,
  sourceQslId: "qsl-hill-1",
  qsoId: `qsl-story-qso:${String(index).padStart(3, "0")}`,
  personId: "person:sora",
  stationId: "station:sim6jp",
  initialChoice: "believe",
  finalChoice: "request-review",
  completedAt: minute(index),
}));
const serviceReceipts = (count) => Array.from({ length: count }, (_, index) => ({
  id: `service-receipt:${String(index).padStart(3, "0")}`,
  runId: `service-net:${String(Math.floor(index / 3)).padStart(3, "0")}`,
  qsoId: `service-net-qso:${String(Math.floor(index / 3)).padStart(3, "0")}`,
  messageId: String(100 + index).padStart(3, "0"),
  priority: (index % 3) + 1,
  sequence: index % 3,
  people: index % 100,
  item: ["WATER", "POWER", "MEDKIT", "SHELTER"][index % 4],
  quantity: (index * 3) % 100,
  acknowledgedAt: minute(index),
  completedAt: minute(index),
}));
const coordinatePackets = (count) => Array.from({ length: count }, (_, index) => {
  const packet = { packetId: String(index + 1).padStart(3, "0"), grid: `PX-${String(index).padStart(4, "0")}-${String(index + 1).padStart(4, "0")}`, utc: `${String(index % 24).padStart(2, "0")}${String(index % 60).padStart(2, "0")}Z`, people: index % 100 };
  return {
    id: `coordinate-packet:${String(index).padStart(3, "0")}`, runId: `coordinate-relay:${String(index).padStart(3, "0")}`,
    sourceQsoId: `coordinate-source-qso:${String(index).padStart(3, "0")}`, relayQsoId: `coordinate-relay-qso:${String(index).padStart(3, "0")}`,
    packet: { ...packet, check: computeCoordinatePacketCheck(packet) }, readbackAttempts: 1,
    sourcePersonId: "person:procedural:chapter09-source", sourceStationId: "station:procedural:chapter09-source",
    relayPersonId: "person:procedural:chapter09-relay", relayStationId: "station:procedural:chapter09-relay",
    sourceCompletedAt: minute(index), completedAt: minute(index),
  };
});
const contestRecords = (count) => Array.from({ length: count }, (_, index) => {
  const contactQsoIds = Array.from({ length: 6 }, (_, contact) => `contest-qso:${String(index).padStart(3, "0")}:${contact + 1}`);
  return {
    id: `contest-record:${String(index).padStart(3, "0")}`,
    runId: `contest:${String(index).padStart(3, "0")}`,
    score: 990,
    grade: "silver",
    validContacts: 6,
    uniqueRegions: 3,
    runContacts: 3,
    spContacts: 3,
    repeatRequests: 0,
    bustedCalls: 0,
    interruptions: 0,
    contactQsoIds,
    contacts: contactQsoIds.map((qsoId, contact) => ({
      qsoId,
      personId: `person:procedural:C${index}N${contact}`,
      stationId: `station:procedural:C${index}N${contact}`,
      npcId: `C${index}N${contact}`,
      callsign: `S${String(index).padStart(2, "0")}${contact}`,
      mode: contact < 3 ? "RUN" : "SP",
      serialNumber: contact + 1,
      regionCode: ["JP", "US", "CN"][contact % 3],
      powerWatts: 10,
      completedAt: minute(index),
    })),
    completedAt: minute(index),
  };
});

test("empty continuation state has fixed chapter seven through fifteen shape", () => {
  const state = emptyStoryContinuationState();

  assert.equal(STORY_CONTINUATION_STATE_VERSION, 2);
  assert.equal(state.version, 2);
  assert.deepEqual(state.chapter07, { activeRun: null, cases: [], settledRunIds: [], peopleTaskTreeUnlocked: false });
  assert.deepEqual(state.chapter08, { activeRun: null, receipts: [], settledRunIds: [], taskTreeUnlocked: false });
  assert.deepEqual(state.chapter09, { activeRun: null, packets: [], settledRunIds: [], toolUnlocked: false });
  assert.deepEqual(state.chapter10, { activeRun: null, records: [], settledRunIds: [], personalBest: null, taskTreeUnlocked: false });
  assert.deepEqual(state.chapter11, emptyListeningState());
  assert.deepEqual(state.chapter12, emptyStormRelayState());
  assert.deepEqual(state.chapter13, emptyNightOperationsState());
  assert.deepEqual(state.chapter14, emptyFinalPromiseState());
  assert.deepEqual(state.chapter15, emptyFirstPageState());
  assert.deepEqual(state.openStation, emptyOpenStationState());
  assert.equal(Object.isFrozen(state), true);
  assert.equal(Object.isFrozen(state.chapter07.cases), true);
  assert.equal(Object.isFrozen(state.chapter15.settlementProofs), true);
});

test("open station state fails closed when an own-property descriptor traps", () => {
  const hostile = new Proxy({}, {
    getOwnPropertyDescriptor() {
      throw new Error("descriptor trap");
    },
  });

  assert.doesNotThrow(() => normalizeOpenStationState(hostile));
  assert.deepEqual(normalizeOpenStationState(hostile), emptyOpenStationState());
});

test("continuation v2 ignores inherited final chapter state", () => {
  const source = Object.create({
    chapter11: {
      taskTreeUnlocked: true,
      archive: [{ id: "inherited-monitoring-record" }],
    },
    openStation: { unlocked: true, activeGoal: "world-log" },
  });

  const state = normalizeStoryContinuationState(source);

  assert.deepEqual(state.chapter11, emptyListeningState());
  assert.deepEqual(state.openStation, emptyOpenStationState());
});

test("continuation ledgers retain bounded ordered tails and normalize twice identically", () => {
  const state = normalizeStoryContinuationState({
    chapter07: { cases: qslCases(45), settledRunIds: ids(105) },
    chapter08: { receipts: serviceReceipts(85), settledRunIds: ids(101, "service"), taskTreeUnlocked: true },
    chapter09: { packets: coordinatePackets(81), settledRunIds: ids(102, "relay"), toolUnlocked: true },
    chapter10: { records: contestRecords(41), settledRunIds: ids(103, "contest-run"), taskTreeUnlocked: true },
  });

  assert.equal(state.chapter07.cases.length, 40);
  assert.equal(state.chapter07.cases[0].id, "qsl-case:005");
  assert.equal(state.chapter07.settledRunIds.length, 100);
  assert.equal(state.chapter08.receipts.length, 80);
  assert.equal(state.chapter09.packets.length, 80);
  assert.equal(state.chapter10.records.length, 40);
  assert.equal(state.chapter08.taskTreeUnlocked, true);
  assert.equal(state.chapter09.toolUnlocked, true);
  assert.equal(state.chapter10.taskTreeUnlocked, true);
  assert.deepEqual(normalizeStoryContinuationState(JSON.parse(JSON.stringify(state))), state);
});

test("a retained ledger with holes, accessors, duplicates, or reversed chronology fails closed", () => {
  let getterCalls = 0;
  const accessor = records(2);
  Object.defineProperty(accessor, "1", {
    configurable: true,
    enumerable: true,
    get() {
      getterCalls += 1;
      throw new Error("must not read");
    },
  });
  const sparse = records(2);
  delete sparse[0];
  const duplicate = [qslCases(1)[0], qslCases(1)[0]];
  const reversed = qslCases(2).reverse();

  assert.deepEqual(normalizeStoryContinuationState({ chapter07: { cases: accessor } }).chapter07.cases, []);
  assert.equal(getterCalls, 0);
  assert.deepEqual(normalizeStoryContinuationState({ chapter07: { cases: sparse } }).chapter07.cases, []);
  assert.deepEqual(normalizeStoryContinuationState({ chapter07: { cases: duplicate } }).chapter07.cases, []);
  assert.deepEqual(normalizeStoryContinuationState({ chapter07: { cases: reversed } }).chapter07.cases, []);
  assert.deepEqual(normalizeStoryContinuationState({ chapter07: { settledRunIds: ["run:1", "run:1"] } }).chapter07.settledRunIds, []);
});

test("continuation state ignores inherited chapter values and never persists arbitrary fields", () => {
  const source = Object.create({
    chapter08: { receipts: records(1, "inherited"), taskTreeUnlocked: true },
  });
  source.chapter07 = {
    activeRun: { freeText: "do not persist" },
    cases: [{ ...qslCases(2)[1], freeText: "drop me" }],
    settledRunIds: ["run:001"],
    freeText: "drop me",
  };

  const state = normalizeStoryContinuationState(source);

  assert.deepEqual(state.chapter08, emptyStoryContinuationState().chapter08);
  assert.deepEqual(state.chapter07, {
    activeRun: null,
    cases: [qslCases(2)[1]],
    settledRunIds: ["run:001"],
    peopleTaskTreeUnlocked: false,
  });
  assert.equal(JSON.stringify(state).includes("freeText"), false);
});
