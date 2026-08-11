import { clamp } from "../cw/morse.js";
import { signalObservationFromCqAssessment } from "./signalObservation.js";

export const OPERATOR_PROFILE_SCHEMA_VERSION = 2;
export const NPC_RECEPTION_SCHEMA_VERSION = 1;
export const OPTIONAL_EXCHANGE_QUESTION_IDS = Object.freeze([
  "power", "location", "weather", "name", "age",
]);

function profile(candidate) {
  return Object.freeze(candidate);
}

export const OPERATOR_PROFILES = Object.freeze({
  "careful-beginner": profile({
    archetype: "careful-beginner", rxSkill: 58, txAccuracy: 72, preferredWpm: 10,
    speedTolerance: 48, patience: 90, procedureStrictness: 25, responseTempo: 35,
    fistStability: 55, verbosity: 78, initiative: 45, queryStyle: "AGN",
    replyStyle: "REPEAT", lowCopyAction: "GENERAL_CQ", optionalQuestion: null,
  }),
  "patient-veteran": profile({
    archetype: "patient-veteran", rxSkill: 94, txAccuracy: 97, preferredWpm: 17,
    speedTolerance: 88, patience: 96, procedureStrictness: 40, responseTempo: 55,
    fistStability: 92, verbosity: 70, initiative: 55, queryStyle: "AGN",
    replyStyle: "REPEAT", lowCopyAction: "GENERAL_CQ", optionalQuestion: "location",
  }),
  "contest-sprinter": profile({
    archetype: "contest-sprinter", rxSkill: 98, txAccuracy: 99, preferredWpm: 28,
    speedTolerance: 72, patience: 28, procedureStrictness: 82, responseTempo: 96,
    fistStability: 98, verbosity: 10, initiative: 75, queryStyle: "QUESTION",
    replyStyle: "TERSE", lowCopyAction: "SILENCE", optionalQuestion: null,
  }),
  "youth-club": profile({
    archetype: "youth-club", rxSkill: 74, txAccuracy: 86, preferredWpm: 15,
    speedTolerance: 70, patience: 84, procedureStrictness: 35, responseTempo: 75,
    fistStability: 76, verbosity: 65, initiative: 88, queryStyle: "AGN",
    replyStyle: "FRIENDLY", lowCopyAction: "GENERAL_CQ", optionalQuestion: "age",
  }),
  "traditional-fist": profile({
    archetype: "traditional-fist", rxSkill: 90, txAccuracy: 88, preferredWpm: 13,
    speedTolerance: 82, patience: 78, procedureStrictness: 70, responseTempo: 45,
    fistStability: 62, verbosity: 55, initiative: 62, queryStyle: "QRS",
    replyStyle: "STANDARD", lowCopyAction: "GENERAL_CQ", optionalQuestion: "power",
  }),
  "weak-signal-listener": profile({
    archetype: "weak-signal-listener", rxSkill: 96, txAccuracy: 95, preferredWpm: 16,
    speedTolerance: 90, patience: 88, procedureStrictness: 55, responseTempo: 25,
    fistStability: 90, verbosity: 40, initiative: 35, queryStyle: "QRZ",
    replyStyle: "STANDARD", lowCopyAction: "SILENCE", optionalQuestion: "weather",
  }),
  "friendly-ragchewer": profile({
    archetype: "friendly-ragchewer", rxSkill: 80, txAccuracy: 90, preferredWpm: 18,
    speedTolerance: 65, patience: 74, procedureStrictness: 20, responseTempo: 58,
    fistStability: 85, verbosity: 95, initiative: 70, queryStyle: "AGN",
    replyStyle: "FRIENDLY", lowCopyAction: "GENERAL_CQ", optionalQuestion: "name",
  }),
});

