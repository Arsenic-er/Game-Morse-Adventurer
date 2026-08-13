import { normalizeCwText } from "../cw/morse.js";
import { greatCircleDistanceDegrees } from "../propagation/propagationEngine.js";
import { assessCqTransmission } from "./cqAssessment.js";
import { interpretCwTraffic, semanticResultFromProvider } from "./semanticInterpreter.js";
import { observePlayerSignal } from "./signalObservation.js";
import {
  buildRemoteReply, qrsStepForNpc, resolveRemoteCopy, resolveRemoteReportCopy, withOperatorProfile,
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
  power: Object.freeze({ keyword: "PWR", aliases: ["PWR", "POWER"], semanticTopic: "POWER", prompt: "PWR? K", example: "PWR 50 W K" }),
  location: Object.freeze({ keyword: "QTH", aliases: ["QTH", "LOC"], semanticTopic: "LOCATION", prompt: "QTH? K", example: "QTH PIXEL CITY K" }),
  weather: Object.freeze({ keyword: "WX", aliases: ["WX", "WEATHER"], semanticTopic: "WEATHER", prompt: "WX? K", example: "WX SUNNY K" }),
  name: Object.freeze({ keyword: "NAME", aliases: ["NAME"], semanticTopic: "NAME", prompt: "NAME? K", example: "NAME SPARK K" }),
  age: Object.freeze({ keyword: "AGE", aliases: ["AGE"], semanticTopic: "AGE", prompt: "AGE? K", example: "AGE 25 K" }),
  rig: Object.freeze({ keyword: "RIG", aliases: ["RIG", "RADIO"], semanticTopic: "RIG", prompt: "RIG? K", example: "RIG MICA 8 K" }),
  antenna: Object.freeze({ keyword: "ANT", aliases: ["ANT", "ANTENNA"], semanticTopic: "ANTENNA", prompt: "ANT? K", example: "ANT DIPOLE K" }),
});

function optionalExchangeSpec(questionId) {
  return OPTIONAL_EXCHANGE_SPECS[questionId] ?? null;
}

function optionalQuestionPrompt(questionId, style = {}) {
  const spec = optionalExchangeSpec(questionId);
  if (!spec) return null;
  if (style.replyStyle === "FRIENDLY") return `PSE ${spec.prompt}`;
  if (style.replyStyle === "REPEAT") return `${spec.keyword} ${spec.prompt}`;
  return spec.prompt;
}

function optionalExchangeMessage(qso, questionId, npcRst) {
  const prompt = optionalQuestionPrompt(questionId, qso.npc?.operatorStyle);
  return prompt ? `${qso.playerCallsign} DE ${qso.npc.callsign} R RST ${npcRst} ${prompt}` : null;
}

function personaFact(style, questionId) {
  const values = {
    power: `MY PWR ${style.personaPowerWatts ?? 10} W`,
    location: `MY QTH ${style.personaQth ?? "PIXEL CITY"}`,
    weather: `MY WX ${style.personaWeather ?? "CLEAR"}`,
    name: `MY NAME ${style.personaName ?? "OP"}`,
    age: `MY AGE ${style.personaAge ?? 40}`,
    rig: `MY RIG ${style.personaRig ?? "HOME RIG"}`,
    antenna: `MY ANT ${style.personaAntenna ?? "DIPOLE"}`,
  };
  return values[questionId] ?? "MY INFO OK";
}

function finalNpcMessage(qso, outcome = null) {
  const style = qso.npc?.operatorStyle ?? {};
  const prefix = `${qso.playerCallsign} DE ${qso.npc.callsign}`;
  const receivedRst = qso.receivedRst ?? "579";
  const topic = optionalExchangeSpec(qso.optionalExchangeQuestion)?.keyword ?? "INFO";
  if (outcome === "answered") {
    const fact = personaFact(style, qso.optionalExchangeQuestion);
    if (style.replyStyle === "TERSE") return `${prefix} R ${fact} 73 SK`;
    if (style.replyStyle === "REPEAT") return `${prefix} TNX ${topic} ${fact} R RST ${receivedRst} 73 SK`;
    if (style.replyStyle === "FRIENDLY") return `${prefix} TNX ${topic} ${fact} FB 73 SK`;
    return `${prefix} TNX ${topic} ${fact} R RST ${receivedRst} 73 SK`;
  }
  if (outcome === "skipped") {
    if (style.replyStyle === "TERSE") return `${prefix} OK 73 SK`;
    if (style.replyStyle === "FRIENDLY") return `${prefix} OK TNX QSO 73 SK`;
    return `${prefix} OK R RST ${receivedRst} 73 SK`;
  }
  return `${prefix} R RST ${receivedRst} 73 SK`;
}

