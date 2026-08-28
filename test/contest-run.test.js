import assert from "node:assert/strict";
import test from "node:test";

import {
  CONTEST_MODES, CONTEST_PHASES, abandonContestRun, contestExchangeText,
  createContestRun, finishContestRun, normalizeContestRun, retryContestRun,
  scoreContestRun, selectContestMode, submitContestText, tickContestRun,
} from "../src/game/contestRun.js";

const ISO = "2026-08-28T03:00:00.000Z";
const later = (seconds) => new Date(Date.parse(ISO) + seconds * 1000).toISOString();
const safe = Object.freeze({ safeToCommit: true });

function contact(run, mode, seconds) {
  let next = selectContestMode(run, mode);
  const station = next.candidates.find(({ personId }) => !next.contacts.some((entry) => entry.personId === personId));
  assert.ok(station, `${mode} needs an unworked station`);
  next = submitContestText(next, station.callsign, safe, later(seconds));
  assert.equal(next.phase, CONTEST_PHASES.EXCHANGE);
  next = submitContestText(next, contestExchangeText(next.selectedStation, next.playerCallsign, next.nextSerial), safe, later(seconds + 1));
  assert.equal(next.contacts.length, run.contacts.length + 1);
  return next;
}

function completeSix(run) {
  let next = run;
  for (let index = 0; index < 3; index += 1) next = contact(next, CONTEST_MODES.RUN, 10 + index * 4);
  for (let index = 0; index < 3; index += 1) next = contact(next, CONTEST_MODES.SP, 30 + index * 4);
  return next;
}

test("contest freezes a fictional controller and deterministic RUN and S&P station pools", () => {
  const first = createContestRun({ playerCallsign: "BH1ABC", seed: "story-10", startedAt: ISO });
  const second = createContestRun({ playerCallsign: "BH1ABC", seed: "story-10", startedAt: ISO });
  assert.deepEqual(first, second);
  assert.equal(first.controller.callsign, "SIM0CT");
  assert.equal(first.controller.npcId, "chapter10-contest-controller");
  assert.equal(first.simulation, "fictional-five-minute-contest");
  assert.equal(first.stationPool.length, 10);
  assert.equal(new Set(first.stationPool.map(({ personId }) => personId)).size, 10);
  assert.ok(first.stationPool.every(({ isFictional, regionCode, powerWatts }) => isFictional && /^[A-Z]{2}$/.test(regionCode) && powerWatts >= 1 && powerWatts <= 1000));
  const running = selectContestMode(first, CONTEST_MODES.RUN);
  assert.equal(running.phase, CONTEST_PHASES.RUN_PILEUP);
  assert.ok(running.candidates.length >= 2 && running.candidates.length <= 3);
  const hunting = selectContestMode(first, CONTEST_MODES.SP);
  assert.equal(hunting.phase, CONTEST_PHASES.SP_POOL);
  assert.ok(hunting.candidates.length >= 3);
});

test("hard exchange fields, serial progression, and duplicate identities fail closed", () => {
  let run = selectContestMode(createContestRun({ playerCallsign: "BH1ABC", seed: "fields", startedAt: ISO }), CONTEST_MODES.RUN);
  const station = run.candidates[0];
  run = submitContestText(run, station.callsign, safe, later(1));
  const canonical = contestExchangeText(station, run.playerCallsign, 1);
  for (const bad of [
    canonical.replace(station.callsign, "SIM0XX"), canonical.replace("RST 599", "RST 579"),
    canonical.replace("NR 001", "NR 002"), canonical.replace(`REGION ${station.regionCode}`, "REGION ZZ"),
    canonical.replace(`PWR ${station.powerWatts}`, "PWR 999"), `${canonical} REGION ${station.regionCode}`,
  ]) {
    const rejected = submitContestText(run, bad, safe, later(2));
    assert.equal(rejected.contacts.length, 0);
    assert.ok(rejected.bustedCalls >= run.bustedCalls);
  }
  run = submitContestText(run, canonical, safe, later(3));
  assert.equal(run.contacts[0].serialNumber, 1);
  assert.equal(run.nextSerial, 2);
  const duplicateAttempt = submitContestText(selectContestMode(run, CONTEST_MODES.SP), station.callsign, safe, later(4));
  assert.equal(duplicateAttempt.contacts.length, 1);
  assert.equal(duplicateAttempt.duplicateAttempts, 1);
});