// Explicit fictional personas only; no value is read from the OS, browser, or user account.
export const NPC_OPERATOR_ASSIGNMENTS = Object.freeze({
  SIM7QX: Object.freeze({ profileId: "careful-beginner", personaName: "RIN", personaAge: 24 }),
  SIM3RA: Object.freeze({ profileId: "patient-veteran", personaName: "MORSE", personaAge: 68 }),
  SIM9AK: Object.freeze({ profileId: "contest-sprinter", personaName: "MAX", personaAge: 31 }),
  SIM5TU: Object.freeze({ profileId: "traditional-fist", personaName: "WANG", personaAge: 52 }),
  SIM2DX: Object.freeze({ profileId: "weak-signal-listener", personaName: "NOVA", personaAge: 44 }),
  SIM8CW: Object.freeze({ profileId: "friendly-ragchewer", personaName: "DIEGO", personaAge: 37 }),
  SIM6JP: Object.freeze({ profileId: "youth-club", personaName: "SORA", personaAge: 19 }),
  SIM4NZ: Object.freeze({ profileId: "patient-veteran", preferredWpm: 17, optionalQuestion: null, personaName: "LEE", personaAge: 63 }),
  SIM1IN: Object.freeze({ profileId: "careful-beginner", preferredWpm: 12, personaName: "KAI", personaAge: 27 }),
  SIM0BR: Object.freeze({ profileId: "friendly-ragchewer", preferredWpm: 19, optionalQuestion: null, personaName: "LUNA", personaAge: 41 }),
});

export const DEFAULT_OPERATOR_PROFILE_ID = "patient-veteran";

function hashString(value) {
  let hash = 2166136261;
  for (const character of String(value)) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function stableUnit(seed) {
  return hashString(seed) / 0xffffffff;
}

const CHANNEL_COPY_QUALITY = Object.freeze([8, 30, 55, 78, 95]);
const CHANNEL_FADE_BASE = Object.freeze([18, 7, 2, 0, 0]);
const CHANNEL_FADE_SPAN = Object.freeze([12, 9, 6, 0.5, 0.2]);

function channelReception(npc, seed, stage) {
  const level = Math.round(clamp(Number(npc?.finalLevel) || 0, 0, 4));
  const fadePenalty = CHANNEL_FADE_BASE[level]
    + stableUnit(`${seed}:${npc?.callsign ?? "UNKNOWN"}:${stage}:channel-fade`) * CHANNEL_FADE_SPAN[level];
  return {
    level,
    quality: CHANNEL_COPY_QUALITY[level],
    fadePenalty: Number(fadePenalty.toFixed(1)),
  };
}

export function channelReceptionForNpc(npc, seed = "channel", stage = "cq") {
  return Object.freeze(channelReception(npc, seed, stage));
}

export function resolveOperatorProfile(npc = {}) {
  const callsign = String(npc.callsign ?? "").toUpperCase();
  const assignment = NPC_OPERATOR_ASSIGNMENTS[callsign] ?? {};
  const profileId = npc.operatorProfileId ?? assignment.profileId ?? DEFAULT_OPERATOR_PROFILE_ID;
  const base = OPERATOR_PROFILES[profileId] ?? OPERATOR_PROFILES[DEFAULT_OPERATOR_PROFILE_ID];
  const resolved = {
    ...base,
    ...assignment,
    ...(npc.operatorOverrides ?? {}),
    profileId: OPERATOR_PROFILES[profileId] ? profileId : DEFAULT_OPERATOR_PROFILE_ID,
    revision: OPERATOR_PROFILE_SCHEMA_VERSION,
  };
  return {
    ...resolved,
    optionalQuestion: OPTIONAL_EXCHANGE_QUESTION_IDS.includes(resolved.optionalQuestion)
      ? resolved.optionalQuestion
      : null,
    personaName: String(resolved.personaName ?? "OP").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 12) || "OP",
    personaAge: Math.min(120, Math.max(1, Math.floor(Number(resolved.personaAge) || 40))),
  };
}

export function qrsStepForNpc(npc = {}) {
  const style = npc?.operatorStyle ?? resolveOperatorProfile(npc);
  const patience = Number(style?.patience);
  if (Number.isFinite(patience) && patience >= 85) return 4;
  if (Number.isFinite(patience) && patience >= 60) return 3;
  return 2;
}

export function withOperatorProfile(npc) {
  if (!npc?.callsign) return npc;
  const operatorStyle = resolveOperatorProfile(npc);
  return {
    ...npc,
    operatorProfileId: operatorStyle.profileId,
    operatorProfileRevision: operatorStyle.revision,
    operatorStyle,
    wpm: Math.round(clamp(Number(operatorStyle.preferredWpm) || Number(npc.wpm) || 18, 5, 60)),
  };
}

