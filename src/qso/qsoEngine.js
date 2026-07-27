import { normalizeCwText } from "../cw/morse.js";
import { greatCircleDistanceDegrees } from "../propagation/propagationEngine.js";
import { MAX_QSO_ATTEMPT_HISTORY, normalizeQsoLogEntry } from "./qsoLog.js";

export const QSO_PHASES = Object.freeze({
  PLAYER_CQ: "PLAYER_CQ",
  WAITING_RESPONSE: "WAITING_RESPONSE",
  NPC_REPLY: "NPC_REPLY",
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

function expectedCq(playerCallsign) {
  return `CQ CQ DE ${playerCallsign} ${playerCallsign} K`;
}

function normalizeGuidanceLevel(value) {
  return ["full", "hints", "off"].includes(value) ? value : "full";
}

function normalizeMetric(value, maximum = 100) {
  if (value === null || value === undefined || value === "") return null;
  const numeric = Number(value);
  return Number.isFinite(numeric)
    ? Number(Math.min(maximum, Math.max(0, numeric)).toFixed(1))
    : null;
}

function appendAttempt(qso, message, validation, metrics = {}) {
  const result = validation.valid
    ? (validation.action === "repeat" ? "repeat" : "accepted")
    : "rejected";
  const previous = Array.isArray(qso.attemptHistory) ? qso.attemptHistory : [];
  return [...previous, {
    stage: String(qso.phase ?? "UNKNOWN").slice(0, 48),
    message: normalizeCwText(message).slice(0, 160),
    result,
    reason: validation.reason ?? null,
    wpm: normalizeMetric(metrics.wpm, 120),
    accuracy: normalizeMetric(metrics.accuracy),
    rhythm: normalizeMetric(metrics.rhythm),
  }].slice(-MAX_QSO_ATTEMPT_HISTORY);
}

export function createQso({
  npc,
  playerCallsign = "SIM-K7QX",
  startedAt = new Date().toISOString(),
  guidanceLevel = "full",
  visualAssistUsed,
}) {
  if (!npc?.callsign) throw new Error("NPC callsign is required.");
  const frozenGuidanceLevel = normalizeGuidanceLevel(guidanceLevel);
  return {
    phase: QSO_PHASES.PLAYER_CQ,
    npc,
    playerCallsign,
    npcMessage: null,
    expectedPlayer: expectedCq(playerCallsign),
    hasContact: false,
    contactRevealed: false,
    repeatRequests: 0,
    unansweredCalls: 0,
    sentRst: null,
    receivedRst: null,
    attempts: 0,
    attemptHistory: [],
    lastError: null,
    guidanceLevel: frozenGuidanceLevel,
    visualAssistUsed: typeof visualAssistUsed === "boolean" ? visualAssistUsed : frozenGuidanceLevel !== "off",
    independentWatch: false,
    creditsAwarded: 0,
    startedAt,
    completedAt: null,
  };
}

export function markQsoAssisted(qso) {
  if (!qso || typeof qso !== "object" || qso.visualAssistUsed === true) return qso;
  if ([QSO_PHASES.QSO_COMPLETE, QSO_PHASES.QSO_FAILED].includes(qso.phase)) return qso;
  return {
    ...qso,
    visualAssistUsed: true,
  };
}

export function onNpcPlaybackFinished(qso, completedAt = new Date().toISOString()) {
  if (qso.phase === QSO_PHASES.NPC_REPLY) {
    return { ...qso, phase: QSO_PHASES.PLAYER_RST_AND_73, lastError: null };
  }
  if (qso.phase === QSO_PHASES.NPC_73_AND_SK) {
    const independentWatch = qso.guidanceLevel === "off" && qso.visualAssistUsed !== true;
    return {
      ...qso,
      phase: QSO_PHASES.QSO_COMPLETE,
      creditsAwarded: independentWatch ? 150 : 100,
      independentWatch,
      completedAt,
      lastError: null,
    };
  }
  return qso;
}

export function validatePlayerMessage(qso, message) {
  const tokens = tokenized(message);
  if (qso.phase === QSO_PHASES.PLAYER_CQ) {
    const cqIndex = tokens.indexOf("CQ");
    if (cqIndex < 0) return { valid: false, reason: "missingCq" };
    if (!tokens.includes("DE")) return { valid: false, reason: "missingDe" };
    if (!hasCallsign(tokens, qso.playerCallsign)) return { valid: false, reason: "missingPlayerCallsign" };
    const deIndex = tokens.indexOf("DE");
    const playerIndex = tokens.findIndex((token) => normalizeCallsign(token) === normalizeCallsign(qso.playerCallsign));
    if (!(cqIndex < deIndex && deIndex < playerIndex)) return { valid: false, reason: "wrongCqOrder" };
    if (tokens.at(-1) !== "K") return { valid: false, reason: "missingK" };
    return { valid: true, reason: null };
  }
  if (qso.phase === QSO_PHASES.PLAYER_RST_AND_73) {
    if (tokens.length === 2 && tokens[0] === "AGN" && tokens[1] === "K") {
      return { valid: true, reason: null, action: "repeat" };
    }
    if (tokens.includes("AGN")) return { valid: false, reason: "invalidAgn" };
    if (!tokens.includes("DE")) return { valid: false, reason: "missingDe" };
    if (tokens.at(-1) !== "K") return { valid: false, reason: "missingK" };
    if (!hasCallsign(tokens, qso.npc.callsign) || !hasCallsign(tokens, qso.playerCallsign)) return { valid: false, reason: "missingCallsign" };
    const rstIndex = tokens.indexOf("RST");
    const rst = rstIndex >= 0 ? tokens[rstIndex + 1] : null;
    if (!rst || !/^[1-5][1-9][1-9]$/.test(rst)) return { valid: false, reason: "invalidRst" };
    if (!tokens.includes("73")) return { valid: false, reason: "missing73" };
    const inStrictOrder = tokens.length === 7
      && normalizeCallsign(tokens[0]) === normalizeCallsign(qso.npc.callsign)
      && tokens[1] === "DE"
      && normalizeCallsign(tokens[2]) === normalizeCallsign(qso.playerCallsign)
      && tokens[3] === "RST"
      && tokens[4] === rst
      && tokens[5] === "73"
      && tokens[6] === "K";
    if (!inStrictOrder) return { valid: false, reason: "wrongReplyOrder" };
    return { valid: true, reason: null, action: "complete", rst };
  }
  return { valid: false, reason: "notWaitingForPlayer" };
}

export function submitPlayerMessage(qso, message, {
  npcRst = "579",
  wpm = null,
  accuracy = null,
  rhythm = null,
} = {}) {
  const validation = validatePlayerMessage(qso, message);
  const attemptHistory = appendAttempt(qso, message, validation, { wpm, accuracy, rhythm });
  if (!validation.valid) {
    const attempts = Math.min(
      Number.MAX_SAFE_INTEGER,
      (Number.isSafeInteger(qso.attempts) && qso.attempts >= 0 ? qso.attempts : 0) + 1,
    );
    return { ...qso, attempts, attemptHistory, lastError: validation.reason };
  }
  if (qso.phase === QSO_PHASES.PLAYER_CQ) {
    return {
      ...qso,
      phase: QSO_PHASES.WAITING_RESPONSE,
      attempts: 0,
      attemptHistory,
      lastError: null,
      npcMessage: null,
      expectedPlayer: null,
    };
  }
  if (validation.action === "repeat") {
    return {
      ...qso,
      phase: QSO_PHASES.NPC_REPLY,
      attemptHistory,
      lastError: null,
      repeatRequests: Math.min(
        Number.MAX_SAFE_INTEGER,
        (Number.isSafeInteger(qso.repeatRequests) && qso.repeatRequests >= 0 ? qso.repeatRequests : 0) + 1,
      ),
      contactRevealed: false,
    };
  }
  return {
    ...qso,
    phase: QSO_PHASES.NPC_73_AND_SK,
    attempts: 0,
    attemptHistory,
    lastError: null,
    sentRst: validation.rst,
    receivedRst: npcRst,
    npcMessage: `${qso.playerCallsign} DE ${qso.npc.callsign} R RST ${npcRst} 73 SK`,
    expectedPlayer: null,
    contactRevealed: true,
  };
}

export function resolveCqResponse(qso, npc) {
  if (qso.phase !== QSO_PHASES.WAITING_RESPONSE) return qso;
  if (!npc?.callsign) {
    return {
      ...qso,
      phase: QSO_PHASES.PLAYER_CQ,
      unansweredCalls: qso.unansweredCalls + 1,
      lastError: "noResponse",
      npcMessage: null,
      expectedPlayer: expectedCq(qso.playerCallsign),
      hasContact: false,
      contactRevealed: false,
    };
  }
  return {
    ...qso,
    phase: QSO_PHASES.NPC_REPLY,
    npc,
    lastError: null,
    npcMessage: `${qso.playerCallsign} DE ${npc.callsign} ${npc.callsign} K`,
    expectedPlayer: `${npc.callsign} DE ${qso.playerCallsign} RST 559 73 K`,
    hasContact: true,
    contactRevealed: false,
  };
}

export function restartQso(qso, startedAt = new Date().toISOString()) {
  return createQso({
    npc: qso.npc,
    playerCallsign: qso.playerCallsign,
    startedAt,
    guidanceLevel: qso.guidanceLevel,
  });
}

export function qsoCanAcceptPlayer(qso) {
  return qso.phase === QSO_PHASES.PLAYER_CQ || qso.phase === QSO_PHASES.PLAYER_RST_AND_73;
}

export function qsoNeedsNpcPlayback(qso) {
  return [QSO_PHASES.NPC_REPLY, QSO_PHASES.NPC_73_AND_SK].includes(qso.phase);
}

export function createQsoLogEntry(qso, {
  frequencyMhz = 21.06,
  playerLocation = null,
  playerLocationId,
  equipmentId = "squid-01",
  antennaId = "none",
  accessoryId = "none",
  propagationSource = "OFFLINE_DEFAULT",
  wpm,
  transmitAccuracy = null,
  copyAccuracy = null,
  keyingScore = null,
} = {}) {
  if (qso.phase !== QSO_PHASES.QSO_COMPLETE) throw new Error("Only completed QSOs can be logged.");
  const started = new Date(qso.startedAt);
  const completed = new Date(qso.completedAt);
  if (!Number.isFinite(started.getTime()) || !Number.isFinite(completed.getTime()) || completed < started) {
    throw new Error("Completed QSOs require valid chronological timestamps.");
  }
  const npcLatitude = Number(qso.npc.latitude);
  const npcLongitude = Number(qso.npc.longitude);
  const hasNpcCoordinates = Number.isFinite(npcLatitude) && Number.isFinite(npcLongitude);
  const hasPlayerCoordinates = Number.isFinite(Number(playerLocation?.latitude)) && Number.isFinite(Number(playerLocation?.longitude));
  const distanceKm = hasNpcCoordinates && hasPlayerCoordinates
    ? greatCircleDistanceDegrees(playerLocation, qso.npc) * 111.195
    : 0;
  const entry = {
    id: `${qso.npc.callsign}-${completed.getTime()}`,
    startedAt: started.toISOString(),
    completedAt: completed.toISOString(),
    playerCallsign: qso.playerCallsign,
    callsign: qso.npc.callsign,
    frequencyMhz,
    mode: "CW",
    sent: qso.sentRst,
    received: qso.receivedRst,
    location: qso.npc.regionId ?? "SIM",
    npcLatitude: hasNpcCoordinates ? npcLatitude : null,
    npcLongitude: hasNpcCoordinates ? npcLongitude : null,
    distanceKm,
    basePropagationLevel: qso.npc.baseLevel,
    finalPropagationLevel: qso.npc.finalLevel,
    propagationSource,
    equipmentId,
    antennaId,
    accessoryId,
    playerLocationId: playerLocationId ?? playerLocation?.id ?? "unknown",
    wpm: wpm ?? qso.npc.wpm,
    transmitAccuracy: transmitAccuracy ?? copyAccuracy,
    keyingScore,
    repeatRequests: qso.repeatRequests,
    guidanceLevel: qso.guidanceLevel,
    visualAssistUsed: qso.visualAssistUsed,
    independentWatch: qso.independentWatch,
    attemptHistory: qso.attemptHistory,
    isFictional: qso.npc.isFictional !== false,
    credits: qso.creditsAwarded,
  };
  const normalized = normalizeQsoLogEntry(entry);
  if (!normalized) throw new Error("Completed QSO could not be normalized into a log entry.");
  return normalized;
}
