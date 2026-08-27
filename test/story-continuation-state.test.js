import assert from "node:assert/strict";
import test from "node:test";

import {
  STORY_CONTINUATION_STATE_VERSION,
  emptyStoryContinuationState,
  normalizeStoryContinuationState,
} from "../src/game/storyContinuationState.js";

const minute = (index) => new Date(Date.UTC(2026, 7, 28, 0, index)).toISOString();
const records = (count, prefix = "case") => Array.from({ length: count }, (_, index) => ({
  id: `${prefix}:${String(index).padStart(3, "0")}`,
  completedAt: minute(index),
}));
const ids = (count, prefix = "run") => Array.from(
  { length: count },
  (_, index) => `${prefix}:${String(index).padStart(3, "0")}`,
);

test("empty continuation state has fixed chapter seven through ten shape", () => {
  const state = emptyStoryContinuationState();

  assert.equal(STORY_CONTINUATION_STATE_VERSION, 1);
  assert.deepEqual(state, {
    version: 1,
    chapter07: { activeRun: null, cases: [], settledRunIds: [] },
    chapter08: { activeRun: null, receipts: [], settledRunIds: [], taskTreeUnlocked: false },
    chapter09: { activeRun: null, packets: [], settledRunIds: [], toolUnlocked: false },
    chapter10: { activeRun: null, records: [], settledRunIds: [], taskTreeUnlocked: false },
  });
  assert.equal(Object.isFrozen(state), true);
  assert.equal(Object.isFrozen(state.chapter07.cases), true);
});

test("continuation ledgers retain bounded ordered tails and normalize twice identically", () => {
  const state = normalizeStoryContinuationState({
    chapter07: { cases: records(45), settledRunIds: ids(105) },
    chapter08: { receipts: records(85, "receipt"), settledRunIds: ids(101, "service"), taskTreeUnlocked: true },
    chapter09: { packets: records(81, "packet"), settledRunIds: ids(102, "relay"), toolUnlocked: true },
    chapter10: { records: records(41, "contest"), settledRunIds: ids(103, "contest-run"), taskTreeUnlocked: true },
  });

  assert.equal(state.chapter07.cases.length, 40);
  assert.equal(state.chapter07.cases[0].id, "case:005");
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
  const duplicate = [records(1)[0], records(1)[0]];
  const reversed = records(2).reverse();

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
    cases: [{ id: "case:001", completedAt: minute(1), freeText: "drop me" }],
    settledRunIds: ["run:001"],
    freeText: "drop me",
  };

  const state = normalizeStoryContinuationState(source);

  assert.deepEqual(state.chapter08, emptyStoryContinuationState().chapter08);
  assert.deepEqual(state.chapter07, {
    activeRun: null,
    cases: [{ id: "case:001", completedAt: minute(1) }],
    settledRunIds: ["run:001"],
  });
  assert.equal(JSON.stringify(state).includes("freeText"), false);
});
