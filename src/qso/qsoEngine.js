import { normalizeCwText } from "../cw/morse.js";
import { greatCircleDistanceDegrees } from "../propagation/propagationEngine.js";
import { assessCqTransmission } from "./cqAssessment.js";
import {
  buildRemoteReply, resolveRemoteCopy, resolveRemoteReportCopy, withOperatorProfile,
} from "./operatorProfiles.js";
import { MAX_QSO_ATTEMPT_HISTORY, normalizeQsoLogEntry } from "./qsoLog.js";

export const QSO_PHASES = Object.freeze({
  PLAYER_CQ: "PLAYER_CQ",
  WAITING_RESPONSE: "WAITING_RESPONSE",
  NPC_REPLY: "NPC_REPLY",
  PLAYER_RST_AND_73: "PLAYER_RST_AND_73",
  NPC_OPTIONAL_QUERY: "NPC_OPTIONAL_QUERY",
  PLAYER_OPTIONAL_ANSWER: "PLAYER_OPTIONAL_ANSWER",
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

function expectedReport(npcCallsign, playerCallsign) {
  return `${npcCallsign} DE ${playerCallsign} RST 559 73 K`;
}

const OPTIONAL_EXCHANGE_SPECS = Object.freeze({
  power: Object.freeze({ keyword: "PWR", prompt: "PWR? K", example: "PWR 50 W K" }),
  location: Object.freeze({ keyword: "QTH", prompt: "QTH? K", example: "QTH PIXEL CITY K" }),
  weather: Object.freeze({ keyword: "WX", prompt: "WX? K", example: "WX SUNNY K" }),
  name: Object.freeze({ keyword: "NAME", prompt: "NAME? K", example: "NAME SPARK K" }),
  age: Object.freeze({ keyword: "AGE", prompt: "AGE? K", example: "AGE 25 K" }),
});

function optionalExchangeSpec(questionId) {
  return OPTIONAL_EXCHANGE_SPECS[questionId] ?? null;
}

function finalNpcMessage(qso, outcome = null) {
  const style = qso.npc?.operatorStyle ?? {};
  if (outcome === "answered" && qso.optionalExchangeQuestion === "name") {
    return `${qso.playerCallsign} DE ${qso.npc.callsign} TNX MY NAME ${style.personaName ?? "OP"} 73 SK`;
  }
  if (outcome === "answered" && qso.optionalExchangeQuestion === "age") {
    return `${qso.playerCallsign} DE ${qso.npc.callsign} TNX AGE ${style.personaAge ?? 40} 73 SK`;
  }
  const acknowledgement = outcome === "answered" ? "TNX " : outcome === "skipped" ? "OK " : "";
  return `${qso.playerCallsign} DE ${qso.npc.callsign} ${acknowledgement}R RST ${qso.receivedRst ?? "579"} 73 SK`;
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

function appendAttempt(qso, message, validation, metrics = {}, assessment = null) {
  const result = validation.valid
    ? (validation.action === "repeat" ? "repeat" : validation.action === "transmit" ? "transmitted" : "accepted")
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
    cqQuality: normalizeMetric(assessment?.quality),
    copyScore: null,
    remoteOutcome: null,
    operatorProfileId: null,
  }].slice(-MAX_QSO_ATTEMPT_HISTORY);
}

function annotateLatestRemoteAttempt(attemptHistory, decision, fallbackOutcome = null) {
  if (!Array.isArray(attemptHistory) || !attemptHistory.length) return [];
  const next = [...attemptHistory];
  next[next.length - 1] = {
    ...next.at(-1),
    copyScore: normalizeMetric(decision?.copyScore),
    remoteOutcome: decision?.outcome ?? fallbackOutcome,
    operatorProfileId: decision?.operatorProfileId ?? null,
  };
  return next;
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
  const profiledNpc = withOperatorProfile(npc);
  return {
    phase: QSO_PHASES.PLAYER_CQ,
    npc: profiledNpc,
    playerCallsign,
    npcMessage: null,
    contactMessage: null,
    npcReplyDisposition: null,
    replyWpm: null,
    expectedPlayer: expectedCq(playerCallsign),
    hasContact: false,
    contactRevealed: false,
    repeatRequests: 0,
    copyQueries: 0,
    reportCopyQueries: 0,
    optionalExchangeQuestion: null,
    optionalExchangeOutcome: "not-offered",
    optionalExchangeRepeatRequests: 0,
    optionalExchangeMessage: null,
    pendingResponderQueryCount: 0,
    unansweredCalls: 0,
    sentRst: null,
    receivedRst: null,
    attempts: 0,
    attemptHistory: [],
    cqAssessment: null,
    lastCopyOutcome: null,
    lastCopyScore: null,
    lastReportCopyOutcome: null,
    lastReportCopyScore: null,
    channelNotice: null,
    pendingResponder: null,
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
    if (qso.npcReplyDisposition === "report-query") {
      return {
        ...qso,
        phase: QSO_PHASES.PLAYER_RST_AND_73,
        npcMessage: qso.contactMessage,
        npcReplyDisposition: null,
        expectedPlayer: expectedReport(qso.npc.callsign, qso.playerCallsign),
        hasContact: true,
        contactRevealed: true,
        lastError: null,
        channelNotice: "reportQuery",
      };
    }
    if (qso.npcReplyDisposition === "query") {
      return {
        ...qso,
        phase: QSO_PHASES.PLAYER_CQ,
        npcMessage: null,
        npcReplyDisposition: null,
        replyWpm: null,
        expectedPlayer: expectedCq(qso.playerCallsign),
        hasContact: false,
        contactRevealed: false,
        lastError: null,
        channelNotice: "npcQuery",
      };
    }
    if (qso.npcReplyDisposition === "general") {
      return {
        ...qso,
        phase: QSO_PHASES.PLAYER_CQ,
        npcMessage: null,
        npcReplyDisposition: null,
        replyWpm: null,
        expectedPlayer: expectedCq(qso.playerCallsign),
        hasContact: false,
        contactRevealed: false,
        pendingResponder: null,
        unansweredCalls: qso.unansweredCalls + 1,
        lastError: null,
        channelNotice: "generalCall",
      };
    }
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
  if (qso.phase === QSO_PHASES.NPC_OPTIONAL_QUERY) {
    const spec = optionalExchangeSpec(qso.optionalExchangeQuestion);
    return {
      ...qso,
      phase: QSO_PHASES.PLAYER_OPTIONAL_ANSWER,
      npcReplyDisposition: null,
      expectedPlayer: spec?.example ?? "SKIP K",
      lastError: null,
      channelNotice: "optionalExchange",
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
  if (qso.phase === QSO_PHASES.PLAYER_OPTIONAL_ANSWER) {
    if (tokens.length === 2 && tokens[0] === "AGN" && tokens[1] === "K") {
      return { valid: true, reason: null, action: "repeat-optional" };
    }
    if (tokens.length === 2 && ((tokens[0] === "SKIP" && tokens[1] === "K") || (tokens[0] === "73" && tokens[1] === "K"))) {
      return { valid: true, reason: null, action: "skip-optional" };
    }
    if (tokens.includes("AGN")) return { valid: false, reason: "invalidAgn" };
    if (tokens.includes("SKIP") || tokens.includes("73")) return { valid: false, reason: "invalidOptionalSkip" };
    if (tokens.at(-1) !== "K") return { valid: false, reason: "missingK" };
    const spec = optionalExchangeSpec(qso.optionalExchangeQuestion);
    const payload = tokens.slice(1, -1);
    if (!spec || tokens[0] !== spec.keyword || payload.length === 0) {
      return { valid: false, reason: "invalidOptionalAnswer" };
    }
    if (qso.optionalExchangeQuestion === "power") {
      if (payload.length !== 2 || !/^\d{1,4}$/.test(payload[0]) || payload[1] !== "W" || Number(payload[0]) < 1) {
        return { valid: false, reason: "invalidOptionalAnswer" };
      }
    }
    if (qso.optionalExchangeQuestion === "age") {
      if (payload.length !== 1 || !/^\d{1,3}$/.test(payload[0]) || Number(payload[0]) < 1 || Number(payload[0]) > 120) {
        return { valid: false, reason: "invalidOptionalAnswer" };
      }
    }
    return { valid: true, reason: null, action: "answer-optional" };
  }
  return { valid: false, reason: "notWaitingForPlayer" };
}

export function submitPlayerMessage(qso, message, {
  npcRst = "579",
  wpm = null,
  accuracy = null,
  rhythm = null,
  seed = "report-copy",
} = {}) {
  const validation = validatePlayerMessage(qso, message);
  if (qso.phase === QSO_PHASES.PLAYER_CQ) {
    const cqAssessment = assessCqTransmission({
      message,
      playerCallsign: qso.playerCallsign,
      wpm,
      rhythm,
    });
    const transmittedValidation = {
      ...validation,
      valid: true,
      action: validation.valid ? validation.action : "transmit",
      reason: validation.valid ? null : validation.reason,
    };
    const attemptHistory = appendAttempt(
      qso,
      message,
      transmittedValidation,
      { wpm, accuracy: cqAssessment.editScore, rhythm },
      cqAssessment,
    );
    return {
      ...qso,
      phase: QSO_PHASES.WAITING_RESPONSE,
      attempts: 0,
      attemptHistory,
      cqAssessment,
      lastCopyOutcome: null,
      lastCopyScore: null,
      channelNotice: null,
      lastError: null,
      npcMessage: null,
      npcReplyDisposition: null,
      replyWpm: null,
      expectedPlayer: null,
      pendingResponderQueryCount: qso.pendingResponder ? qso.pendingResponderQueryCount : 0,
    };
  }
  const recordedMessage = qso.phase === QSO_PHASES.PLAYER_OPTIONAL_ANSWER
    && !["repeat-optional", "skip-optional"].includes(validation.action)
    ? "OPTIONAL RESPONSE REDACTED"
    : message;
  const attemptHistory = appendAttempt(qso, recordedMessage, validation, { wpm, accuracy, rhythm });
  if (!validation.valid) {
    const attempts = Math.min(
      Number.MAX_SAFE_INTEGER,
      (Number.isSafeInteger(qso.attempts) && qso.attempts >= 0 ? qso.attempts : 0) + 1,
    );
    return { ...qso, attempts, attemptHistory, lastError: validation.reason };
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
      npcMessage: qso.contactMessage ?? qso.npcMessage,
      contactRevealed: qso.contactRevealed,
      npcReplyDisposition: "copy",
    };
  }
  if (validation.action === "repeat-optional") {
    return {
      ...qso,
      phase: QSO_PHASES.NPC_OPTIONAL_QUERY,
      attemptHistory,
      lastError: null,
      repeatRequests: Math.min(
        Number.MAX_SAFE_INTEGER,
        (Number.isSafeInteger(qso.repeatRequests) && qso.repeatRequests >= 0 ? qso.repeatRequests : 0) + 1,
      ),
      optionalExchangeRepeatRequests: Math.min(
        Number.MAX_SAFE_INTEGER,
        (Number.isSafeInteger(qso.optionalExchangeRepeatRequests) && qso.optionalExchangeRepeatRequests >= 0
          ? qso.optionalExchangeRepeatRequests
          : 0) + 1,
      ),
      npcMessage: qso.optionalExchangeMessage ?? qso.npcMessage,
      npcReplyDisposition: "optional-query",
      expectedPlayer: null,
      channelNotice: null,
    };
  }
  if (["skip-optional", "answer-optional"].includes(validation.action)) {
    const outcome = validation.action === "answer-optional" ? "answered" : "skipped";
    return {
      ...qso,
      phase: QSO_PHASES.NPC_73_AND_SK,
      attempts: 0,
      attemptHistory,
      lastError: null,
      optionalExchangeOutcome: outcome,
      npcMessage: finalNpcMessage(qso, outcome),
      npcReplyDisposition: "copy",
      expectedPlayer: null,
      channelNotice: null,
    };
  }
  const reportCopyQueries = Number.isSafeInteger(qso.reportCopyQueries) && qso.reportCopyQueries >= 0
    ? qso.reportCopyQueries
    : 0;
  const decision = resolveRemoteReportCopy({
    npc: qso.npc,
    wpm,
    accuracy,
    rhythm,
    seed,
    queryCount: reportCopyQueries,
  });
  const resolvedAttemptHistory = annotateLatestRemoteAttempt(attemptHistory, decision);
  if (decision.outcome === "query") {
    return {
      ...qso,
      phase: QSO_PHASES.NPC_REPLY,
      npc: decision.npc,
      attempts: 0,
      attemptHistory: resolvedAttemptHistory,
      lastError: null,
      npcMessage: decision.replyMessage,
      npcReplyDisposition: "report-query",
      expectedPlayer: null,
      hasContact: true,
      contactRevealed: true,
      channelNotice: null,
      reportCopyQueries: reportCopyQueries + 1,
      lastReportCopyOutcome: decision.outcome,
      lastReportCopyScore: decision.copyScore,
    };
  }
  if (decision.outcome === "unreadable") {
    return {
      ...qso,
      phase: QSO_PHASES.PLAYER_RST_AND_73,
      npc: decision.npc,
      attempts: 0,
      attemptHistory: resolvedAttemptHistory,
      lastError: null,
      npcMessage: qso.contactMessage ?? qso.npcMessage,
      npcReplyDisposition: null,
      expectedPlayer: expectedReport(qso.npc.callsign, qso.playerCallsign),
      hasContact: true,
      contactRevealed: true,
      channelNotice: "unreadableReport",
      lastReportCopyOutcome: decision.outcome,
      lastReportCopyScore: decision.copyScore,
    };
  }
  const optionalQuestion = optionalExchangeSpec(decision.npc.operatorStyle?.optionalQuestion)
    ? decision.npc.operatorStyle.optionalQuestion
    : null;
  return {
    ...qso,
    phase: optionalQuestion ? QSO_PHASES.NPC_OPTIONAL_QUERY : QSO_PHASES.NPC_73_AND_SK,
    npc: decision.npc,
    attempts: 0,
    attemptHistory: resolvedAttemptHistory,
    lastError: null,
    sentRst: validation.rst,
    receivedRst: npcRst,
    optionalExchangeQuestion: optionalQuestion,
    optionalExchangeOutcome: optionalQuestion ? "pending" : "not-offered",
    optionalExchangeMessage: optionalQuestion
      ? `${qso.playerCallsign} DE ${qso.npc.callsign} R RST ${npcRst} ${optionalExchangeSpec(optionalQuestion).prompt}`
      : null,
    npcMessage: optionalQuestion
      ? `${qso.playerCallsign} DE ${qso.npc.callsign} R RST ${npcRst} ${optionalExchangeSpec(optionalQuestion).prompt}`
      : `${qso.playerCallsign} DE ${qso.npc.callsign} R RST ${npcRst} 73 SK`,
    npcReplyDisposition: optionalQuestion ? "optional-query" : "copy",
    replyWpm: qso.replyWpm ?? qso.npc.wpm,
    expectedPlayer: null,
    contactRevealed: true,
    channelNotice: null,
    lastReportCopyOutcome: decision.outcome,
    lastReportCopyScore: decision.copyScore,
  };
}

export function resolveCqResponse(qso, npc, { seed = "cq-response" } = {}) {
  if (qso.phase !== QSO_PHASES.WAITING_RESPONSE) return qso;
  const pendingResponderQueryCount = Number.isSafeInteger(qso.pendingResponderQueryCount)
    && qso.pendingResponderQueryCount >= 0
    ? qso.pendingResponderQueryCount
    : 0;
  if (!npc?.callsign) {
    return {
      ...qso,
      phase: QSO_PHASES.PLAYER_CQ,
      unansweredCalls: qso.unansweredCalls + 1,
      lastError: "noResponse",
      channelNotice: "noResponse",
      npcMessage: null,
      npcReplyDisposition: null,
      replyWpm: null,
      expectedPlayer: expectedCq(qso.playerCallsign),
      hasContact: false,
      contactRevealed: false,
      pendingResponder: null,
      pendingResponderQueryCount: 0,
      lastCopyOutcome: "no-response",
      lastCopyScore: null,
      attemptHistory: annotateLatestRemoteAttempt(qso.attemptHistory, null, "no-response"),
    };
  }
  const decision = resolveRemoteCopy({
    assessment: qso.cqAssessment,
    npc,
    playerCallsign: qso.playerCallsign,
    seed,
    queryCount: pendingResponderQueryCount,
  });
  const attemptHistory = annotateLatestRemoteAttempt(qso.attemptHistory, decision);
  if (decision.disposition === "silence") {
    return {
      ...qso,
      phase: QSO_PHASES.PLAYER_CQ,
      npc: decision.npc,
      unansweredCalls: qso.unansweredCalls + 1,
      lastError: null,
      channelNotice: "unreadableCq",
      npcMessage: null,
      npcReplyDisposition: null,
      replyWpm: null,
      expectedPlayer: expectedCq(qso.playerCallsign),
      hasContact: false,
      contactRevealed: false,
      pendingResponder: null,
      pendingResponderQueryCount: 0,
      lastCopyOutcome: decision.outcome,
      lastCopyScore: decision.copyScore,
      attemptHistory,
    };
  }
  if (decision.disposition === "query") {
    return {
      ...qso,
      phase: QSO_PHASES.NPC_REPLY,
      npc: decision.npc,
      lastError: null,
      channelNotice: null,
      npcMessage: buildRemoteReply(decision, qso.playerCallsign),
      npcReplyDisposition: "query",
      replyWpm: decision.replyWpm,
      expectedPlayer: null,
      hasContact: false,
      contactRevealed: false,
      pendingResponder: decision.npc,
      copyQueries: qso.copyQueries + 1,
      pendingResponderQueryCount: pendingResponderQueryCount + 1,
      lastCopyOutcome: decision.outcome,
      lastCopyScore: decision.copyScore,
      attemptHistory,
    };
  }
  if (decision.disposition === "general") {
    return {
      ...qso,
      phase: QSO_PHASES.NPC_REPLY,
      npc: decision.npc,
      lastError: null,
      channelNotice: null,
      npcMessage: buildRemoteReply(decision, qso.playerCallsign),
      npcReplyDisposition: "general",
      replyWpm: decision.replyWpm,
      expectedPlayer: null,
      hasContact: false,
      contactRevealed: false,
      pendingResponder: null,
      pendingResponderQueryCount: 0,
      lastCopyOutcome: decision.outcome,
      lastCopyScore: decision.copyScore,
      attemptHistory,
    };
  }
  const npcMessage = buildRemoteReply(decision, qso.playerCallsign);
  return {
    ...qso,
    phase: QSO_PHASES.NPC_REPLY,
    npc: decision.npc,
    lastError: null,
    channelNotice: null,
    npcMessage,
    contactMessage: npcMessage,
    npcReplyDisposition: "copy",
    replyWpm: decision.replyWpm,
    expectedPlayer: `${decision.npc.callsign} DE ${qso.playerCallsign} RST 559 73 K`,
    hasContact: true,
    contactRevealed: false,
    pendingResponder: null,
    pendingResponderQueryCount: 0,
    lastCopyOutcome: decision.outcome,
    lastCopyScore: decision.copyScore,
    attemptHistory,
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
  return [QSO_PHASES.PLAYER_CQ, QSO_PHASES.PLAYER_RST_AND_73, QSO_PHASES.PLAYER_OPTIONAL_ANSWER]
    .includes(qso.phase);
}

export function qsoNeedsNpcPlayback(qso) {
  return [QSO_PHASES.NPC_REPLY, QSO_PHASES.NPC_OPTIONAL_QUERY, QSO_PHASES.NPC_73_AND_SK].includes(qso.phase);
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
    optionalExchangeQuestion: qso.optionalExchangeQuestion,
    optionalExchangeOutcome: qso.optionalExchangeOutcome,
    optionalExchangeRepeatRequests: qso.optionalExchangeRepeatRequests,
    copyQueries: qso.copyQueries,
    cqQuality: qso.cqAssessment?.quality,
    copyScore: qso.lastCopyScore,
    copyOutcome: qso.lastCopyOutcome,
    operatorProfileId: qso.npc.operatorProfileId,
    operatorProfileRevision: qso.npc.operatorProfileRevision,
    remoteWpm: qso.replyWpm ?? qso.npc.wpm,
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
