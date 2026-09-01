import assert from "node:assert/strict";
import test from "node:test";

import {
  FINAL_PROMISE_PHASES,
  abandonFinalPromiseRun,
  chooseFinalPromiseTone,
  createFinalPromiseRun,
  finalPromiseCallText,
  finalPromiseMessageText,
  normalizeFinalPromiseRun,
  normalizeFinalPromiseState,
  receiveFinalPromiseAccount,
  requestFinalPromiseRepeat,
  retryFinalPromiseRun,
  reviewFinalPromise,
  submitFinalPromiseCall,
  submitFinalPromiseMessage,
  tickFinalPromiseRun,
} from "../src/game/finalPromiseRun.js";
import { createNightOperationsRun } from "../src/game/nightOperationsRun.js";

const START = "2026-08-31T14:00:00.000Z";
const T1 = "2026-08-31T14:01:00.000Z";
const T2 = "2026-08-31T14:02:00.000Z";
const T3 = "2026-08-31T14:03:00.000Z";
const safe = Object.freeze({ safeToCommit: true });

function completedSave() {
  const knownPeople = [
    ["person:sora", "SIM6JP", "fixed-sora"],
    ["person:procedural:chapter08-net-control", "SIM8NC", "chapter08-net-control"],
    ["person:procedural:chapter09-source", "SIM9CR", "chapter09-source"],
    ["person:procedural:chapter09-relay", "SIM9RL", "chapter09-relay"],
    ["person:procedural:chapter12-control", "SIM12CS", "chapter12-control"],
    ["person:procedural:chapter12-relay", "SIM12RL", "chapter12-relay"],
  ];
  const schedule = createNightOperationsRun({
    save: {
      callsign: "BH1ABC",
      operatorRelationships: knownPeople.map(([personId, callsign, operatorProfileId], index) => ({
        personId, callsign, operatorProfileId, encounterCount: 1, completedQsos: 1,
        weakSignalRecoveries: 0, topicCounts: {},
        firstMetAt: new Date(Date.parse(START) - (index + 1) * 60000).toISOString(),
        lastMetAt: new Date(Date.parse(START) - (index + 1) * 60000).toISOString(),
        lastEncounterId: `encounter-${index}`, lastQsoId: `qso-${index}`,
      })),
    },
    seed: "story-13",
    startedAt: "2026-08-31T00:00:00.000Z",
  });
  const nightContacts = schedule.windows.slice(0, 3).map((window, index) => ({
    qsoId: `night-qso:source:${index + 1}`,
    contactId: `night-contact:source:${index + 1}`,
    windowId: window.id,
    personId: window.personId,
    stationId: window.stationId,
    npcId: window.npcId,
    callsign: window.callsign,
    band: window.band,
    propagationGrade: window.propagationGrade,
    completedAt: new Date(Date.parse(schedule.startedAt) + window.opensAtMilliseconds).toISOString(),
  }));
  return {
    callsign: "BH1ABC",
    missionState: { claimedMissionIds: ["story-13"] },
    qslRecords: [{
      version: 1, id: "qsl:expedition:chapter14-source", personId: "person:sora",
      stationId: "station:sim6jp", callsign: "SIM6JP", qsoId: "expedition-qso:source",
      eventRunId: "expedition:source", playerNarrativeKey: "qsl.player.hill-signal",
      operatorNarrativeKey: "qsl.operator.sora-hill-reply", createdAt: "2026-08-27T20:00:00.000Z",
      choice: "believe", confirmedAt: "2026-08-27T20:01:00.000Z",
    }],
    storyContinuationState: {
      chapter07: {
        activeRun: null,
        cases: [{
          id: "qsl-case:chapter07", runId: "qsl-story:chapter07",
          sourceQslId: "qsl:expedition:chapter14-source", qsoId: "qsl-story-qso:chapter07",
          personId: "person:sora", stationId: "station:sim6jp",
          initialChoice: "believe", finalChoice: "request-review",
          completedAt: "2026-08-28T00:00:00.000Z",
        }],
        settledRunIds: ["qsl-story:chapter07"], peopleTaskTreeUnlocked: true,
      },
      chapter11: {
        activeRun: null, completedRuns: [], settledRunIds: ["listening:source"],
        settlementProofs: [], archive: [{
          id: "listening-record:listening:source", runId: "listening:source", playerCallsign: "BH1ABC",
          targetCallsign: "SIM11LS", stationId: "station:chapter11:sim11ls",
          personId: "person:chapter11:silent-listener", observationIds: ["window-1", "window-2", "window-3"],
          callCount: 1, activeMilliseconds: 120000,
          conclusionKey: "chapter11.conclusion.no-reply-after-listening", completedAt: "2026-08-29T00:00:00.000Z",
        }], taskTreeUnlocked: true,
      },
      chapter12: {
        activeRun: null, completedRuns: [], settledRunIds: ["storm-relay:source"], settlementProofs: [],
        archive: [{
          id: "storm-record:storm-relay:source", runId: "storm-relay:source", qsoIds: ["storm-qso:1", "storm-qso:2"],
          playerCallsign: "BH1ABC", controlPersonId: "person:procedural:chapter12-control",
          controlStationId: "station:procedural:chapter12-control", relayPersonId: "person:procedural:chapter12-relay",
          relayStationId: "station:procedural:chapter12-relay", canonicalPacketId: "storm-214-r2", msgId: "214",
          revision: 2, grid: "PX-31", people: 8, item: "WATER", quantity: 6, check: "13",
          completedAt: "2026-08-30T00:00:00.000Z", isFictional: true,
        }], taskTreeUnlocked: true,
      },
      chapter13: {
        activeRun: null, completedRuns: [], settledRunIds: [schedule.runId], settlementProofs: [],
        archive: [{
          id: `night-record:${schedule.runId}`, runId: schedule.runId, playerCallsign: "BH1ABC",
          scheduleSeed: "story-13", knownPersonIds: schedule.knownPersonIds,
          windows: schedule.windows, contacts: nightContacts, completedAt: "2026-08-31T00:07:00.000Z", isFictional: true,
        }], taskTreeUnlocked: true,
      },
    },
  };
}