function optionalSemanticMatch(semanticResult, spec, tokens) {
  const explicitTopic = spec.aliases.some((alias) => tokens.includes(alias));
  const trustedContext = semanticResult?.provider === "onnxruntime-node";
  return (explicitTopic || trustedContext)
    && semanticResult?.safeToCommit === true
    && Number(semanticResult?.acts?.PROVIDE ?? 0) >= .55
    && Number(semanticResult?.topics?.[spec.semanticTopic] ?? 0) >= .55;
}

function optionalValueIsPresent(questionId, message, tokens, semanticResult) {
  const compact = normalizeCwText(message).replace(/\s/g, "");
  const slotValues = (semanticResult?.slots ?? [])
    .filter(({ topic }) => topic === optionalExchangeSpec(questionId)?.semanticTopic)
    .map(({ value }) => String(value ?? "").toUpperCase());
  if (questionId === "power") {
    const match = compact.match(/(?:PWR|POWER|MYPWR|MYPOWER)?(\d{1,4})WK$/);
    const value = match?.[1] ?? slotValues.find((candidate) => /^\d{1,4}W$/.test(candidate))?.slice(0, -1);
    return /^\d{1,4}$/.test(String(value ?? "")) && Number(value) >= 1;
  }
  if (questionId === "age") {
    const match = compact.match(/(?:MY)?AGE(\d{1,3})K$/) ?? compact.match(/^(\d{1,3})K$/);
    const value = match?.[1] ?? slotValues.find((candidate) => /^\d{1,3}$/.test(candidate));
    return /^\d{1,3}$/.test(String(value ?? "")) && Number(value) >= 1 && Number(value) <= 120;
  }
  const spec = optionalExchangeSpec(questionId);
  const ignored = new Set(["MY", "IS", "INFO", ...(spec?.aliases ?? [])]);
  return tokens.slice(0, -1).some((token) => !ignored.has(token) && token.length > 0)
    || slotValues.some(Boolean);
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

function redactOptionalSemanticResult(result) {
  if (!result || typeof result !== "object") return result;
  return {
    ...result,
    normalized: "OPTIONAL RESPONSE REDACTED",
    slots: [],
    evidence: {},
  };
}

function redactOptionalSignalObservation(observation) {
  if (!observation || typeof observation !== "object") return observation;
  return {
    ...observation,
    transcript: {
      ...observation.transcript,
      normalized: "OPTIONAL RESPONSE REDACTED",
    },
  };
}

function appendAttempt(qso, message, validation, metrics = {}, assessment = null) {
  const result = validation.valid
    ? (validation.action?.startsWith("repeat") ? "repeat" : validation.action === "transmit" ? "transmitted" : "accepted")
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
    lastSemanticResult: null,
    lastSignalObservation: null,
    lastNpcReception: null,
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

export function validatePlayerMessage(qso, message, { semanticResult = null } = {}) {
  const tokens = tokenized(message);
  if (qso.phase === QSO_PHASES.PLAYER_CQ) {
    const assessment = assessCqTransmission({ message, playerCallsign: qso.playerCallsign });
    if (assessment.intentScore < 55) return { valid: false, reason: "missingCq" };
    if (assessment.deScore < 55) return { valid: false, reason: "missingDe" };
    if (assessment.identityScore < 70) return { valid: false, reason: "missingPlayerCallsign" };
    if (assessment.terminalScore < 100) return { valid: false, reason: "missingK" };
    if (assessment.orderScore < 75) return { valid: false, reason: "wrongCqOrder" };
    return { valid: true, reason: null };
  }
  if (qso.phase === QSO_PHASES.PLAYER_RST_AND_73) {
    if (["QRS K", "QRS PSE K", "PSE QRS K"].includes(tokens.join(" "))) {
      return { valid: true, reason: null, action: "repeat-slower" };
    }
    if (tokens.length === 2 && tokens[0] === "AGN" && tokens[1] === "K") {
      return { valid: true, reason: null, action: "repeat" };
    }
    if (tokens.includes("QRS")) return { valid: false, reason: "invalidQrs" };
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
    if (["QRS K", "QRS PSE K", "PSE QRS K"].includes(tokens.join(" "))) {
      return { valid: true, reason: null, action: "repeat-optional-slower" };
    }
    if (tokens.length === 2 && tokens[0] === "AGN" && tokens[1] === "K") {
      return { valid: true, reason: null, action: "repeat-optional" };
    }
    if (tokens.length === 2 && ((tokens[0] === "SKIP" && tokens[1] === "K") || (tokens[0] === "73" && tokens[1] === "K"))) {
      return { valid: true, reason: null, action: "skip-optional" };
    }
    if (tokens.includes("QRS")) return { valid: false, reason: "invalidQrs" };
    if (tokens.includes("AGN")) return { valid: false, reason: "invalidAgn" };
    if (tokens.includes("SKIP") || tokens.includes("73")) return { valid: false, reason: "invalidOptionalSkip" };
    if (tokens.at(-1) !== "K") return { valid: false, reason: "missingK" };
    const spec = optionalExchangeSpec(qso.optionalExchangeQuestion);
    const payload = tokens.slice(1, -1);
    const legacyForm = Boolean(spec && tokens[0] === spec.keyword && payload.length > 0);
    const semanticForm = Boolean(spec && optionalSemanticMatch(semanticResult, spec, tokens));
    if (!spec || (!legacyForm && !semanticForm)
      || !optionalValueIsPresent(qso.optionalExchangeQuestion, message, tokens, semanticResult)) {
      return { valid: false, reason: "invalidOptionalAnswer" };
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
  semanticResult: providedSemanticResult = null,
} = {}) {
  const semanticResult = semanticResultFromProvider(providedSemanticResult) ?? interpretCwTraffic({
    message,
    phase: qso.phase,
    selfCallsign: qso.playerCallsign,
    peerCallsign: qso.npc?.callsign,
    pendingQuestion: qso.optionalExchangeQuestion ?? "NONE",
    wpm,
  });
  let signalObservation = observePlayerSignal({
    message,
    wpm,
    accuracy,
    rhythm,
    semanticResult,
  });
  const containsPrivateOptionalTraffic = qso.phase === QSO_PHASES.PLAYER_OPTIONAL_ANSWER;
  qso = {
    ...qso,
    lastSemanticResult: containsPrivateOptionalTraffic
      ? redactOptionalSemanticResult(semanticResult) : semanticResult,
    lastSignalObservation: containsPrivateOptionalTraffic
      ? redactOptionalSignalObservation(signalObservation) : signalObservation,
    lastNpcReception: null,
  };
  const validation = validatePlayerMessage(qso, message, { semanticResult });
  if (qso.phase === QSO_PHASES.PLAYER_CQ) {
    const cqAssessment = assessCqTransmission({
      message,
      playerCallsign: qso.playerCallsign,
      wpm,
      rhythm,
    });
    signalObservation = observePlayerSignal({
      message,
      wpm,
      accuracy: accuracy ?? cqAssessment.editScore,
      rhythm,
      semanticResult,
    });
    qso = { ...qso, lastSignalObservation: signalObservation };
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
    && !["repeat-optional", "repeat-optional-slower", "skip-optional"].includes(validation.action)
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
  if (["repeat", "repeat-slower"].includes(validation.action)) {
    const currentReplyWpm = Math.round(Math.min(60, Math.max(5, Number(qso.replyWpm ?? qso.npc.wpm) || 18)));
    const nextReplyWpm = validation.action === "repeat-slower"
      ? Math.max(5, currentReplyWpm - qrsStepForNpc(qso.npc))
      : currentReplyWpm;
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
      replyWpm: nextReplyWpm,
      channelNotice: validation.action === "repeat-slower"
        ? (nextReplyWpm === currentReplyWpm ? "qrsMinimum" : "qrsRepeat")
        : null,
    };
  }
  if (["repeat-optional", "repeat-optional-slower"].includes(validation.action)) {
    const currentReplyWpm = Math.round(Math.min(60, Math.max(5, Number(qso.replyWpm ?? qso.npc.wpm) || 18)));
    const nextReplyWpm = validation.action === "repeat-optional-slower"
      ? Math.max(5, currentReplyWpm - qrsStepForNpc(qso.npc))
      : currentReplyWpm;
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
      replyWpm: nextReplyWpm,
      channelNotice: validation.action === "repeat-optional-slower"
        ? (nextReplyWpm === currentReplyWpm ? "qrsMinimum" : "qrsRepeat")
        : null,
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
    semanticResult,
    signalObservation,
    queryCount: reportCopyQueries,
  });
  const resolvedAttemptHistory = annotateLatestRemoteAttempt(attemptHistory, decision);
  if (decision.outcome === "query") {
    return {
      ...qso,
      phase: QSO_PHASES.NPC_REPLY,
      npc: decision.npc,
      lastNpcReception: decision,
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
      lastNpcReception: decision,
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
  const optionalMessage = optionalQuestion
    ? optionalExchangeMessage({ ...qso, npc: decision.npc }, optionalQuestion, npcRst)
    : null;
  return {
    ...qso,
    phase: optionalQuestion ? QSO_PHASES.NPC_OPTIONAL_QUERY : QSO_PHASES.NPC_73_AND_SK,
    npc: decision.npc,
    lastNpcReception: decision,
    attempts: 0,
    attemptHistory: resolvedAttemptHistory,
    lastError: null,
    sentRst: validation.rst,
    receivedRst: npcRst,
    optionalExchangeQuestion: optionalQuestion,
    optionalExchangeOutcome: optionalQuestion ? "pending" : "not-offered",
    optionalExchangeMessage: optionalMessage,
    npcMessage: optionalQuestion
      ? optionalMessage
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
    semanticResult: qso.lastSemanticResult,
    signalObservation: qso.lastSignalObservation,
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
      lastNpcReception: decision,
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
      lastNpcReception: decision,
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
      lastNpcReception: decision,
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
    lastNpcReception: decision,
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
