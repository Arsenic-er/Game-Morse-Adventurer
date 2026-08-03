import test from "node:test";
import assert from "node:assert/strict";
import { assessCqTransmission, cqMessageCandidates } from "../src/qso/cqAssessment.js";

const playerCallsign = "BH1ABC";

test("all supported standard CQ forms can earn a perfect message score", () => {
  for (const message of cqMessageCandidates(playerCallsign)) {
    const assessment = assessCqTransmission({
      message,
      playerCallsign,
      wpm: 18,
      rhythm: 100,
    });
    assert.equal(assessment.quality, 100, message);
    assert.equal(assessment.editScore, 100, message);
    assert.equal(assessment.identityScore, 100, message);
    assert.equal(assessment.identityEditDistance, 0, message);
    assert.equal(assessment.orderScore, 100, message);
  }
});

test("CQ quality decreases gradually instead of using a binary format gate", () => {
  const exact = assessCqTransmission({
    message: "CQ CQ DE BH1ABC BH1ABC K", playerCallsign, wpm: 18, rhythm: 80,
  });
  const missingDe = assessCqTransmission({
    message: "CQ CQ BH1ABC K", playerCallsign, wpm: 18, rhythm: 80,
  });
  const partialCall = assessCqTransmission({
    message: "CQ DE BH1 K", playerCallsign, wpm: 18, rhythm: 80,
  });
  const garbage = assessCqTransmission({
    message: "T T T T T", playerCallsign, wpm: 18, rhythm: 80,
  });
  assert.ok(exact.quality > missingDe.quality);
  assert.ok(missingDe.quality > partialCall.quality);
  assert.ok(partialCall.quality > garbage.quality);
  assert.equal(garbage.recognizable, false);
});

test("one callsign error is measurable and cannot masquerade as an exact identity", () => {
  const assessment = assessCqTransmission({
    message: "cq   cq de bh1abx k",
    playerCallsign,
    wpm: 19,
    rhythm: 76,
  });
  assert.ok(assessment.quality >= 80);
  assert.ok(assessment.identityScore < 100);
  assert.ok(assessment.identityScore >= 70);
  assert.equal(assessment.identityEditDistance, 1);
  assert.equal(assessment.wpm, 19);
});

test("missing timing metrics remain neutral and unknown", () => {
  for (const metrics of [
    { wpm: null, rhythm: null },
    { wpm: undefined, rhythm: undefined },
    { wpm: "", rhythm: "" },
  ]) {
    const assessment = assessCqTransmission({
      message: "CQ DE BH1ABC K", playerCallsign, ...metrics,
    });
    assert.equal(assessment.wpm, null);
    assert.equal(assessment.rhythmScore, 50);
  }
});

test("malformed and empty values always return finite bounded scores", () => {
  for (const message of [null, "", "???", "X".repeat(500)]) {
    const assessment = assessCqTransmission({ message, playerCallsign, wpm: Infinity, rhythm: -50 });
    for (const key of ["quality", "editScore", "intentScore", "identityScore", "orderScore", "rhythmScore"]) {
      assert.ok(Number.isFinite(assessment[key]), `${String(message)}:${key}`);
      assert.ok(assessment[key] >= 0 && assessment[key] <= 100, `${String(message)}:${key}`);
    }
    assert.equal(assessment.wpm, null);
  }
});