function fresh(save = completedSave()) {
  return createFinalPromiseRun({ save, playerCallsign: "BH1ABC", seed: "story-14", startedAt: START });
}

function atChoice(run = fresh()) {
  run = reviewFinalPromise(run);
  run = submitFinalPromiseCall(run, finalPromiseCallText(run), safe, T1);
  run = receiveFinalPromiseAccount(run, T2);
  return run;
}

test("Chapter 14 recalls fixed prior facts and accepts each canonical final tone", () => {
  const initial = fresh();
  assert.ok(initial);
  assert.deepEqual(initial.recallKeys, [
    "chapter14.recall.qsl.request-review",
    "chapter14.recall.listening.patient-stop",
    "chapter14.recall.storm.corrected-packet",
    "chapter14.recall.schedule.known-people",
  ]);
  assert.equal(initial.sourceQslId, "qsl:expedition:chapter14-source");
  assert.deepEqual(initial.scheduledPersonIds, [
    "person:procedural:chapter08-net-control", "person:procedural:chapter09-relay",
    "person:procedural:chapter09-source", "person:procedural:chapter12-control",
    "person:procedural:chapter12-relay", "person:sora",
  ]);
  assert.deepEqual(normalizeFinalPromiseRun(initial), initial);
  assert.equal(finalPromiseCallText(initial), "SIM14FP DE BH1ABC K");

  for (const tone of ["brief", "steady", "warm"]) {
    let run = chooseFinalPromiseTone(atChoice(), tone);
    const message = finalPromiseMessageText(run);
    assert.ok(message.includes("BH1ABC"));
    run = submitFinalPromiseMessage(run, message, safe, T3);
    assert.equal(run.phase, FINAL_PROMISE_PHASES.COMPLETED);
    assert.equal(run.summary.tone, tone);
    assert.equal(run.summary.messageKey, `chapter14.message.${tone}`);
    assert.equal("decoded" in run.summary, false);
    assert.equal(JSON.stringify(run).includes(message), false);
  }
});

test("claimed migrated saves use neutral fixed recall keys when optional archives are absent", () => {
  const save = { callsign: "BH1ABC", missionState: { claimedMissionIds: ["story-13"] } };
  const run = fresh(save);
  assert.ok(run);
  assert.deepEqual(run.recallKeys, [
    "chapter14.recall.qsl.neutral",
    "chapter14.recall.listening.neutral",
    "chapter14.recall.storm.neutral",
    "chapter14.recall.schedule.neutral",
  ]);
  assert.equal(run.sourceQslId, null);
  assert.deepEqual(run.scheduledPersonIds, []);
});

test("hard call, tone, message, and semantic fields fail closed", () => {
  const call = reviewFinalPromise(fresh());
  assert.strictEqual(submitFinalPromiseCall(call, "SIM14XX DE BH1ABC K", safe, T1), call);
  assert.strictEqual(submitFinalPromiseCall(call, "SIM14FP DE N0BAD K", safe, T1), call);
  assert.strictEqual(submitFinalPromiseCall(call, finalPromiseCallText(call), null, T1), call);

  const choice = atChoice();
  assert.strictEqual(chooseFinalPromiseTone(choice, "free-text"), choice);
  const message = chooseFinalPromiseTone(choice, "warm");
  assert.strictEqual(submitFinalPromiseMessage(message, "SIM14FP DE BH1ABC CUSTOM PROMISE 73", safe, T3), message);
  assert.strictEqual(submitFinalPromiseMessage(message, finalPromiseMessageText(message), { safeToCommit: false }, T3), message);
});

