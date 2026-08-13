import { clamp, normalizeCwText } from "../cw/morse.js";
import { assessCqTransmission } from "./cqAssessment.js";

export const SEMANTIC_RESULT_SCHEMA_VERSION = 1;
export const SEMANTIC_MODEL_CONTRACT_VERSION = "qso-semantic-runtime-4";

export const TRAFFIC_ACTS = Object.freeze([
  "CQ", "DIRECTED", "REPLY", "IDENTIFY", "ASK", "PROVIDE", "REPORT",
  "ACK", "CONFIRM", "CORRECTION", "REPEAT_REQUEST", "SPEED_REQUEST",
  "GREETING", "THANKS", "HANDOVER", "SIGNOFF",
]);

export const TRAFFIC_TOPICS = Object.freeze([
  "CALLSIGN", "NAME", "AGE", "LOCATION", "WEATHER",
  "POWER", "RIG", "ANTENNA", "RST", "REGION", "CQ_SCOPE",
]);

export const PROCEDURE_GRADES = Object.freeze([
  "CANONICAL", "INTELLIGIBLE_NONCANONICAL", "INCOMPLETE", "AMBIGUOUS", "IRRELEVANT",
]);

export const TRAFFIC_REGISTERS = Object.freeze([
  "CW_PROCEDURAL", "CW_ABBREVIATED", "NATURAL_TEXT", "MIXED", "NOISE_UNKNOWN",
]);

const TOPIC_KEYWORDS = Object.freeze({
  NAME: ["NAME"],
  AGE: ["AGE"],
  LOCATION: ["QTH", "LOC"],
  WEATHER: ["WX", "WEATHER"],
  POWER: ["PWR", "POWER", "W"],
  RIG: ["RIG", "RADIO"],
  ANTENNA: ["ANT", "ANTENNA"],
  RST: ["RST"],
});

function emptyScores(names) {
  return Object.fromEntries(names.map((name) => [name, 0]));
}

function boundedProbability(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? Number(clamp(numeric, 0, 1).toFixed(4)) : 0;
}

function compactCallsign(value) {
  return normalizeCwText(value).replace(/[^A-Z0-9/]/g, "");
}

function callsignSlot(normalized, callsign, role, confidence = 1) {
  const expected = compactCallsign(callsign);
  if (!expected || !normalized.replace(/\s/g, "").includes(expected)) return null;
  return Object.freeze({
    topic: "CALLSIGN",
    role,
    value: expected,
    confidence: boundedProbability(confidence),
  });
}

function procedureGrade(score, recognizable) {
  if (!recognizable) return "IRRELEVANT";
  if (score >= 95) return "CANONICAL";
  if (score >= 60) return "INTELLIGIBLE_NONCANONICAL";
  if (score >= 30) return "INCOMPLETE";
  return "AMBIGUOUS";
}

function freezeSemanticResult(candidate) {
  const acts = Object.freeze(Object.fromEntries(
    TRAFFIC_ACTS.map((name) => [name, boundedProbability(candidate.acts?.[name])]),
  ));
  const topics = Object.freeze(Object.fromEntries(
    TRAFFIC_TOPICS.map((name) => [name, boundedProbability(candidate.topics?.[name])]),
  ));
  const grade = PROCEDURE_GRADES.includes(candidate.procedure?.grade)
    ? candidate.procedure.grade
    : "IRRELEVANT";
  const register = TRAFFIC_REGISTERS.includes(candidate.register)
    ? candidate.register
    : "CW_PROCEDURAL";
  return Object.freeze({
    schemaVersion: SEMANTIC_RESULT_SCHEMA_VERSION,
    contractVersion: SEMANTIC_MODEL_CONTRACT_VERSION,
    provider: candidate.provider ?? "rules-v1",
    modelVersion: candidate.modelVersion ?? null,
    normalized: normalizeCwText(candidate.normalized).slice(0, 160),
    acts,
    topics,
    slots: Object.freeze((candidate.slots ?? []).map((slot) => Object.freeze({ ...slot }))),
    register,
    procedure: Object.freeze({
      grade,
      score: Math.round(clamp(Number(candidate.procedure?.score) || 0, 0, 100)),
      issues: Object.freeze([...(candidate.procedure?.issues ?? [])].map(String).slice(0, 12)),
    }),
    interpretability: Math.round(clamp(Number(candidate.interpretability) || 0, 0, 100)),
    confidence: boundedProbability(candidate.confidence),
    safeToCommit: candidate.safeToCommit === true,
    fallbackRequired: candidate.fallbackRequired === true,
    evidence: Object.freeze({ ...(candidate.evidence ?? {}) }),
  });
}

export function semanticResultFromProvider(candidate) {
  if (!candidate || typeof candidate !== "object"
    || candidate.contractVersion !== SEMANTIC_MODEL_CONTRACT_VERSION) {
    return null;
  }
  return freezeSemanticResult(candidate);
}

