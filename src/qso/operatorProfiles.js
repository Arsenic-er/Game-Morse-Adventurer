import { clamp } from "../cw/morse.js";

export const OPERATOR_PROFILE_SCHEMA_VERSION = 1;

function profile(candidate) {
  return Object.freeze(candidate);
}

export const OPERATOR_PROFILES = Object.freeze({
  "careful-beginner": profile({
    archetype: "careful-beginner", rxSkill: 58, txAccuracy: 72, preferredWpm: 10,
    speedTolerance: 48, patience: 90, procedureStrictness: 25, responseTempo: 35,
    fistStability: 55, verbosity: 78, initiative: 45, queryStyle: "AGN",
    replyStyle: "REPEAT", lowCopyAction: "GENERAL_CQ",
  }),
  "patient-veteran": profile({
    archetype: "patient-veteran", rxSkill: 94, txAccuracy: 97, preferredWpm: 17,
    speedTolerance: 88, patience: 96, procedureStrictness: 40, responseTempo: 55,
    fistStability: 92, verbosity: 70, initiative: 55, queryStyle: "AGN",
    replyStyle: "REPEAT", lowCopyAction: "GENERAL_CQ",
  }),
  "contest-sprinter": profile({
    archetype: "contest-sprinter", rxSkill: 98, txAccuracy: 99, preferredWpm: 28,
    speedTolerance: 72, patience: 28, procedureStrictness: 82, responseTempo: 96,
    fistStability: 98, verbosity: 10, initiative: 75, queryStyle: "QUESTION",
    replyStyle: "TERSE", lowCopyAction: "SILENCE",
  }),
  "youth-club": profile({
    archetype: "youth-club", rxSkill: 74, txAccuracy: 86, preferredWpm: 15,
    speedTolerance: 70, patience: 84, procedureStrictness: 35, responseTempo: 75,
    fistStability: 76, verbosity: 65, initiative: 88, queryStyle: "AGN",
    replyStyle: "FRIENDLY", lowCopyAction: "GENERAL_CQ",
  }),
  "traditional-fist": profile({
    archetype: "traditional-fist", rxSkill: 90, txAccuracy: 88, preferredWpm: 13,
    speedTolerance: 82, patience: 78, procedureStrictness: 70, responseTempo: 45,
    fistStability: 62, verbosity: 55, initiative: 62, queryStyle: "QRS",
    replyStyle: "STANDARD", lowCopyAction: "GENERAL_CQ",
  }),
  "weak-signal-listener": profile({
    archetype: "weak-signal-listener", rxSkill: 96, txAccuracy: 95, preferredWpm: 16,
    speedTolerance: 90, patience: 88, procedureStrictness: 55, responseTempo: 25,
    fistStability: 90, verbosity: 40, initiative: 35, queryStyle: "QRZ",
    replyStyle: "STANDARD", lowCopyAction: "SILENCE",
  }),
  "friendly-ragchewer": profile({
    archetype: "friendly-ragchewer", rxSkill: 80, txAccuracy: 90, preferredWpm: 18,
    speedTolerance: 65, patience: 74, procedureStrictness: 20, responseTempo: 58,
    fistStability: 85, verbosity: 95, initiative: 70, queryStyle: "AGN",
    replyStyle: "FRIENDLY", lowCopyAction: "GENERAL_CQ",
  }),
});

