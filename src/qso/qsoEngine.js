import { normalizeCwText } from "../cw/morse.js";

export const QSO_PHASES = Object.freeze({
  WAITING_CQ: "WAITING_CQ",
  PLAYER_REPLY: "PLAYER_REPLY",
  NPC_RST: "NPC_RST",
  PLAYER_RST_AND_73: "PLAYER_RST_AND_73",
  NPC_73_AND_SK: "NPC_73_AND_SK",
  QSO_COMPLETE: "QSO_COMPLETE",
  QSO_FAILED: "QSO_FAILED",
});

function normalizeCallsign(value) {
  return normalizeCwText(value).replace(/[^A-Z0-9]/g, "");
}

function tokenized(value) {
  return normalizeCwText(value).split(" ").filter(Boolean);
}

function hasCallsign(tokens, callsign) {
  const expected = normalizeCallsign(callsign);
  return tokens.some((token) => normalizeCallsign(token) === expected);
}

export function createQso({ npc, playerCallsign = "SIM-K7QX", startedAt = new Date().toISOString() }) {
  if (!npc?.callsign) throw new Error("NPC callsign is required.");
  return {
    phase: QSO_PHASES.WAITING_CQ,
    npc,
    playerCallsign,
    npcMessage: `CQ CQ DE ${npc.callsign} K`,
    expectedPlayer: `${npc.callsign} DE ${playerCallsign} K`,
    sentRst: null,
    receivedRst: null,
    attempts: 0,
    lastError: null,
    creditsAwarded: 0,
    startedAt,
    completedAt: null,
  };
}

export function onNpcPlaybackFinished(qso, completedAt = new Date().toISOString()) {
  if (qso.phase === QSO_PHASES.WAITING_CQ) {
    return { ...qso, phase: QSO_PHASES.PLAYER_REPLY, lastError: null };
  }
  if (qso.phase === QSO_PHASES.NPC_RST) {
    return { ...qso, phase: QSO_PHASES.PLAYER_RST_AND_73, lastError: null };
  }
  if (qso.phase === QSO_PHASES.NPC_73_AND_SK) {
    return { ...qso, phase: QSO_PHASES.QSO_COMPLETE, creditsAwarded: 100, completedAt, lastError: null };
  }
  return qso;
}

export function validatePlayerMessage(qso, message) {
  const tokens = tokenized(message);
  if (qso.phase === QSO_PHASES.PLAYER_REPLY) {
    if (!hasCallsign(tokens, qso.npc.callsign)) return { valid: false, reason: "missingNpcCallsign" };
    if (!tokens.includes("DE")) return { valid: false, reason: "missingDe" };
    if (!hasCallsign(tokens, qso.playerCallsign)) return { valid: false, reason: "missingPlayerCallsign" };
    const npcIndex = tokens.findIndex((token) => normalizeCallsign(token) === normalizeCallsign(qso.npc.callsign));
    const deIndex = tokens.indexOf("DE");
    const playerIndex = tokens.findIndex((token) => normalizeCallsign(token) === normalizeCallsign(qso.playerCallsign));
    if (!(npcIndex < deIndex && deIndex < playerIndex)) return { valid: false, reason: "wrongCallsignOrder" };
    return { valid: true, reason: null };
  }
  if (qso.phase === QSO_PHASES.PLAYER_RST_AND_73) {
    if (!hasCallsign(tokens, qso.npc.callsign) || !hasCallsign(tokens, qso.playerCallsign)) return { valid: false, reason: "missingCallsign" };
    const rstIndex = tokens.indexOf("RST");
    const rst = rstIndex >= 0 ? tokens[rstIndex + 1] : null;
    if (!rst || !/^[1-5][1-9][1-9]$/.test(rst)) return { valid: false, reason: "invalidRst" };
    if (!tokens.includes("73")) return { valid: false, reason: "missing73" };
    return { valid: true, reason: null, rst };
  }
  return { valid: false, reason: "notWaitingForPlayer" };
}

export function submitPlayerMessage(qso, message, { npcRst = "579" } = {}) {
  const validation = validatePlayerMessage(qso, message);
  if (!validation.valid) {
    const attempts = qso.attempts + 1;
    return { ...qso, attempts, lastError: validation.reason, phase: attempts >= 2 ? QSO_PHASES.QSO_FAILED : qso.phase };
  }
  if (qso.phase === QSO_PHASES.PLAYER_REPLY) {
    return {
      ...qso,
      phase: QSO_PHASES.NPC_RST,
      attempts: 0,
      lastError: null,
      receivedRst: npcRst,
      npcMessage: `${qso.playerCallsign} DE ${qso.npc.callsign} RST ${npcRst} K`,
      expectedPlayer: `${qso.npc.callsign} DE ${qso.playerCallsign} RST 559 73 K`,
    };
  }
  return {
    ...qso,
    phase: QSO_PHASES.NPC_73_AND_SK,
    attempts: 0,
    lastError: null,
    sentRst: validation.rst,
    npcMessage: "R 73 SK",
    expectedPlayer: null,
  };
}

export function restartQso(qso, startedAt = new Date().toISOString()) {
  return createQso({ npc: qso.npc, playerCallsign: qso.playerCallsign, startedAt });
}

export function qsoCanAcceptPlayer(qso) {
  return qso.phase === QSO_PHASES.PLAYER_REPLY || qso.phase === QSO_PHASES.PLAYER_RST_AND_73;
}

export function qsoNeedsNpcPlayback(qso) {
  return [QSO_PHASES.WAITING_CQ, QSO_PHASES.NPC_RST, QSO_PHASES.NPC_73_AND_SK].includes(qso.phase);
}

export function createQsoLogEntry(qso) {
  if (qso.phase !== QSO_PHASES.QSO_COMPLETE) throw new Error("Only completed QSOs can be logged.");
  const completed = new Date(qso.completedAt);
  return {
    id: `${qso.npc.callsign}-${completed.getTime()}`,
    time: completed.toISOString().slice(11, 16),
    callsign: qso.npc.callsign,
    frequency: "21.060",
    mode: "CW",
    sent: qso.sentRst,
    received: qso.receivedRst,
    location: qso.npc.regionId ?? "SIM",
    isFictional: true,
    credits: qso.creditsAwarded,
  };
}