test("AGN and QRS repeat the same frozen account and retry preserves recalls", () => {
  const choice = atChoice();
  const semanticallyUnclassified = { safeToCommit: false };
  const agn = requestFinalPromiseRepeat(choice, "AGN K", semanticallyUnclassified);
  assert.equal(agn.phase, FINAL_PROMISE_PHASES.ACCOUNT);
  assert.equal(agn.accountKey, choice.accountKey);
  assert.deepEqual(agn.recoveryActions, ["AGN"]);
  const choiceAgain = receiveFinalPromiseAccount(agn, T3);
  const qrs = requestFinalPromiseRepeat(choiceAgain, "QRS K", semanticallyUnclassified);
  assert.equal(qrs.accountWpm, choice.accountWpm - 3);
  assert.equal(qrs.accountKey, choice.accountKey);

  for (const malformed of ["AGN", "AGN K EXTRA", "QRS", "QRS K EXTRA", null]) {
    assert.strictEqual(requestFinalPromiseRepeat(choiceAgain, malformed, safe), choiceAgain);
  }

  const abandoned = abandonFinalPromiseRun(qrs, "2026-08-31T14:04:00.000Z");
  const retry = retryFinalPromiseRun(abandoned, "2026-08-31T15:00:00.000Z");
  assert.equal(retry.phase, FINAL_PROMISE_PHASES.REVIEW);
  assert.equal(retry.retryCount, 1);
  assert.deepEqual(retry.recallKeys, abandoned.recallKeys);
  assert.deepEqual(retry.scheduledPersonIds, abandoned.scheduledPersonIds);
  assert.equal(retry.sourceQslId, abandoned.sourceQslId);
});

test("paused time is free, active timeout fails, and terminal runs do not mutate", () => {
  const run = fresh();
  assert.strictEqual(tickFinalPromiseRun(run, { milliseconds: 599000, paused: true }, T1), run);
  const sampled = tickFinalPromiseRun(run, { milliseconds: 250.4 }, T1);
  assert.equal(sampled.activeMilliseconds, 250);
  const almost = tickFinalPromiseRun(run, { milliseconds: 599000 }, T1);
  assert.equal(almost.activeMilliseconds, 599000);
  const failed = tickFinalPromiseRun(almost, { milliseconds: 1000 }, T2);
  assert.equal(failed.phase, FINAL_PROMISE_PHASES.FAILED);
  assert.equal(failed.failureReason, "TIMED_OUT");
  assert.strictEqual(reviewFinalPromise(failed), failed);
});

test("unclaimed, forged, inherited, and oversized evidence cannot become recall facts", () => {
  assert.equal(createFinalPromiseRun({ save: { callsign: "BH1ABC" }, playerCallsign: "BH1ABC", seed: "x", startedAt: START }), null);
  const forged = completedSave();
  forged.qslRecords[0] = { ...forged.qslRecords[0], personId: "person:attacker" };
  const run = fresh(forged);
  assert.equal(run.sourceQslId, null);
  assert.equal(run.recallKeys[0], "chapter14.recall.qsl.neutral");

  const inheritedMission = Object.create({ claimedMissionIds: ["story-13"] });
  assert.equal(createFinalPromiseRun({ save: { callsign: "BH1ABC", missionState: inheritedMission }, playerCallsign: "BH1ABC", seed: "x", startedAt: START }), null);

  let reads = 0;
  const huge = new Proxy(Array.from({ length: 10000 }, () => "story-13"), {
    get(target, property, receiver) { if (/^\d+$/u.test(String(property))) reads += 1; return Reflect.get(target, property, receiver); },
  });
  assert.equal(createFinalPromiseRun({ save: { callsign: "BH1ABC", missionState: { claimedMissionIds: huge } }, playerCallsign: "BH1ABC", seed: "x", startedAt: START }), null);
  assert.equal(reads <= 100, true);
});

test("normalization is own-only, bounded, identity-safe, and JSON idempotent", () => {
  let run = chooseFinalPromiseTone(atChoice(), "steady");
  run = submitFinalPromiseMessage(run, finalPromiseMessageText(run), safe, T3);
  assert.deepEqual(normalizeFinalPromiseRun(JSON.parse(JSON.stringify(run))), run);
  assert.equal(normalizeFinalPromiseRun(Object.create(run)), null);
  assert.equal(normalizeFinalPromiseRun({ ...run, personId: "person:sora" }), null);
  assert.equal(normalizeFinalPromiseRun({ ...run, stationId: "station:sim6jp" }), null);
  assert.equal(normalizeFinalPromiseRun({ ...run, tone: "custom" }), null);
  assert.equal(normalizeFinalPromiseRun({ ...run, messageKey: "player prose" }), null);

  const sparse = JSON.parse(JSON.stringify(run));
  delete sparse.recallKeys[1];
  assert.equal(normalizeFinalPromiseRun(sparse), null);
  assert.equal(normalizeFinalPromiseRun({ ...run, scheduledPersonIds: Array(10000).fill("person:sora") }), null);
});

test("Chapter 14 state never preserves unrecognized proof or archive prose", () => {
  const normalized = normalizeFinalPromiseState({
    activeRun: null,
    completedRuns: [],
    settledRunIds: [],
    settlementProofs: [{ runId: "forged", freeText: "PLAYER SECRET" }],
    archive: [{ runId: "forged", decoded: "RAW MORSE" }],
  });
  assert.deepEqual(normalized.settlementProofs, []);
  assert.deepEqual(normalized.archive, []);
  assert.equal(JSON.stringify(normalized).includes("PLAYER SECRET"), false);
  assert.equal(JSON.stringify(normalized).includes("RAW MORSE"), false);
});