function responseMessage(disposition, npc, playerCallsign, style, assessment) {
  if (disposition === "query") {
    if (assessment.speedMatch < 55) {
      if (style.queryStyle === "QUESTION") return "QRS?";
      if (style.queryStyle === "QRS") return "QRS? K";
      return style.verbosity >= 60 ? "QRS PSE K" : "QRS? K";
    }
    if (assessment.identityEditDistance > 0) {
      if (style.queryStyle === "QUESTION") return "?";
      if (style.queryStyle === "QRZ") return "QRZ? K";
      return style.verbosity >= 60 ? "UR CALL? K" : "QRZ? K";
    }
    if (style.queryStyle === "QUESTION") return "?";
    if (style.queryStyle === "QRS") return "PSE AGN K";
    if (style.queryStyle === "QRZ") return "AGN? K";
    return style.verbosity >= 70 ? "AGN AGN? K" : "AGN? K";
  }
  if (disposition === "general") return `CQ CQ DE ${npc.callsign} ${npc.callsign} K`;
  const correction = assessment.selfCorrection ? "T HH " : "";
  if (style.replyStyle === "TERSE") return `${correction}${playerCallsign} DE ${npc.callsign} K`;
  if (style.replyStyle === "REPEAT") return `${correction}${playerCallsign} ${playerCallsign} DE ${npc.callsign} ${npc.callsign} K`;
  if (style.replyStyle === "FRIENDLY") {
    const playerPart = style.verbosity >= 75 ? `${playerCallsign} ${playerCallsign}` : playerCallsign;
    const npcPart = style.verbosity >= 85 ? `${npc.callsign} ${npc.callsign}` : npc.callsign;
    return `${correction}${playerPart} DE ${npcPart} TNX CALL K`;
  }
  const npcPart = style.verbosity >= 50 ? `${npc.callsign} ${npc.callsign}` : npc.callsign;
  return `${correction}${playerCallsign} DE ${npcPart} K`;
}

export function responseDelayForNpc(npc, seed = "response") {
  const style = resolveOperatorProfile(npc);
  return Math.round(700 + (100 - style.responseTempo) * 25 + stableUnit(`${seed}:delay`) * 700);
}

function semanticInput(semanticResult, assessment = {}) {
  if (semanticResult?.schemaVersion) return semanticResult;
  return {
    schemaVersion: null,
    provider: "legacy-cq-assessment",
    normalized: assessment?.normalized ?? "",
    acts: { CQ: Number(assessment?.intentScore ?? 0) / 100 },
    topics: { CALLSIGN: Number(assessment?.identityScore ?? 0) / 100 },
    procedure: { score: Number(assessment?.orderScore ?? 0) },
    interpretability: Number(assessment?.semanticQuality ?? assessment?.quality ?? 0),
    safeToCommit: assessment?.recognizable === true,
    evidence: {
      intentScore: Number(assessment?.intentScore ?? 0),
      identityScore: Number(assessment?.identityScore ?? 0),
      identityEditDistance: Number(assessment?.identityEditDistance ?? 0),
      recognizable: assessment?.recognizable === true,
    },
  };
}

