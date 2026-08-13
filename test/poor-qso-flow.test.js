import assert from "node:assert/strict";
import test from "node:test";

import {
  QSO_PHASES,
  createQso,
  onNpcPlaybackFinished,
  resolveCqResponse,
  submitPlayerMessage,
} from "../src/qso/qsoEngine.js";

const weakSignalSpecialist = {
  callsign: "SIM2DX",
  regionId: "AS-SIM",
  latitude: 35.68,
  longitude: 139.76,
  baseLevel: 1,
  finalLevel: 1,
  wpm: 16,
  isFictional: true,
};

function transmitCq(qso) {
  return submitPlayerMessage(
    qso,
    "CQ CQ DE BH1ABC BH1ABC PSE K",
    { wpm: 16, accuracy: 100, rhythm: 90 },
  );
}

test("a locked weak-signal responder can copy a clean retransmission after a deep fade", () => {
  let qso = createQso({ npc: weakSignalSpecialist, playerCallsign: "BH1ABC" });

  qso = resolveCqResponse(transmitCq(qso), weakSignalSpecialist, { seed: "deep-fade-expert" });
  assert.equal(qso.npcReplyDisposition, "query");
  assert.equal(qso.npcMessage, "AGN? K");
  assert.equal(qso.pendingResponder.callsign, "SIM2DX");
  assert.equal(qso.pendingResponderQueryCount, 1);
  const firstFade = qso.lastNpcReception.channelFadePenalty;

  qso = onNpcPlaybackFinished(qso);
  assert.equal(qso.phase, QSO_PHASES.PLAYER_CQ);
  qso = resolveCqResponse(transmitCq(qso), qso.pendingResponder, { seed: "deep-fade-expert" });
  assert.equal(qso.npcReplyDisposition, "copy");
  assert.equal(qso.lastCopyOutcome, "copied");
  assert.equal(qso.hasContact, true);
  assert.equal(qso.pendingResponder, null);
  assert.equal(qso.pendingResponderQueryCount, 0);
  assert.ok(qso.lastNpcReception.channelFadePenalty < firstFade);
});