test("exact AGN and QRS preserve the selected station when semantic safety cannot classify procedure-only text", () => {
  let run = selectContestMode(createContestRun({ playerCallsign: "BH1ABC", seed: "recovery", startedAt: ISO }), CONTEST_MODES.RUN);
  const station = run.candidates[0];
  const interrupted = submitContestText(run, contestExchangeText(station, run.playerCallsign, 1), { safeToCommit: false }, later(1));
  assert.equal(interrupted.interruptions, 1);
  assert.equal(interrupted.contacts.length, 0);
  run = submitContestText(interrupted, station.callsign, { safeToCommit: false }, later(2));
  const repeated = submitContestText(run, "AGN K", { safeToCommit: false }, later(3));
  assert.equal(repeated.repeatRequests, 1);
  assert.equal(repeated.selectedStation.personId, station.personId);
  const slowed = submitContestText(repeated, "QRS K", { safeToCommit: false }, later(4));
  assert.equal(slowed.repeatRequests, 2);
  assert.ok(slowed.replyWpm < repeated.replyWpm);
  const completed = submitContestText(
    slowed,
    contestExchangeText(station, slowed.playerCallsign, slowed.nextSerial),
    safe,
    later(5),
  );
  assert.equal(completed.contacts.length, 1);
  assert.equal(completed.cleanExchanges, 0);
});

test("contest completion requires six unique contacts, both modes, and three regions", () => {
  const run = completeSix(createContestRun({ playerCallsign: "BH1ABC", seed: "story-10", startedAt: ISO }));
  const result = finishContestRun(run, later(60));
  assert.equal(result.phase, CONTEST_PHASES.COMPLETED);
  const score = scoreContestRun(result);
  assert.equal(score.facts.bothModes, true);
  assert.equal(score.facts.validContacts, 6);
  assert.ok(score.facts.uniqueRegions >= 3);
  assert.equal(new Set(result.contacts.map(({ personId }) => personId)).size, 6);
  assert.ok(["complete", "silver", "gold"].includes(score.grade));
});

test("score follows the frozen formula and gold requires a clean 1100-point run", () => {
  let run = createContestRun({ playerCallsign: "BH1ABC", seed: "gold-reachable", startedAt: ISO });
  for (let index = 0; index < 4; index += 1) run = contact(run, CONTEST_MODES.RUN, 10 + index * 3);
  for (let index = 0; index < 4; index += 1) run = contact(run, CONTEST_MODES.SP, 30 + index * 3);
  run = finishContestRun(run, later(70));
  const result = scoreContestRun(run);
  assert.equal(result.score, result.facts.validContacts * 100 + result.facts.uniqueRegions * 40 + 150 + Math.min(result.facts.cleanExchanges * 20, 120));
  assert.ok(result.score >= 1100);
  assert.equal(result.grade, "gold");
  const penalized = scoreContestRun({ ...run, bustedCalls: 1 });
  assert.notEqual(penalized.grade, "gold");
});

test("five-minute monotonic timer pauses and then completes or fails at the boundary", () => {
  const fresh = createContestRun({ playerCallsign: "BH1ABC", seed: "timer", startedAt: ISO });
  assert.equal(tickContestRun(fresh, { seconds: 100, paused: true }, later(100)), fresh);
  const failed = tickContestRun(fresh, { seconds: 300 }, later(300));
  assert.equal(failed.phase, CONTEST_PHASES.FAILED);
  assert.equal(failed.failureReason, "TIMED_OUT");
  const eligible = completeSix(createContestRun({ playerCallsign: "BH1ABC", seed: "timer-complete", startedAt: ISO }));
  const completed = tickContestRun(eligible, { seconds: 300 }, later(300));
  assert.equal(completed.phase, CONTEST_PHASES.COMPLETED);
});

test("ten-contact cap, retry, abandon, and hostile normalization stay bounded", () => {
  let run = createContestRun({ playerCallsign: "BH1ABC", seed: "cap", startedAt: ISO });
  for (let index = 0; index < 5; index += 1) run = contact(run, CONTEST_MODES.RUN, 10 + index * 3);
  for (let index = 0; index < 5; index += 1) run = contact(run, CONTEST_MODES.SP, 30 + index * 3);
  assert.equal(run.contacts.length, 10);
  assert.equal(run.phase, CONTEST_PHASES.COMPLETED);
  const abandoned = abandonContestRun(createContestRun({ playerCallsign: "BH1ABC", seed: "retry", startedAt: ISO }), later(2));
  assert.equal(abandoned.phase, CONTEST_PHASES.ABANDONED);
  const retried = retryContestRun(abandoned, later(3));
  assert.equal(retried.retryCount, 1);
  assert.deepEqual(retried.stationPool, abandoned.stationPool);
  const huge = { ...run, contacts: Array.from({ length: 10_000 }, (_, index) => ({ ...run.contacts[0], contactId: `bad-${index}` })) };
  assert.equal(normalizeContestRun(huge), null);
  assert.equal(normalizeContestRun({ ...run, contacts: Object.assign([], { 0: run.contacts[0], length: 2 }) }), null);
});