export function resolveRemoteCopy({
  assessment, semanticResult = null, signalObservation = null,
  npc, playerCallsign = "", seed = "copy", queryCount = 0,
} = {}) {
  const enrichedNpc = withOperatorProfile(npc);
  const style = enrichedNpc.operatorStyle;
  const semantics = semanticInput(semanticResult, assessment);
  const observation = signalObservation ?? signalObservationFromCqAssessment(assessment);
  const safeQueryCount = Number.isSafeInteger(queryCount) && queryCount >= 0 ? queryCount : 0;
  const channel = channelReception(enrichedNpc, seed, safeQueryCount ? `cq:${safeQueryCount}` : "cq");
  const channelQuality = channel.quality;
  const observedWpm = observation?.timing?.wpm;
  const playerWpm = observedWpm === null || observedWpm === undefined || observedWpm === ""
    ? null
    : Number(observedWpm);
  const comfortableBand = 3 + .08 * style.speedTolerance;
  const excessWpm = Number.isFinite(playerWpm)
    ? Math.max(0, Math.abs(playerWpm - style.preferredWpm) - comfortableBand)
    : 0;
  const speedMatch = clamp(100 - excessWpm * 8, 0, 100);
  const speedPenalty = (100 - speedMatch) * (.1 + .0015 * (100 - style.rxSkill));
  const procedurePenalty = Math.max(0, 100 - Number(semantics?.procedure?.score ?? 0))
    * (.08 + .22 * style.procedureStrictness / 100);
  const jitter = (stableUnit(`${seed}:${semantics?.normalized ?? ""}:${queryCount}`) - .5) * 6;
  const semanticScore = transmissionMetric(semantics?.interpretability, 0);
  const rhythmScore = transmissionMetric(observation?.timing?.rhythmScore, 50);
  const intentScore = transmissionMetric(semantics?.evidence?.intentScore, (semantics?.acts?.CQ ?? 0) * 100);
  const identityScore = transmissionMetric(semantics?.evidence?.identityScore, (semantics?.topics?.CALLSIGN ?? 0) * 100);
  const identityEditDistance = Math.max(0, Number(semantics?.evidence?.identityEditDistance ?? 0));
  let copyScore = (
    .59 * semanticScore
    + .03 * rhythmScore
    + .18 * style.rxSkill
    + .14 * channelQuality
    - procedurePenalty
    - speedPenalty
    - channel.fadePenalty
    + jitter
  );
  copyScore = clamp(copyScore, 0, 100);

  let outcome = copyScore >= 68 ? "copied" : copyScore >= 42 ? "query" : "unreadable";
  if (intentScore < 55 && outcome === "copied") outcome = "query";
  if (identityEditDistance > 0 && outcome === "copied") outcome = "query";
  if (speedMatch < 35 && style.rxSkill < 85 && outcome === "copied") outcome = "query";
  if (intentScore < 25 && identityScore < 25) outcome = "unreadable";
  const maxQueries = style.patience >= 90 ? 3 : style.patience >= 60 ? 2 : 1;
  if (outcome === "query" && queryCount >= maxQueries) outcome = "unreadable";

  let disposition = outcome === "copied" ? "copy" : outcome;
  if (outcome === "unreadable") {
    const generalChance = .15 + .0075 * style.initiative;
    const generalRoll = stableUnit(`${seed}:initiative:${queryCount}`);
    disposition = style.lowCopyAction === "GENERAL_CQ"
      && semanticScore >= 12
      && generalRoll < generalChance
      ? "general"
      : "silence";
  }
  const variation = Math.round((100 - style.fistStability) / 8);
  const wpmOffset = variation ? Math.round((stableUnit(`${seed}:wpm`) * 2 - 1) * variation) : 0;
  const replyWpm = Math.round(clamp(style.preferredWpm + wpmOffset, 5, 60));
  const selfCorrection = disposition === "copy"
    && stableUnit(`${seed}:tx-error`) < (100 - style.txAccuracy) / 100;

  const reasonCodes = [];
  if (speedMatch < 55) reasonCodes.push("speedOutsideComfortBand");
  if (identityEditDistance > 0) reasonCodes.push("callsignUncertain");
  if (intentScore < 55) reasonCodes.push("intentUncertain");
  if (procedurePenalty >= 8) reasonCodes.push("procedureMismatch");
  if (channel.level === 2) reasonCodes.push("marginalChannel");
  if (channelQuality < 55) reasonCodes.push("weakChannel");
  if (channel.fadePenalty >= 8) reasonCodes.push("deepFade");

  const decision = {
    schemaVersion: NPC_RECEPTION_SCHEMA_VERSION,
    outcome,
    disposition,
    copyScore: Number(copyScore.toFixed(1)),
    speedMatch: Math.round(speedMatch),
    speedPenalty: Number(speedPenalty.toFixed(1)),
    channelLevel: channel.level,
    channelQuality,
    channelFadePenalty: channel.fadePenalty,
    semanticInterpretability: Number(semanticScore.toFixed(1)),
    identityScore,
    identityEditDistance,
    reasonCodes,
    selfCorrection,
    replyWpm,
    responseDelayMs: responseDelayForNpc(enrichedNpc, seed),
    operatorProfileId: style.profileId,
    operatorProfileRevision: style.revision,
    semanticResultSchemaVersion: semantics?.schemaVersion ?? null,
    signalObservationSchemaVersion: observation?.schemaVersion ?? null,
    maxQueries,
    npc: enrichedNpc,
  };
  return {
    ...decision,
    replyMessage: disposition === "silence"
      ? null
      : responseMessage(disposition, enrichedNpc, playerCallsign, style, decision),
  };
}

function transmissionMetric(value, fallback = 100) {
  if (value === null || value === undefined || value === "") return fallback;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? clamp(numeric, 0, 100) : fallback;
}

