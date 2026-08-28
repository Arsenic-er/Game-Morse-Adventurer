import assert from "node:assert/strict";
import test from "node:test";

import {
  CONTEST_MODES, contestCqText, contestExchangeText, createContestRun, finishContestRun,
  normalizeContestState, selectContestMode, submitContestText,
} from "../src/game/contestRun.js";
import { settleContestRun, verifiedContestCompletion } from "../src/game/contestSettlement.js";
import { createSave, normalizeSave } from "../src/game/saveStore.js";
import { normalizeStoryContinuationState } from "../src/game/storyContinuationState.js";

const START = "2026-08-28T03:00:00.000Z";
const SETTLE = "2026-08-28T03:04:00.000Z";
const safe = { safeToCommit: true };
const at = (seconds) => new Date(Date.parse(START) + seconds * 1000).toISOString();

export function completedContestRun(seed = "contest-settlement", count = 6) {
  let run = createContestRun({ playerCallsign: "BH1ABC", seed, startedAt: START });
  for (let index = 0; index < count; index += 1) {
    const mode = index < Math.ceil(count / 2) ? CONTEST_MODES.RUN : CONTEST_MODES.SP;
    run = selectContestMode(run, mode);
    if (mode === CONTEST_MODES.RUN) run = submitContestText(run, contestCqText(run.playerCallsign), safe, at(4 + index * 8));
    const station = run.candidates[0];
    run = submitContestText(run, station.callsign, safe, at(5 + index * 8));
    run = submitContestText(run, contestExchangeText(station, run.playerCallsign, run.nextSerial), safe, at(6 + index * 8));
  }
  return run.phase === "COMPLETED" ? run : finishContestRun(run, at(100));
}

function readySave(run = completedContestRun()) {
  const save = createSave({ callsign: "BH1ABC", locationId: "japan-tokyo-kanto" });
  return {
    ...save, money: 700, technologyPoints: 15,
    storyContinuationState: normalizeStoryContinuationState({
      ...save.storyContinuationState,
      chapter10: normalizeContestState({ activeRun: run }),
    }),
  };
}

test("contest settlement atomically writes zero-credit event QSOs, relationships, record, and proof", () => {
  const run = completedContestRun();
  const result = settleContestRun(readySave(run), run, SETTLE);
  assert.equal(result.settled, true);
  assert.equal(result.moneyAwarded, 0);
  assert.equal(result.technologyPointsAwarded, 0);
  assert.equal(result.qsoIds.length, 6);
  assert.equal(result.save.qsoLogs.length, 6);
  assert.ok(result.save.qsoLogs.every(({ eventKind, eventRunId, credits }) => eventKind === "contest" && eventRunId === run.runId && credits === 0));
  assert.equal(new Set(result.save.qsoLogs.map(({ personId }) => personId)).size, 6);
  assert.equal(result.save.operatorRelationships.filter(({ personId }) => run.contacts.some((contact) => contact.personId === personId)).length, 6);
  const chapter = result.save.storyContinuationState.chapter10;
  assert.equal(chapter.activeRun, null);
  assert.deepEqual(chapter.settledRunIds, [run.runId]);
  assert.equal(chapter.records.length, 1);
  assert.deepEqual(chapter.records[0].contactQsoIds, result.qsoIds);
  assert.equal(chapter.records[0].validContacts, 6);
  assert.equal(chapter.personalBest.runId, run.runId);
  const active = { acceptedAt: "2026-08-28T02:59:00.000Z", baselineContestRunIds: [] };
  assert.equal(verifiedContestCompletion(result.save, active), true);
  const duplicate = settleContestRun(result.save, run, "2026-08-28T03:05:00.000Z");
  assert.equal(duplicate.reason, "ALREADY_SETTLED");
  assert.strictEqual(duplicate.save, result.save);
});

test("contest settlement rejects incomplete, duplicate-person, mismatched, forged, and early runs", () => {
  const run = completedContestRun("contest-hostile");
  const save = readySave(run);
  for (const candidate of [
    { ...run, phase: "MODE_SELECT", completedAt: null },
    { ...run, runId: "contest:forged" },
    { ...run, contacts: [...run.contacts.slice(0, 5), run.contacts[0]] },
    Object.create(run),
  ]) assert.equal(settleContestRun(save, candidate, SETTLE).settled, false);
  const missing = { ...save, storyContinuationState: normalizeStoryContinuationState({ ...save.storyContinuationState, chapter10: normalizeContestState({}) }) };
  assert.equal(settleContestRun(missing, run, SETTLE).reason, "RUN_STATE_MISMATCH");
  assert.equal(settleContestRun(save, run, "2026-08-28T03:01:00.000Z").reason, "INVALID_SETTLEMENT_TIME");
  const settled = settleContestRun(save, run, SETTLE).save;
  const active = { acceptedAt: "2026-08-28T02:59:00.000Z", baselineContestRunIds: [] };
  for (const forged of [
    { ...settled, qsoLogs: settled.qsoLogs.slice(1) },
    { ...settled, operatorRelationships: settled.operatorRelationships.slice(1) },
    { ...settled, storyContinuationState: normalizeStoryContinuationState({ ...settled.storyContinuationState, chapter10: normalizeContestState({ ...settled.storyContinuationState.chapter10, records: [] }) }) },
    { ...settled, storyContinuationState: normalizeStoryContinuationState({ ...settled.storyContinuationState, chapter10: normalizeContestState({ ...settled.storyContinuationState.chapter10, settledRunIds: [] }) }) },
  ]) assert.equal(verifiedContestCompletion(forged, active), false);
});

test("contest personal best improves without replay reward and survives two save normalizations", () => {
  const baseRun = completedContestRun("contest-best-base", 6);
  const base = settleContestRun(readySave(baseRun), baseRun, SETTLE);
  assert.equal(base.settled, true);
  const strongerRun = completedContestRun("contest-best-gold", 8);
  const active = {
    ...base.save,
    storyContinuationState: normalizeStoryContinuationState({
      ...base.save.storyContinuationState,
      chapter10: normalizeContestState({ ...base.save.storyContinuationState.chapter10, activeRun: strongerRun }),
    }),
  };
  const improved = settleContestRun(active, strongerRun, "2026-08-28T03:06:00.000Z");
  assert.equal(improved.settled, true);
  assert.ok(improved.save.storyContinuationState.chapter10.personalBest.score >= base.save.storyContinuationState.chapter10.personalBest.score);
  assert.equal(improved.save.money, 700);
  assert.equal(improved.save.technologyPoints, 15);
  const once = normalizeSave(JSON.parse(JSON.stringify(improved.save)));
  const twice = normalizeSave(JSON.parse(JSON.stringify(once)));
  assert.deepEqual(twice, once);
  assert.equal(twice.money, 700);
  assert.equal(twice.technologyPoints, 15);
  assert.equal(twice.qsoLogs.length, 14);
  const retainedBest = normalizeContestState({
    ...twice.storyContinuationState.chapter10,
    records: [],
  });
  assert.equal(retainedBest.personalBest.runId, strongerRun.runId);
});