export const NPC_OPERATOR_ASSIGNMENTS = Object.freeze({
  SIM7QX: Object.freeze({ profileId: "careful-beginner" }),
  SIM3RA: Object.freeze({ profileId: "patient-veteran" }),
  SIM9AK: Object.freeze({ profileId: "contest-sprinter" }),
  SIM5TU: Object.freeze({ profileId: "traditional-fist" }),
  SIM2DX: Object.freeze({ profileId: "weak-signal-listener" }),
  SIM8CW: Object.freeze({ profileId: "friendly-ragchewer" }),
  SIM6JP: Object.freeze({ profileId: "youth-club" }),
  SIM4NZ: Object.freeze({ profileId: "patient-veteran", preferredWpm: 17 }),
  SIM1IN: Object.freeze({ profileId: "careful-beginner", preferredWpm: 12 }),
  SIM0BR: Object.freeze({ profileId: "friendly-ragchewer", preferredWpm: 19 }),
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

export function resolveOperatorProfile(npc = {}) {
  const callsign = String(npc.callsign ?? "").toUpperCase();
  const assignment = NPC_OPERATOR_ASSIGNMENTS[callsign] ?? {};
  const profileId = npc.operatorProfileId ?? assignment.profileId ?? DEFAULT_OPERATOR_PROFILE_ID;
  const base = OPERATOR_PROFILES[profileId] ?? OPERATOR_PROFILES[DEFAULT_OPERATOR_PROFILE_ID];
  return {
    ...base,
    ...assignment,
    ...(npc.operatorOverrides ?? {}),
    profileId: OPERATOR_PROFILES[profileId] ? profileId : DEFAULT_OPERATOR_PROFILE_ID,
    revision: OPERATOR_PROFILE_SCHEMA_VERSION,
  };
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

export function resolveRemoteCopy({
  assessment, npc, playerCallsign = "", seed = "copy", queryCount = 0,
} = {}) {
  const enrichedNpc = withOperatorProfile(npc);
  const style = enrichedNpc.operatorStyle;
  const channelQuality = [8, 30, 55, 78, 95][Math.round(clamp(Number(enrichedNpc.finalLevel) || 0, 0, 4))];
  const playerWpm = assessment?.wpm === null || assessment?.wpm === undefined || assessment?.wpm === ""
    ? null
    : Number(assessment.wpm);
  const comfortableBand = 3 + .08 * style.speedTolerance;
  const excessWpm = Number.isFinite(playerWpm)
    ? Math.max(0, Math.abs(playerWpm - style.preferredWpm) - comfortableBand)
    : 0;
  const speedMatch = clamp(100 - excessWpm * 8, 0, 100);
  const speedPenalty = (100 - speedMatch) * (.1 + .0015 * (100 - style.rxSkill));
  const procedurePenalty = Math.max(0, 100 - Number(assessment?.orderScore ?? 0))
    * (.08 + .22 * style.procedureStrictness / 100);
  const jitter = (stableUnit(`${seed}:${assessment?.normalized ?? ""}:${queryCount}`) - .5) * 6;
  let copyScore = (
    .62 * Number(assessment?.quality ?? 0)
    + .18 * style.rxSkill
    + .14 * channelQuality
    - procedurePenalty
    - speedPenalty
    + jitter
  );
  copyScore = clamp(copyScore, 0, 100);

  let outcome = copyScore >= 68 ? "copied" : copyScore >= 42 ? "query" : "unreadable";
  if ((assessment?.intentScore ?? 0) < 55 && outcome === "copied") outcome = "query";
  if ((assessment?.identityEditDistance ?? 1) > 0 && outcome === "copied") outcome = "query";
  if (speedMatch < 35 && style.rxSkill < 85 && outcome === "copied") outcome = "query";
  if ((assessment?.intentScore ?? 0) < 25 && (assessment?.identityScore ?? 0) < 25) outcome = "unreadable";
  const maxQueries = style.patience >= 90 ? 3 : style.patience >= 60 ? 2 : 1;
  if (outcome === "query" && queryCount >= maxQueries) outcome = "unreadable";

  let disposition = outcome === "copied" ? "copy" : outcome;
  if (outcome === "unreadable") {
    const generalChance = .15 + .0075 * style.initiative;
    const generalRoll = stableUnit(`${seed}:initiative:${queryCount}`);
    disposition = style.lowCopyAction === "GENERAL_CQ"
      && Number(assessment?.quality ?? 0) >= 12
      && generalRoll < generalChance
      ? "general"
      : "silence";
  }
  const variation = Math.round((100 - style.fistStability) / 8);
  const wpmOffset = variation ? Math.round((stableUnit(`${seed}:wpm`) * 2 - 1) * variation) : 0;
  const replyWpm = Math.round(clamp(style.preferredWpm + wpmOffset, 5, 60));
  const selfCorrection = disposition === "copy"
    && stableUnit(`${seed}:tx-error`) < (100 - style.txAccuracy) / 100;

  const decision = {
    outcome,
    disposition,
    copyScore: Number(copyScore.toFixed(1)),
    speedMatch: Math.round(speedMatch),
    speedPenalty: Number(speedPenalty.toFixed(1)),
    identityScore: Number(assessment?.identityScore ?? 0),
    identityEditDistance: Number(assessment?.identityEditDistance ?? 0),
    selfCorrection,
    replyWpm,
    responseDelayMs: responseDelayForNpc(enrichedNpc, seed),
    operatorProfileId: style.profileId,
    operatorProfileRevision: style.revision,
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
  seed = "report-copy",
  queryCount = 0,
} = {}) {
  const enrichedNpc = npc?.operatorStyle ? npc : withOperatorProfile(npc);
  const style = enrichedNpc.operatorStyle;
  const channelQuality = [8, 30, 55, 78, 95][Math.round(clamp(Number(enrichedNpc.finalLevel) || 0, 0, 4))];
  const playerWpm = wpm === null || wpm === undefined || wpm === "" ? null : Number(wpm);
  const comfortableBand = 3 + .08 * style.speedTolerance;
  const excessWpm = Number.isFinite(playerWpm)
    ? Math.max(0, Math.abs(playerWpm - style.preferredWpm) - comfortableBand)
    : 0;
  const speedMatch = clamp(100 - excessWpm * 8, 0, 100);
  const speedPenalty = (100 - speedMatch) * (.1 + .0015 * (100 - style.rxSkill));
  const accuracyScore = transmissionMetric(accuracy);
  const rhythmScore = transmissionMetric(rhythm);
  const safeQueryCount = Number.isSafeInteger(queryCount) && queryCount >= 0 ? queryCount : 0;
  const jitter = (stableUnit(`${seed}:${enrichedNpc.callsign}:${safeQueryCount}:report`) - .5) * 6;
  let copyScore = (
    .5 * accuracyScore
    + .16 * rhythmScore
    + .2 * style.rxSkill
    + .14 * channelQuality
    - speedPenalty
    + jitter
  );
  copyScore = clamp(copyScore, 0, 100);

  let outcome = copyScore >= 68 ? "copied" : copyScore >= 42 ? "query" : "unreadable";
  if (speedMatch < 35 && style.rxSkill < 85 && outcome === "copied") outcome = "query";
  const replyMessage = outcome === "query"
    ? (speedMatch < 55 ? "QRS? K" : "AGN? K")
    : null;

  return {
    outcome,
    disposition: outcome === "query" ? "report-query" : outcome,
    copyScore: Number(copyScore.toFixed(1)),
    speedMatch: Math.round(speedMatch),
    speedPenalty: Number(speedPenalty.toFixed(1)),
    replyMessage,
    operatorProfileId: style.profileId,
    operatorProfileRevision: style.revision,
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