export function resolveRemoteReportCopy({
  npc,
  wpm = null,
  accuracy = null,
  rhythm = null,
  semanticResult = null,
  signalObservation = null,
  seed = "report-copy",
  queryCount = 0,
} = {}) {
  const enrichedNpc = npc?.operatorStyle ? npc : withOperatorProfile(npc);
  const style = enrichedNpc.operatorStyle;
  const reportQueryCount = Number.isSafeInteger(queryCount) && queryCount >= 0 ? queryCount : 0;
  const channel = channelReception(enrichedNpc, seed, reportQueryCount ? `report:${reportQueryCount}` : "report");
  const channelQuality = channel.quality;
  const observedWpm = signalObservation?.timing?.wpm ?? wpm;
  const playerWpm = observedWpm === null || observedWpm === undefined || observedWpm === ""
    ? null
    : Number(observedWpm);
  const comfortableBand = 3 + .08 * style.speedTolerance;
  const excessWpm = Number.isFinite(playerWpm)
    ? Math.max(0, Math.abs(playerWpm - style.preferredWpm) - comfortableBand)
    : 0;
  const speedMatch = clamp(100 - excessWpm * 8, 0, 100);
  const speedPenalty = (100 - speedMatch) * (.1 + .0015 * (100 - style.rxSkill));
  const accuracyScore = transmissionMetric(signalObservation?.transcript?.decoderAccuracy ?? accuracy);
  const rhythmScore = transmissionMetric(signalObservation?.timing?.rhythmScore ?? rhythm);
  const hasSemanticResult = Number.isFinite(Number(semanticResult?.schemaVersion));
  const semanticScore = hasSemanticResult
    ? transmissionMetric(semanticResult?.interpretability, 0)
    : 100;
  const safeQueryCount = Number.isSafeInteger(queryCount) && queryCount >= 0 ? queryCount : 0;
  const jitter = (stableUnit(`${seed}:${enrichedNpc.callsign}:${safeQueryCount}:report`) - .5) * 6;
  let copyScore = (
    (hasSemanticResult ? .36 : .5) * accuracyScore
    + (hasSemanticResult ? .14 : 0) * semanticScore
    + .16 * rhythmScore
    + .2 * style.rxSkill
    + .14 * channelQuality
    - speedPenalty
    - channel.fadePenalty
    + jitter
  );
  copyScore = clamp(copyScore, 0, 100);

  let outcome = copyScore >= 68 ? "copied" : copyScore >= 42 ? "query" : "unreadable";
  if (speedMatch < 35 && style.rxSkill < 85 && outcome === "copied") outcome = "query";
  if (hasSemanticResult && semanticScore < 35 && outcome === "copied") outcome = "query";
  const replyMessage = outcome === "query"
    ? (speedMatch < 55 ? "QRS? K" : "AGN? K")
    : null;
  const reasonCodes = [];
  if (speedMatch < 55) reasonCodes.push("speedOutsideComfortBand");
  if (semanticScore < 55) reasonCodes.push("meaningUncertain");
  if (accuracyScore < 60) reasonCodes.push("decodeErrors");
  if (channel.level === 2) reasonCodes.push("marginalChannel");
  if (channelQuality < 55) reasonCodes.push("weakChannel");
  if (channel.fadePenalty >= 8) reasonCodes.push("deepFade");

  return {
    schemaVersion: NPC_RECEPTION_SCHEMA_VERSION,
    outcome,
    disposition: outcome === "query" ? "report-query" : outcome,
    copyScore: Number(copyScore.toFixed(1)),
    speedMatch: Math.round(speedMatch),
    speedPenalty: Number(speedPenalty.toFixed(1)),
    channelLevel: channel.level,
    channelQuality,
    channelFadePenalty: channel.fadePenalty,
    semanticInterpretability: Number(semanticScore.toFixed(1)),
    reasonCodes,
    replyMessage,
    operatorProfileId: style.profileId,
    operatorProfileRevision: style.revision,
    semanticResultSchemaVersion: semanticResult?.schemaVersion ?? null,
    signalObservationSchemaVersion: signalObservation?.schemaVersion ?? null,
    npc: enrichedNpc,
  };
}

export function buildRemoteReply(decision, playerCallsign) {
  if (!decision || decision.disposition === "silence") return null;
  return responseMessage(
    decision.disposition,
    decision.npc,
    playerCallsign,
    decision.npc.operatorStyle,
    decision,
  );
}