function interpretCq({ message, selfCallsign, wpm }) {
  const assessment = assessCqTransmission({
    message,
    playerCallsign: selfCallsign,
    wpm,
    rhythm: null,
  });
  const acts = emptyScores(TRAFFIC_ACTS);
  const topics = emptyScores(TRAFFIC_TOPICS);
  acts.CQ = assessment.intentScore / 100;
  acts.PROVIDE = assessment.identityScore / 100;
  topics.CALLSIGN = assessment.identityScore / 100;
  const slot = callsignSlot(assessment.normalized, selfCallsign, "SELF", assessment.identityScore / 100);
  const recognizable = assessment.recognizable;
  const confidence = (
    .45 * acts.CQ
    + .45 * topics.CALLSIGN
    + .1 * (assessment.terminalScore / 100)
  );
  const issues = [];
  if (assessment.deScore < 55) issues.push("missingDe");
  if (assessment.terminalScore < 100) issues.push("missingHandover");
  if (assessment.orderScore < 75) issues.push("noncanonicalOrder");
  return freezeSemanticResult({
    normalized: assessment.normalized,
    acts,
    topics,
    slots: slot ? [slot] : [],
    procedure: {
      grade: procedureGrade(assessment.orderScore, recognizable),
      score: assessment.orderScore,
      issues,
    },
    interpretability: assessment.semanticQuality,
    confidence,
    safeToCommit: acts.CQ >= .55 && topics.CALLSIGN >= .7,
    fallbackRequired: false,
    evidence: {
      intentScore: assessment.intentScore,
      identityScore: assessment.identityScore,
      identityEditDistance: assessment.identityEditDistance,
      terminalScore: assessment.terminalScore,
      recognizable,
      legacyAssessment: assessment,
    },
  });
}

function genericTraffic({ message, selfCallsign, peerCallsign, pendingQuestion }) {
  const normalized = normalizeCwText(message).slice(0, 160);
  const tokens = normalized.split(" ").filter(Boolean);
  const compact = normalized.replace(/\s/g, "");
  const acts = emptyScores(TRAFFIC_ACTS);
  const topics = emptyScores(TRAFFIC_TOPICS);
  const slots = [];

  const selfSlot = callsignSlot(normalized, selfCallsign, "SELF");
  const peerSlot = callsignSlot(normalized, peerCallsign, "PEER");
  if (selfSlot) slots.push(selfSlot);
  if (peerSlot) slots.push(peerSlot);
  if (slots.length) {
    acts.PROVIDE = 1;
    topics.CALLSIGN = 1;
  }

  if (tokens.includes("CQ") || compact.startsWith("CQ")) acts.CQ = 1;
  if (tokens.includes("RST") || /RST[1-5][1-9][1-9]/.test(compact)) {
    acts.REPORT = 1;
    acts.PROVIDE = 1;
    topics.RST = 1;
  }
  const rstMatch = compact.match(/RST([1-5][1-9][1-9])/);
  if (rstMatch) slots.push(Object.freeze({ topic: "RST", role: "VALUE", value: rstMatch[1], confidence: 1 }));
  if (tokens.includes("R") || tokens.includes("RR")) acts.ACK = 1;
  if (tokens.includes("TNX") || tokens.includes("TKS")) acts.THANKS = 1;
  if (tokens.includes("73") || tokens.includes("SK")) acts.SIGNOFF = 1;
  if (tokens.includes("AGN") || normalized.includes("?")) acts.ASK = 1;

  for (const [topic, keywords] of Object.entries(TOPIC_KEYWORDS)) {
    if (keywords.some((keyword) => tokens.includes(keyword))) topics[topic] = 1;
  }
  const pending = String(pendingQuestion ?? "").toUpperCase();
  if (TRAFFIC_TOPICS.includes(pending) && normalized && tokens.at(-1) === "K") {
    topics[pending] = Math.max(topics[pending], .9);
    acts.PROVIDE = Math.max(acts.PROVIDE, .9);
  }

  const meaningful = Math.max(...Object.values(acts), ...Object.values(topics));
  const hasHandover = tokens.at(-1) === "K" || tokens.at(-1) === "KN" || tokens.includes("SK");
  const procedureScore = meaningful ? (hasHandover ? 85 : 55) : 0;
  const confidence = meaningful ? Math.min(1, .55 + slots.length * .12 + (hasHandover ? .15 : 0)) : 0;
  return freezeSemanticResult({
    normalized,
    acts,
    topics,
    slots,
    procedure: {
      grade: procedureGrade(procedureScore, meaningful > 0),
      score: procedureScore,
      issues: hasHandover || !meaningful ? [] : ["missingHandover"],
    },
    interpretability: meaningful ? Math.round(confidence * 100) : 0,
    confidence,
    safeToCommit: meaningful >= .55 && confidence >= .55,
    fallbackRequired: false,
    evidence: { recognizable: meaningful > 0, terminalScore: hasHandover ? 100 : 0 },
  });
}

export function interpretCwTraffic({
  message,
  phase = "IDLE",
  selfCallsign = "",
  peerCallsign = "",
  pendingQuestion = "NONE",
  wpm = null,
} = {}) {
  const normalizedPhase = String(phase ?? "IDLE").toUpperCase();
  if (normalizedPhase === "CALLING" || normalizedPhase === "PLAYER_CQ") {
    return interpretCq({ message, selfCallsign, wpm });
  }
  return genericTraffic({ message, selfCallsign, peerCallsign, pendingQuestion });
}

export function cqAssessmentFromSemantic(result) {
  return result?.evidence?.legacyAssessment ?? null;
}
