import { expeditionSiteById } from "./expeditionCatalog.js";
import { normalizeExpeditionSettlementProofs } from "./expeditionRun.js";
import { personIdForOperator, stationIdentityForCallsign } from "./personIdentity.js";
import { verifiedExpeditionQslRecords } from "./qslRecords.js";
import { normalizeQslStoryState } from "./qslStoryRun.js";
import { normalizeServiceNetState } from "./serviceNetRun.js";
import { verifiedServiceNetCompletion } from "./serviceNetSettlement.js";
import { normalizeCoordinateRelayState } from "./coordinateRelayRun.js";
import { verifiedCoordinateRelayCompletion } from "./coordinateRelaySettlement.js";
import { normalizeContestState } from "./contestRun.js";
import { verifiedContestCompletion } from "./contestCompletion.js";
import { normalizeListeningState } from "./listeningRun.js";
import { verifiedListeningCompletion } from "./listeningCompletion.js";
import { normalizeStormRelayState } from "./stormRelayRun.js";
import { verifiedStormRelayCompletion } from "./stormRelayCompletion.js";
import { normalizeNightOperationsState } from "./nightOperationsRun.js";
import { verifiedNightOperationsCompletion } from "./nightOperationsCompletion.js";
import { normalizeStoryContinuationState } from "./storyContinuationState.js";
import { normalizeOperatorRelationships } from "../qso/operatorRelationships.js";

export const MISSION_STATE_VERSION = 2;
export const MAX_ACTIVE_DAILY_MISSIONS = 2;
export const STORY_MISSION_IDS = Object.freeze([
  "story-01", "story-02", "story-03", "story-04", "story-05", "story-06", "story-07", "story-08", "story-09", "story-10", "story-11", "story-12", "story-13",
]);
export const RECENT_MISSION_DNA_LIMIT = 12;
export const MISSION_EVENT_LIMIT = 120;

const DAILY_KINDS = Object.freeze([
  "clean", "weak", "regions", "distance", "independent",
  "weather", "relay", "equipment", "contest", "friendship",
]);
const STORY_MISSIONS = Object.freeze([
  Object.freeze({
    id: "story-01", type: "story", chapter: 1, titleKey: "story01Title", descriptionKey: "story01Description",
    objectiveKey: "story01Objective", briefKey: "story01Brief", debriefKey: "story01Debrief",
    objective: "first-qso", target: 1, moneyReward: 150, technologyPointsReward: 0,
    contract: Object.freeze({ missionPhase: "first-contact", requiredTopics: ["CALLSIGN", "RST"] }),
  }),
  Object.freeze({
    id: "story-02", type: "story", chapter: 2, titleKey: "story02Title", descriptionKey: "story02Description",
    objectiveKey: "story02Objective", briefKey: "story02Brief", debriefKey: "story02Debrief",
    objective: "old-friend-repeat", target: 1, targetCallsign: "SIM3RA",
    prerequisiteId: "story-01", moneyReward: 220, technologyPointsReward: 1,
    contract: Object.freeze({ missionPhase: "repeat-request", targetCallsign: "SIM3RA", recoveryActions: ["AGN"] }),
  }),
  Object.freeze({
    id: "story-03", type: "story", chapter: 3, titleKey: "story03Title", descriptionKey: "story03Description",
    objectiveKey: "story03Objective", briefKey: "story03Brief", debriefKey: "story03Debrief",
    objective: "operator-styles", target: 3, prerequisiteId: "story-02",
    moneyReward: 300, technologyPointsReward: 1,
    contract: Object.freeze({ missionPhase: "operator-listening", requiredDistinctOperators: 3 }),
  }),
  Object.freeze({
    id: "story-04", type: "story", chapter: 4, titleKey: "story04Title", descriptionKey: "story04Description",
    objectiveKey: "story04Objective", briefKey: "story04Brief", debriefKey: "story04Debrief",
    objective: "rain-link-recovery", target: 1, targetCallsign: "SIM2DX", prerequisiteId: "story-03",
    moneyReward: 420, technologyPointsReward: 2,
    contract: Object.freeze({
      missionPhase: "weak-weather-exchange", targetCallsign: "SIM2DX", requiredTopics: ["WEATHER"],
      maximumPropagationLevel: 2, recoveryRequired: true, recoveryActions: ["AGN", "QRS"],
    }),
  }),
  Object.freeze({
    id: "story-05", type: "story", chapter: 5, titleKey: "story05Title", descriptionKey: "story05Description",
    objectiveKey: "story05Objective", briefKey: "story05Brief", debriefKey: "story05Debrief",
    objective: "lights-event", target: 1, prerequisiteId: "story-04",
    moneyReward: 500, technologyPointsReward: 2,
    contract: Object.freeze({
      missionPhase: "lights-control", requiredTopics: ["CALLSIGN", "RST", "REGION"],
      recoveryActions: ["AGN", "QRS"], eventId: "lights-across-air", eventMode: "story",
      minimumGrade: "base",
    }),
  }),
  Object.freeze({
    id: "story-06", type: "story", chapter: 6, titleKey: "story06Title", descriptionKey: "story06Description",
    objectiveKey: "story06Objective", briefKey: "story06Brief", debriefKey: "story06Debrief",
    objective: "hill-expedition", target: 1, prerequisiteId: "story-05",
    moneyReward: 650, technologyPointsReward: 3,
    contract: Object.freeze({
      missionPhase: "hill-expedition", requiredTopics: ["QTH", "POWER", "ANTENNA"],
      recoveryActions: ["AGN", "QRS"],
    }),
  }),
  Object.freeze({
    id: "story-07", type: "story", chapter: 7, titleKey: "story07Title", descriptionKey: "story07Description",
    objectiveKey: "story07Objective", briefKey: "story07Brief", debriefKey: "story07Debrief",
    objective: "qsl-clarification", target: 1, prerequisiteId: "story-06",
    moneyReward: 750, technologyPointsReward: 3,
    contract: Object.freeze({
      missionPhase: "qsl-clarification", requiredTopics: ["QSL", "CHOICE"],
      recoveryActions: ["AGN", "QRS"],
    }),
  }),
  Object.freeze({
    id: "story-08", type: "story", chapter: 8, titleKey: "story08Title", descriptionKey: "story08Description",
    objectiveKey: "story08Objective", briefKey: "story08Brief", debriefKey: "story08Debrief",
    objective: "service-net", target: 1, prerequisiteId: "story-07",
    moneyReward: 850, technologyPointsReward: 4,
    contract: Object.freeze({
      missionPhase: "fictional-public-service", requiredTopics: ["MESSAGE_ID", "PRIORITY", "ACK"],
      recoveryActions: ["AGN", "QRS"],
    }),
  }),
  Object.freeze({
    id: "story-09", type: "story", chapter: 9, titleKey: "story09Title", descriptionKey: "story09Description",
    objectiveKey: "story09Objective", briefKey: "story09Brief", debriefKey: "story09Debrief",
    objective: "coordinate-relay", target: 1, prerequisiteId: "story-08",
    moneyReward: 950, technologyPointsReward: 4,
    contract: Object.freeze({
      missionPhase: "fictional-coordinate-relay", requiredTopics: ["GRID", "TIME", "PEOPLE", "CHECK"],
      recoveryActions: ["AGN", "QRS"],
    }),
  }),
  Object.freeze({
    id: "story-10", type: "story", chapter: 10, titleKey: "story10Title", descriptionKey: "story10Description",
    objectiveKey: "story10Objective", briefKey: "story10Brief", debriefKey: "story10Debrief",
    objective: "five-minute-contest", target: 1, prerequisiteId: "story-09",
    moneyReward: 1100, technologyPointsReward: 5,
    contract: Object.freeze({
      missionPhase: "fictional-five-minute-contest", requiredTopics: ["RST", "SERIAL", "REGION", "POWER"],
      recoveryActions: ["AGN", "QRS"],
    }),
  }),
  Object.freeze({
    id: "story-11", type: "story", chapter: 11, titleKey: "story11Title", descriptionKey: "story11Description",
    objectiveKey: "story11Objective", briefKey: "story11Brief", debriefKey: "story11Debrief",
    objective: "listening-silence", target: 1, targetCallsign: "SIM11LS", prerequisiteId: "story-10",
    moneyReward: 1200, technologyPointsReward: 5,
    contract: Object.freeze({
      missionPhase: "listening-silence", targetCallsign: "SIM11LS",
      requiredTopics: ["CALLSIGN", "LISTENING"], recoveryActions: ["AGN"],
    }),
  }),
  Object.freeze({
    id: "story-12", type: "story", chapter: 12, titleKey: "story12Title", descriptionKey: "story12Description",
    objectiveKey: "story12Objective", briefKey: "story12Brief", debriefKey: "story12Debrief",
    objective: "storm-relay", target: 1, prerequisiteId: "story-11",
    moneyReward: 1350, technologyPointsReward: 6,
    contract: Object.freeze({
      missionPhase: "fictional-storm-relay",
      requiredTopics: ["MSG", "REV", "GRID", "PEOPLE", "ITEM", "QTY", "CHECK"],
      recoveryActions: ["AGN", "QRS"],
    }),
  }),
  Object.freeze({
    id: "story-13", type: "story", chapter: 13, titleKey: "story13Title", descriptionKey: "story13Description",
    objectiveKey: "story13Objective", briefKey: "story13Brief", debriefKey: "story13Debrief",
    objective: "night-operations", target: 1, prerequisiteId: "story-12",
    moneyReward: 1500, technologyPointsReward: 6,
    contract: Object.freeze({
      missionPhase: "night-operations", requiredDistinctOperators: 3,
      requiredTopics: ["CALLSIGN", "RST", "BAND", "SCHEDULE"], recoveryActions: ["AGN", "QRS"],
    }),
  }),
]);

const DAILY_TEMPLATES = Object.freeze({
  clean: Object.freeze({ titleKey: "cleanTitle", descriptionKey: "cleanDescription", objectiveKey: "cleanObjective", objective: "clean-qso", target: 1, moneyReward: 190, dna: { channel: "clear", exchange: "standard", incident: "none" } }),
  weak: Object.freeze({ titleKey: "weakTitle", descriptionKey: "weakDescription", objectiveKey: "weakObjective", objective: "weak-qso", target: 1, moneyReward: 280, dna: { channel: "weak", exchange: "standard", incident: "fade" } }),
  regions: Object.freeze({ titleKey: "regionsTitle", descriptionKey: "regionsDescription", objectiveKey: "regionsObjective", objective: "distinct-regions", target: 2, moneyReward: 260, dna: { channel: "mixed", exchange: "standard", incident: "expedition" } }),
  distance: Object.freeze({ titleKey: "distanceTitle", descriptionKey: "distanceDescription", objectiveKey: "distanceObjective", objective: "distance-qso", target: 1, moneyReward: 290, dna: { channel: "dx", exchange: "standard", incident: "distance" } }),
  independent: Object.freeze({ titleKey: "independentTitle", descriptionKey: "independentDescription", objectiveKey: "independentObjective", objective: "independent-qso", target: 1, moneyReward: 320, dna: { channel: "any", exchange: "blind", incident: "assessment" } }),
  weather: Object.freeze({ titleKey: "weatherTitle", descriptionKey: "weatherDescription", objectiveKey: "weatherObjective", objective: "weather-exchange", target: 1, moneyReward: 270, dna: { channel: "any", exchange: "weather", incident: "field-report" } }),
  relay: Object.freeze({ titleKey: "relayTitle", descriptionKey: "relayDescription", objectiveKey: "relayObjective", objective: "recovered-qso", target: 1, moneyReward: 360, technologyPointsReward: 1, dna: { channel: "weak", exchange: "repeat", incident: "relay" } }),
  equipment: Object.freeze({ titleKey: "equipmentTitle", descriptionKey: "equipmentDescription", objectiveKey: "equipmentObjective", objective: "equipment-qso", target: 1, moneyReward: 240, dna: { channel: "any", exchange: "equipment", incident: "field-test" } }),
  contest: Object.freeze({ titleKey: "contestTitle", descriptionKey: "contestDescription", objectiveKey: "contestObjective", objective: "contest-qso", target: 1, moneyReward: 340, technologyPointsReward: 1, dna: { channel: "busy", exchange: "fast", incident: "contest" } }),
  friendship: Object.freeze({ titleKey: "friendshipTitle", descriptionKey: "friendshipDescription", objectiveKey: "friendshipObjective", objective: "friendship-qso", target: 1, moneyReward: 250, dna: { channel: "any", exchange: "personal", incident: "reunion" } }),
});

const DAILY_DNA_CONTEXT = Object.freeze({
  clean: { location: "local", propagation: "clear", operator: "routine", equipment: "standard" },
  weak: { location: "regional", propagation: "weak", operator: "patient", equipment: "standard" },
  regions: { location: "multi-region", propagation: "mixed", operator: "varied", equipment: "standard" },
  distance: { location: "dx", propagation: "opening", operator: "dx-hunter", equipment: "long-range" },
  independent: { location: "any", propagation: "mixed", operator: "unknown", equipment: "player-choice" },
  weather: { location: "field", propagation: "mixed", operator: "conversational", equipment: "standard" },
  relay: { location: "emergency-route", propagation: "weak", operator: "cooperative", equipment: "relay-ready" },
  equipment: { location: "test-range", propagation: "mixed", operator: "technical", equipment: "non-default" },
  contest: { location: "contest-zone", propagation: "busy", operator: "competitive", equipment: "fast-keying" },
  friendship: { location: "known-region", propagation: "mixed", operator: "familiar", equipment: "player-choice" },
});

function safeInteger(value, maximum = Number.MAX_SAFE_INTEGER) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? Math.min(maximum, Math.max(0, Math.floor(numeric))) : 0;
}

function safeAdd(left, right, maximum = Number.MAX_SAFE_INTEGER) {
  return Math.min(maximum, safeInteger(left, maximum) + safeInteger(right, maximum));
}

function own(value, key) {
  if (!value || typeof value !== "object") return undefined;
  try {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    return descriptor && Object.hasOwn(descriptor, "value") ? descriptor.value : undefined;
  } catch {
    return undefined;
  }
}

function ownDataArrayTail(value, maximum) {
  try {
    if (!Array.isArray(value)) return [];
    const lengthDescriptor = Object.getOwnPropertyDescriptor(value, "length");
    const length = lengthDescriptor && Object.hasOwn(lengthDescriptor, "value")
      ? Number(lengthDescriptor.value) : NaN;
    if (!Number.isSafeInteger(length) || length < 0) return [];
    const result = [];
    for (let index = Math.max(0, length - maximum); index < length; index += 1) {
      const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
      if (!descriptor || !Object.hasOwn(descriptor, "value")) return [];
      result.push(descriptor.value);
    }
    return result;
  } catch {
    return [];
  }
}

function normalizeIso(value, fallback = null) {
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : fallback;
}

function utcDayKey(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString().slice(0, 10) : new Date(0).toISOString().slice(0, 10);
}

function hashString(value) {
  let hash = 2166136261;
  for (const character of String(value)) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function normalizeStringList(value, maximum = 200, itemLength = 96) {
  const retained = ownDataArrayTail(value, maximum);
  const normalized = [];
  const seen = new Set();
  for (const item of retained) {
    if (typeof item !== "string") return [];
    const text = item.trim().slice(0, itemLength);
    if (!text) return [];
    if (seen.has(text)) return [];
    seen.add(text);
    normalized.push(text);
  }
  return normalized;
}

function normalizeMissionContract(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return {
    missionPhase: String(own(value, "missionPhase") ?? "standard-qso").trim().slice(0, 48) || "standard-qso",
    targetCallsign: String(own(value, "targetCallsign") ?? "").trim().toUpperCase().slice(0, 16) || null,
    requiredTopics: normalizeStringList(own(value, "requiredTopics"), 12, 32),
    recoveryActions: normalizeStringList(own(value, "recoveryActions"), 8, 16),
    maximumPropagationLevel: own(value, "maximumPropagationLevel") == null
      ? null : Math.min(4, safeInteger(own(value, "maximumPropagationLevel"), 4)),
    recoveryRequired: own(value, "recoveryRequired") === true,
    requiredDistinctOperators: safeInteger(own(value, "requiredDistinctOperators"), 100),
    eventId: String(own(value, "eventId") ?? "").toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 48) || null,
    eventMode: ["story", "annual", "practice"].includes(own(value, "eventMode")) ? own(value, "eventMode") : null,
    minimumGrade: ["base", "silver", "gold"].includes(own(value, "minimumGrade")) ? own(value, "minimumGrade") : null,
  };
}

function missionDnaFingerprint(kind, dna = {}) {
  const fields = ["purpose", "location", "propagation", "operator", "equipment", "exchange", "incident", "aftermath"];
  return `mission-dna-v1:${kind}:${fields.map((field) => String(dna[field] ?? "any")).join(":")}`;
}

function missionDna(kind, template) {
  const context = DAILY_DNA_CONTEXT[kind] ?? {};
  const dna = {
    purpose: kind,
    location: context.location ?? "any",
    propagation: context.propagation ?? template?.dna?.channel ?? "mixed",
    operator: context.operator ?? "unknown",
    equipment: context.equipment ?? "player-choice",
    exchange: template?.dna?.exchange ?? "standard",
    incident: template?.dna?.incident ?? "none",
    aftermath: safeInteger(template?.technologyPointsReward, 1000) > 0 ? "research" : "money",
  };
  return Object.freeze({ ...dna, fingerprint: missionDnaFingerprint(kind, dna) });
}

function followsCanonicalRecordOrder(previous, current, timeKey) {
  if (!previous) return true;
  if (previous[timeKey] < current[timeKey]) return true;
  return previous[timeKey] === current[timeKey] && previous.id < current.id;
}

function normalizeMissionHistoryEntry(value) {
  const id = String(own(value, "id") ?? "").trim();
  const claimedAt = normalizeIso(own(value, "claimedAt"));
  if (!knownMissionId(id) || !claimedAt) return null;
  return {
    id,
    claimedAt,
    moneyReward: safeInteger(own(value, "moneyReward"), 1_000_000),
    technologyPointsReward: safeInteger(own(value, "technologyPointsReward"), 1000),
    dnaFingerprint: String(own(value, "dnaFingerprint") ?? "").trim().slice(0, 240) || null,
    outcome: String(own(value, "outcome") ?? "completed").trim().slice(0, 48) || "completed",
  };
}

function normalizeMissionEvent(value) {
  const id = String(own(value, "id") ?? "").trim().slice(0, 128);
  const qsoId = String(own(value, "qsoId") ?? "").trim().slice(0, 96);
  const occurredAt = normalizeIso(own(value, "occurredAt"));
  const facts = own(value, "facts");
  if (!id || !qsoId || !occurredAt) return null;
  const missionIdCandidates = normalizeStringList(own(value, "missionIds"), 4, 48);
  return {
    id,
    qsoId,
    occurredAt,
    callsign: String(own(value, "callsign") ?? "").trim().toUpperCase().slice(0, 16),
    missionIds: missionIdCandidates.every(knownMissionId) ? missionIdCandidates : [],
    missionPhases: normalizeStringList(own(value, "missionPhases"), 4, 48),
    requiredTopics: normalizeStringList(own(value, "requiredTopics"), 12, 32),
    recoveryActions: normalizeStringList(own(value, "recoveryActions"), 8, 16),
    outcome: own(value, "outcome") === "progress" ? "progress" : "unmatched",
    failureReasons: normalizeStringList(own(value, "failureReasons"), 12, 48),
    facts: {
      propagationLevel: Math.min(4, safeInteger(own(facts, "propagationLevel"), 4)),
      optionalTopic: String(own(facts, "optionalTopic") ?? "").trim().slice(0, 32) || null,
      optionalAnswered: own(facts, "optionalAnswered") === true,
      recovered: own(facts, "recovered") === true,
      independentWatch: own(facts, "independentWatch") === true,
      equipmentId: String(own(facts, "equipmentId") ?? "").trim().slice(0, 48) || null,
      antennaId: String(own(facts, "antennaId") ?? "").trim().slice(0, 48) || null,
    },
  };
}

function isDailyMissionId(id) {
  const match = /^daily:(\d{4}-\d{2}-\d{2}):([a-z-]+)$/.exec(String(id ?? ""));
  return Boolean(match && DAILY_KINDS.includes(match[2]));
}

function knownMissionId(id) {
  return STORY_MISSION_IDS.includes(id) || isDailyMissionId(id);
}

function normalizeActiveMission(value) {
  const id = String(own(value, "id") ?? "").trim();
  const acceptedAt = normalizeIso(own(value, "acceptedAt"));
  return knownMissionId(id) && acceptedAt ? {
    id,
    acceptedAt,
    baselineQsoIds: normalizeStringList(own(value, "baselineQsoIds"), 200, 96),
    baselineLightsRunIds: normalizeStringList(own(value, "baselineLightsRunIds"), 200, 128),
    baselineExpeditionRunIds: normalizeStringList(own(value, "baselineExpeditionRunIds"), 200, 128),
    baselineQslStoryRunIds: normalizeStringList(own(value, "baselineQslStoryRunIds"), 100, 128),
    baselineServiceNetRunIds: normalizeStringList(own(value, "baselineServiceNetRunIds"), 100, 128),
    baselineCoordinateRelayRunIds: normalizeStringList(own(value, "baselineCoordinateRelayRunIds"), 100, 128),
    baselineContestRunIds: normalizeStringList(own(value, "baselineContestRunIds"), 100, 128),
    baselineListeningRunIds: normalizeStringList(own(value, "baselineListeningRunIds"), 100, 128),
    baselineStormRelayRunIds: normalizeStringList(own(value, "baselineStormRelayRunIds"), 100, 128),
    baselineNightOperationsRunIds: normalizeStringList(own(value, "baselineNightOperationsRunIds"), 100, 128),
    knownCallsigns: normalizeStringList(own(value, "knownCallsigns"), 2000, 16),
    contract: normalizeMissionContract(own(value, "contract")),
    dnaFingerprint: String(own(value, "dnaFingerprint") ?? "").trim().slice(0, 240) || null,
  } : null;
}

export function emptyMissionState() {
  return {
    version: MISSION_STATE_VERSION,
    activeMissions: [],
    claimedMissionIds: [],
    history: [],
    events: [],
  };
}

export function normalizeMissionState(value) {
  try {
    const source = value && typeof value === "object" ? value : {};
    const activeIds = new Set();
    const activeMissions = [];
    for (const candidate of ownDataArrayTail(own(source, "activeMissions"), 4)) {
      const normalized = normalizeActiveMission(candidate);
      if (!normalized || activeIds.has(normalized.id)) {
        activeMissions.length = 0;
        break;
      }
      activeIds.add(normalized.id);
      activeMissions.push(normalized);
    }
    const claimedMissionCandidates = normalizeStringList(own(source, "claimedMissionIds"), 400, 48);
    const claimedMissionIds = claimedMissionCandidates.every(knownMissionId)
      ? claimedMissionCandidates
      : [];
    const claimed = new Set(claimedMissionIds);
    const historyIds = new Set();
    const history = [];
    for (const candidate of ownDataArrayTail(own(source, "history"), 80)) {
      const normalized = normalizeMissionHistoryEntry(candidate);
      if (!normalized || historyIds.has(normalized.id)
        || !followsCanonicalRecordOrder(history.at(-1), normalized, "claimedAt")) {
        history.length = 0;
        break;
      }
      historyIds.add(normalized.id);
      history.push(normalized);
    }
    const eventIds = new Set();
    const eventQsoIds = new Set();
    const events = [];
    for (const candidate of ownDataArrayTail(own(source, "events"), MISSION_EVENT_LIMIT)) {
      const normalized = normalizeMissionEvent(candidate);
      if (!normalized || eventIds.has(normalized.id) || eventQsoIds.has(normalized.qsoId)
        || !followsCanonicalRecordOrder(events.at(-1), normalized, "occurredAt")) {
        events.length = 0;
        break;
      }
      eventIds.add(normalized.id);
      eventQsoIds.add(normalized.qsoId);
      events.push(normalized);
    }
    return {
      version: MISSION_STATE_VERSION,
      activeMissions: activeMissions.filter(({ id }) => !claimed.has(id)).slice(0, 4),
      claimedMissionIds,
      history,
      events,
    };
  } catch {
    return emptyMissionState();
  }
}

function dailyDefinitionForId(id) {
  const match = /^daily:(\d{4}-\d{2}-\d{2}):([a-z-]+)$/.exec(String(id ?? ""));
  if (!match || !DAILY_KINDS.includes(match[2])) return null;
  const template = DAILY_TEMPLATES[match[2]];
  const dna = missionDna(match[2], template);
  return Object.freeze({
    ...template,
    id: `daily:${match[1]}:${match[2]}`,
    dayKey: match[1],
    kind: match[2],
    type: "daily",
    dna,
    contract: Object.freeze({ missionPhase: `daily-${match[2]}` }),
    technologyPointsReward: safeInteger(template.technologyPointsReward, 1000),
  });
}

export function dailyMissionDefinitions(save, utc = new Date()) {
  const dayKey = utcDayKey(utc);
  const seed = hashString(`${save?.id ?? "station"}:${dayKey}:mission-board-v2`);
  const state = normalizeMissionState(save?.missionState);
  const recent = new Set(state.history.map(({ dnaFingerprint }) => dnaFingerprint).filter(Boolean).slice(-RECENT_MISSION_DNA_LIMIT));
  const ordered = [...DAILY_KINDS]
    .map((kind, index) => {
      const definition = dailyDefinitionForId(`daily:${dayKey}:${kind}`);
      return { definition, repeated: recent.has(definition.dna.fingerprint), order: hashString(`${seed}:${kind}:${index}`) };
    })
    .sort((left, right) => Number(left.repeated) - Number(right.repeated)
      || left.order - right.order || left.definition.kind.localeCompare(right.definition.kind))
    .slice(0, 3);
  return ordered.map(({ definition }) => definition);
}

function missionDefinition(id) {
  return STORY_MISSIONS.find((mission) => mission.id === id) ?? dailyDefinitionForId(id);
}

function logsForMission(save, active) {
  try {
    if (!active) return [];
    const logs = ownDataArrayTail(own(save, "qsoLogs"), 200);
    const acceptedAt = Date.parse(own(active, "acceptedAt") ?? "");
    if (!Number.isFinite(acceptedAt)) return [];
    const baseline = new Set(ownDataArrayTail(own(active, "baselineQsoIds"), 200));
    return logs.filter((entry) => !baseline.has(String(own(entry, "id") ?? ""))
      && Date.parse(own(entry, "completedAt") ?? "") >= acceptedAt);
  } catch {
    return [];
  }
}

function verifiedExpeditionCompletion(save, active, logs) {
  const acceptedAt = Date.parse(own(active, "acceptedAt") ?? "");
  if (!Number.isFinite(acceptedAt)) return false;
  const baselineIds = own(active, "baselineExpeditionRunIds");
  const baseline = new Set(Array.isArray(baselineIds) ? baselineIds.slice(-200) : []);
  const expeditionState = own(save, "expeditionState");
  const suppliedCompleted = own(expeditionState, "completedRuns");
  const completedRuns = Array.isArray(suppliedCompleted) ? suppliedCompleted.slice(-80) : [];
  const suppliedSettledRuns = own(expeditionState, "settledRunIds");
  const settledRuns = new Set((Array.isArray(suppliedSettledRuns)
    ? suppliedSettledRuns.slice(-200) : []).map((id) => String(id ?? "").trim()));
  const proofs = normalizeExpeditionSettlementProofs(own(expeditionState, "settledQsoProofs"));
  const retainedLogs = Array.isArray(logs) ? logs.slice(-200) : [];

  return completedRuns.some((summary) => {
    const runId = String(own(summary, "runId") ?? "").trim().slice(0, 128);
    const qsoId = String(own(summary, "qsoId") ?? "").trim().slice(0, 96);
    const siteId = String(own(summary, "siteId") ?? "").trim().slice(0, 64);
    const personId = String(own(summary, "personId") ?? "").trim().slice(0, 96);
    const stationId = String(own(summary, "stationId") ?? "").trim().slice(0, 96);
    const completedAt = Date.parse(own(summary, "completedAt") ?? "");
    if (!runId || baseline.has(runId) || !settledRuns.has(runId)
      || !qsoId || !expeditionSiteById(siteId)
      || !personId || !stationId || !Number.isFinite(completedAt) || completedAt < acceptedAt) {
      return false;
    }
    const proof = proofs.find((candidate) => candidate.runId === runId);
    if (!proof
      || proof.qsoId !== qsoId
      || proof.siteId !== siteId
      || proof.personId !== personId
      || proof.stationId !== stationId
      || proof.completedAt !== new Date(completedAt).toISOString()
      || proof.playerLocationId !== `expedition:${siteId}`
      || proof.isFictional !== true) return false;
    const log = retainedLogs.find((candidate) => own(candidate, "id") === qsoId);
    const logCallsign = String(own(log, "callsign") ?? "").trim().toUpperCase().slice(0, 16);
    const logIdentity = log ? {
      callsign: logCallsign,
      personId: own(log, "personId"),
      stationId: own(log, "stationId"),
    } : null;
    const verifiedPersonId = personIdForOperator(logIdentity);
    const verifiedStation = stationIdentityForCallsign(logCallsign, logIdentity ?? {});
    return Boolean(log)
      && own(log, "expeditionRunId") === runId
      && own(log, "expeditionSiteId") === siteId
      && own(log, "playerLocationId") === `expedition:${siteId}`
      && own(log, "personId") === personId
      && own(log, "stationId") === stationId
      && verifiedPersonId === personId
      && verifiedStation?.stationId === stationId
      && own(log, "isFictional") === true
      && Date.parse(own(log, "completedAt") ?? "") === completedAt;
  });
}

function confirmedChapterSevenSource(save) {
  return verifiedExpeditionQslRecords(save).some((record) => (
    record.personId === "person:sora"
    && record.stationId === "station:sim6jp"
    && record.callsign === "SIM6JP"
    && record.choice != null
    && record.playerNarrativeKey === "qsl.player.hill-signal"
    && record.operatorNarrativeKey === "qsl.operator.sora-hill-reply"
    && String(record.qsoId).startsWith("expedition-qso:")
  ));
}

function verifiedQslStoryCompletion(save, active, logs) {
  const acceptedAt = Date.parse(own(active, "acceptedAt") ?? "");
  if (!Number.isFinite(acceptedAt)) return false;
  const baseline = new Set(Array.isArray(own(active, "baselineQslStoryRunIds"))
    ? own(active, "baselineQslStoryRunIds").slice(-100) : []);
  const continuation = normalizeStoryContinuationState(own(save, "storyContinuationState"));
  const chapter = normalizeQslStoryState(continuation.chapter07);
  const retainedLogs = Array.isArray(logs) ? logs.slice(-200) : [];
  const sourceRecords = verifiedExpeditionQslRecords(save);
  const relationships = normalizeOperatorRelationships(own(save, "operatorRelationships"));

  return chapter.cases.some((qslCase) => {
    if (baseline.has(qslCase.runId) || !chapter.settledRunIds.includes(qslCase.runId)
      || Date.parse(qslCase.completedAt) < acceptedAt) return false;
    const source = sourceRecords.find((record) => record.id === qslCase.sourceQslId);
    if (!source || source.personId !== qslCase.personId || source.stationId !== qslCase.stationId
      || source.choice !== qslCase.initialChoice) return false;
    const log = retainedLogs.find((candidate) => own(candidate, "id") === qslCase.qsoId);
    const logCallsign = String(own(log, "callsign") ?? "").trim().toUpperCase().slice(0, 16);
    const identityClaim = log ? {
      callsign: logCallsign,
      personId: own(log, "personId"),
      stationId: own(log, "stationId"),
    } : null;
    const verifiedPerson = personIdForOperator(identityClaim);
    const verifiedStation = stationIdentityForCallsign(logCallsign, identityClaim ?? {});
    if (!log || own(log, "eventKind") !== "qsl-story" || own(log, "eventRunId") !== qslCase.runId
      || own(log, "personId") !== qslCase.personId || own(log, "stationId") !== qslCase.stationId
      || verifiedPerson !== qslCase.personId || verifiedStation?.stationId !== qslCase.stationId
      || own(log, "isFictional") !== true
      || Date.parse(own(log, "completedAt") ?? "") !== Date.parse(qslCase.completedAt)) return false;
    const relationship = relationships.find((candidate) => candidate.personId === qslCase.personId);
    const completedAt = Date.parse(qslCase.completedAt);
    return Boolean(relationship)
      && relationship.callsign === logCallsign
      && relationship.completedQsos > 0
      && Date.parse(relationship.firstMetAt) <= completedAt
      && Date.parse(relationship.lastMetAt) >= completedAt;
  });
}

function usedRecovery(log) {
  return safeInteger(log?.copyQueries) > 0 || safeInteger(log?.repeatRequests) > 0
    || (Array.isArray(log?.attemptHistory) && log.attemptHistory.some((attempt) => {
      const message = String(attempt?.message ?? "").trim().toUpperCase();
      return attempt?.remoteOutcome === "query" || attempt?.remoteOutcome === "unreadable"
        || (attempt?.result === "repeat" && (/^(AGN|QRS)(?:\s|$)/.test(message) || message.startsWith("PSE QRS")));
    }));
}

function missionContractFailures(definition, active, log) {
  const contract = active?.contract ?? normalizeMissionContract(definition?.contract);
  if (!contract) return [];
  const failures = [];
  if (contract.targetCallsign && String(log?.callsign ?? "").toUpperCase() !== contract.targetCallsign) failures.push("TARGET_NOT_REACHED");
  if (contract.maximumPropagationLevel !== null && Number(log?.finalPropagationLevel) > contract.maximumPropagationLevel) failures.push("PROPAGATION_OUTSIDE_CONTRACT");
  if (contract.recoveryRequired && !usedRecovery(log)) failures.push("RECOVERY_NOT_OBSERVED");
  for (const topic of contract.requiredTopics) {
    if (topic === "WEATHER" && !(log?.optionalExchangeQuestion === "weather" && log?.optionalExchangeOutcome === "answered")) failures.push("WEATHER_NOT_EXCHANGED");
    if (topic === "CALLSIGN" && !String(log?.callsign ?? "").trim()) failures.push("CALLSIGN_NOT_COPIED");
    if (topic === "RST" && !String(log?.sent ?? log?.sentRst ?? "").trim()) failures.push("RST_NOT_EXCHANGED");
  }
  return [...new Set(failures)];
}

function evaluateObjective(definition, logs, save, active = null) {
  let current = 0;
  if (definition.objective === "first-qso") current = logs.length;
  if (definition.objective === "old-friend-repeat") {
    current = logs.some((entry) => entry?.callsign === definition.targetCallsign
      && Array.isArray(entry?.attemptHistory)
      && entry.attemptHistory.some((attempt) => String(attempt?.message ?? "").trim().toUpperCase() === "AGN K"
        && attempt?.result === "repeat")) ? 1 : 0;
  }
  if (definition.objective === "operator-styles") {
    current = new Set(logs.map((entry) => String(entry?.operatorProfileId ?? "").trim())
      .filter((profileId) => profileId && profileId !== "legacy-standard")).size;
  }
  if (definition.objective === "rain-link-recovery") {
    current = logs.some((entry) => entry?.callsign === definition.targetCallsign
      && Number(entry?.finalPropagationLevel) <= 2
      && entry?.optionalExchangeQuestion === "weather"
      && entry?.optionalExchangeOutcome === "answered"
      && usedRecovery(entry)) ? 1 : 0;
  }
  if (definition.objective === "lights-event") {
    const best = save?.lightsEventState?.storyBest;
    const gradeRank = { none: 0, base: 1, silver: 2, gold: 3 };
    const acceptedAt = Date.parse(active?.acceptedAt ?? "");
    const completedAt = Date.parse(best?.completedAt ?? "");
    const baseline = new Set(active?.baselineLightsRunIds ?? []);
    current = best?.runId && !baseline.has(String(best.runId))
      && Number.isFinite(acceptedAt) && Number.isFinite(completedAt) && completedAt >= acceptedAt
      && (gradeRank[best.grade] ?? 0) >= gradeRank.base ? 1 : 0;
  }
  if (definition.objective === "hill-expedition") {
    current = verifiedExpeditionCompletion(save, active, logs) ? 1 : 0;
  }
  if (definition.objective === "qsl-clarification") {
    current = verifiedQslStoryCompletion(save, active, logs) ? 1 : 0;
  }
  if (definition.objective === "service-net") {
    current = verifiedServiceNetCompletion(save, active, logs) ? 1 : 0;
  }
  if (definition.objective === "coordinate-relay") {
    current = verifiedCoordinateRelayCompletion(save, active, logs) ? 1 : 0;
  }
  if (definition.objective === "five-minute-contest") {
    current = verifiedContestCompletion(save, active, logs) ? 1 : 0;
  }
  if (definition.objective === "listening-silence") {
    current = verifiedListeningCompletion(save, active) ? 1 : 0;
  }
  if (definition.objective === "storm-relay") {
    current = verifiedStormRelayCompletion(save, active) ? 1 : 0;
  }
  if (definition.objective === "night-operations") {
    current = verifiedNightOperationsCompletion(save, active) ? 1 : 0;
  }
  if (definition.objective === "clean-qso") {
    current = logs.filter((entry) => safeInteger(entry?.repeatRequests) === 0
      && Number(entry?.transmitAccuracy) >= 85 && Number(entry?.keyingScore) >= 75).length;
  }
  if (definition.objective === "weak-qso") current = logs.filter((entry) => Number(entry?.finalPropagationLevel) <= 2).length;
  if (definition.objective === "distinct-regions") current = new Set(logs.map((entry) => String(entry?.location ?? "").trim()).filter(Boolean)).size;
  if (definition.objective === "distance-qso") current = logs.filter((entry) => Number(entry?.distanceKm) >= 3000).length;
  if (definition.objective === "independent-qso") current = logs.filter((entry) => entry?.independentWatch === true).length;
  if (definition.objective === "weather-exchange") current = logs.filter((entry) => entry?.optionalExchangeQuestion === "weather" && entry?.optionalExchangeOutcome === "answered").length;
  if (definition.objective === "recovered-qso") current = logs.filter((entry) => Number(entry?.finalPropagationLevel) <= 2 && usedRecovery(entry)).length;
  if (definition.objective === "equipment-qso") current = logs.filter((entry) => entry?.equipmentId !== "squid-01" || entry?.accessoryId !== "none").length;
  if (definition.objective === "contest-qso") current = logs.filter((entry) => Number(entry?.remoteWpm) >= 22
    && Number(entry?.transmitAccuracy) >= 90 && Number(entry?.keyingScore) >= 85 && safeInteger(entry?.repeatRequests) === 0).length;
  if (definition.objective === "friendship-qso") current = logs.filter((entry) => entry?.optionalExchangeOutcome === "answered"
    || (active?.knownCallsigns ?? []).includes(String(entry?.callsign ?? ""))).length;
  return { current: Math.min(current, definition.target), complete: current >= definition.target };
}

function evaluatedMission(save, state, definition) {
  const claimed = state.claimedMissionIds.includes(definition.id);
  const active = state.activeMissions.find((mission) => mission.id === definition.id) ?? null;
  const prerequisiteLocked = definition.type === "story" && definition.prerequisiteId
    ? !state.claimedMissionIds.includes(definition.prerequisiteId) : false;
  const locked = prerequisiteLocked || (definition.id === "story-07" && !confirmedChapterSevenSource(save));
  const progress = active ? evaluateObjective(definition, logsForMission(save, active), save, active) : { current: 0, complete: false };
  const status = claimed ? "claimed" : locked ? "locked" : active
    ? progress.complete ? "ready" : "active"
    : "available";
  const relationship = definition.targetCallsign
    ? (Array.isArray(save?.operatorRelationships) ? save.operatorRelationships : [])
      .find((entry) => entry?.callsign === definition.targetCallsign) ?? null
    : null;
  return {
    ...definition, ...progress, status, acceptedAt: active?.acceptedAt ?? null,
    contract: active?.contract ?? normalizeMissionContract(definition.contract),
    relationship,
  };
}

export function missionBoard(save, utc = new Date()) {
  const state = normalizeMissionState(save?.missionState);
  const story = STORY_MISSIONS.map((definition) => evaluatedMission(save, state, definition));
  const dailyDefinitions = dailyMissionDefinitions(save, utc);
  for (const active of state.activeMissions) {
    const definition = missionDefinition(active.id);
    if (definition?.type === "daily" && !dailyDefinitions.some(({ id }) => id === definition.id)) dailyDefinitions.push(definition);
  }
  const daily = dailyDefinitions.map((definition) => evaluatedMission(save, state, definition));
  return { version: MISSION_STATE_VERSION, story, daily, state };
}

export function missionSummary(save, utc = new Date()) {
  const board = missionBoard(save, utc);
  const missions = [...board.story, ...board.daily];
  return {
    active: missions.filter(({ status }) => status === "active").length,
    ready: missions.filter(({ status }) => status === "ready").length,
    storyClaimed: board.story.filter(({ status }) => status === "claimed").length,
    storyTotal: board.story.length,
  };
}

export function acceptMission(save, missionId, acceptedAt = new Date().toISOString()) {
  const state = normalizeMissionState(save?.missionState);
  const definition = missionDefinition(missionId);
  if (!definition) return { save, accepted: false, reason: "UNKNOWN_MISSION", mission: null };
  const boardMission = [...missionBoard({ ...save, missionState: state }, acceptedAt).story,
    ...missionBoard({ ...save, missionState: state }, acceptedAt).daily].find(({ id }) => id === missionId);
  if (!boardMission || boardMission.status === "locked") return { save, accepted: false, reason: "MISSION_LOCKED", mission: boardMission ?? definition };
  if (["active", "ready"].includes(boardMission.status)) return { save, accepted: false, reason: "MISSION_ALREADY_ACTIVE", mission: boardMission };
  if (boardMission.status === "claimed") return { save, accepted: false, reason: "MISSION_ALREADY_CLAIMED", mission: boardMission };
  const activeDaily = state.activeMissions.filter(({ id }) => missionDefinition(id)?.type === "daily").length;
  if (definition.type === "daily" && activeDaily >= MAX_ACTIVE_DAILY_MISSIONS) {
    return { save, accepted: false, reason: "DAILY_MISSION_LIMIT", mission: boardMission };
  }
  if (definition.type === "story" && state.activeMissions.some(({ id }) => missionDefinition(id)?.type === "story")) {
    return { save, accepted: false, reason: "STORY_MISSION_LIMIT", mission: boardMission };
  }
  const activeRecord = {
    id: definition.id,
    acceptedAt,
    baselineQsoIds: (Array.isArray(save?.qsoLogs) ? save.qsoLogs.slice(-200) : [])
      .map(({ id }) => id).filter(Boolean),
    baselineLightsRunIds: (Array.isArray(save?.lightsEventState?.settledRunIds)
      ? save.lightsEventState.settledRunIds.slice(-200) : []).map((id) => String(id)).filter(Boolean),
    baselineExpeditionRunIds: (Array.isArray(save?.expeditionState?.settledRunIds)
      ? save.expeditionState.settledRunIds.slice(-200) : []).map((id) => String(id)).filter(Boolean),
    baselineQslStoryRunIds: (Array.isArray(save?.storyContinuationState?.chapter07?.settledRunIds)
      ? save.storyContinuationState.chapter07.settledRunIds.slice(-100) : [])
      .map((id) => String(id)).filter(Boolean),
    baselineServiceNetRunIds: (Array.isArray(save?.storyContinuationState?.chapter08?.settledRunIds)
      ? save.storyContinuationState.chapter08.settledRunIds.slice(-100) : [])
      .map((id) => String(id)).filter(Boolean),
    baselineCoordinateRelayRunIds: (Array.isArray(save?.storyContinuationState?.chapter09?.settledRunIds)
      ? save.storyContinuationState.chapter09.settledRunIds.slice(-100) : [])
      .map((id) => String(id)).filter(Boolean),
    baselineContestRunIds: (Array.isArray(save?.storyContinuationState?.chapter10?.settledRunIds)
      ? save.storyContinuationState.chapter10.settledRunIds.slice(-100) : [])
      .map((id) => String(id)).filter(Boolean),
    baselineListeningRunIds: (Array.isArray(save?.storyContinuationState?.chapter11?.settledRunIds)
      ? save.storyContinuationState.chapter11.settledRunIds.slice(-100) : [])
      .map((id) => String(id)).filter(Boolean),
    baselineStormRelayRunIds: (Array.isArray(save?.storyContinuationState?.chapter12?.settledRunIds)
      ? save.storyContinuationState.chapter12.settledRunIds.slice(-100) : [])
      .map((id) => String(id)).filter(Boolean),
    baselineNightOperationsRunIds: (Array.isArray(save?.storyContinuationState?.chapter13?.settledRunIds)
      ? save.storyContinuationState.chapter13.settledRunIds.slice(-100) : [])
      .map((id) => String(id)).filter(Boolean),
    knownCallsigns: (Array.isArray(save?.operatorRelationships)
      ? save.operatorRelationships.slice(-2000) : [])
      .map(({ callsign }) => callsign).filter(Boolean),
    contract: normalizeMissionContract(definition.contract),
    dnaFingerprint: definition.dna?.fingerprint ?? null,
  };
  const missionState = normalizeMissionState({
    ...state,
    activeMissions: [...state.activeMissions, activeRecord],
  });
  return {
    save: { ...save, missionStateVersion: MISSION_STATE_VERSION, missionState },
    accepted: true, reason: null, mission: boardMission,
  };
}

export function claimMission(save, missionId, claimedAt = new Date().toISOString()) {
  const state = normalizeMissionState(save?.missionState);
  const definition = missionDefinition(missionId);
  if (!definition) return { save, claimed: false, reason: "UNKNOWN_MISSION", mission: null, moneyAwarded: 0, technologyPointsAwarded: 0 };
  const evaluated = evaluatedMission(save, state, definition);
  if (evaluated.status !== "ready") {
    return { save, claimed: false, reason: evaluated.status === "claimed" ? "MISSION_ALREADY_CLAIMED" : "MISSION_NOT_COMPLETE", mission: evaluated, moneyAwarded: 0, technologyPointsAwarded: 0 };
  }
  const moneyAwarded = safeInteger(definition.moneyReward, 1_000_000);
  const technologyPointsAwarded = safeInteger(definition.technologyPointsReward, 1000);
  const missionState = normalizeMissionState({
    ...state,
    activeMissions: state.activeMissions.filter(({ id }) => id !== definition.id),
    claimedMissionIds: [...state.claimedMissionIds, definition.id],
    history: [...state.history, {
      id: definition.id, claimedAt, moneyReward: moneyAwarded, technologyPointsReward: technologyPointsAwarded,
      dnaFingerprint: evaluated.dna?.fingerprint ?? null, outcome: "completed",
    }],
  });
  const revealedName = definition.id === "story-02" ? "MORSE"
    : definition.id === "story-04" ? "NOVA" : definition.id === "story-05" ? "SORA" : null;
  const knownOperatorNames = revealedName
    ? [...new Set([...(Array.isArray(save?.knownOperatorNames) ? save.knownOperatorNames : []), revealedName])]
    : save?.knownOperatorNames;
  const expeditionState = definition.id === "story-06"
    ? { ...(save?.expeditionState ?? {}), expeditionTreeUnlocked: true }
    : save?.expeditionState;
  let continuation = save?.storyContinuationState;
  if (definition.id === "story-07") {
    const current = normalizeStoryContinuationState(save?.storyContinuationState);
    continuation = normalizeStoryContinuationState({
      ...current,
      chapter07: normalizeQslStoryState({ ...current.chapter07, peopleTaskTreeUnlocked: true }),
    });
  }
  if (definition.id === "story-08") {
    const current = normalizeStoryContinuationState(save?.storyContinuationState);
    continuation = normalizeStoryContinuationState({
      ...current,
      chapter08: normalizeServiceNetState({ ...current.chapter08, taskTreeUnlocked: true }),
    });
  }
  if (definition.id === "story-09") {
    const current = normalizeStoryContinuationState(save?.storyContinuationState);
    continuation = normalizeStoryContinuationState({
      ...current,
      chapter09: normalizeCoordinateRelayState({ ...current.chapter09, toolUnlocked: true }),
    });
  }
  if (definition.id === "story-10") {
    const current = normalizeStoryContinuationState(save?.storyContinuationState);
    continuation = normalizeStoryContinuationState({
      ...current,
      chapter10: normalizeContestState({ ...current.chapter10, taskTreeUnlocked: true }),
    });
  }
  if (definition.id === "story-11") {
    const current = normalizeStoryContinuationState(save?.storyContinuationState);
    continuation = normalizeStoryContinuationState({
      ...current,
      chapter11: normalizeListeningState({ ...current.chapter11, taskTreeUnlocked: true }),
    });
  }
  if (definition.id === "story-12") {
    const current = normalizeStoryContinuationState(save?.storyContinuationState);
    continuation = normalizeStoryContinuationState({
      ...current,
      chapter12: normalizeStormRelayState({ ...current.chapter12, taskTreeUnlocked: true }),
    });
  }
  if (definition.id === "story-13") {
    const current = normalizeStoryContinuationState(save?.storyContinuationState);
    continuation = normalizeStoryContinuationState({
      ...current,
      chapter13: normalizeNightOperationsState({ ...current.chapter13, taskTreeUnlocked: true }),
    });
  }
  return {
    save: {
      ...save,
      missionStateVersion: MISSION_STATE_VERSION,
      missionState,
      money: safeAdd(save?.money, moneyAwarded),
      technologyPoints: safeAdd(save?.technologyPoints, technologyPointsAwarded),
      ...(knownOperatorNames ? { knownOperatorNames } : {}),
      ...(expeditionState ? { expeditionState } : {}),
      ...(continuation ? { storyContinuationState: continuation } : {}),
    },
    claimed: true,
    reason: null,
    mission: evaluated,
    moneyAwarded,
    technologyPointsAwarded,
  };
}

export function recordMissionQsoEvent(save, log) {
  if (!save || typeof save !== "object" || !log || typeof log !== "object") return save;
  const qsoId = String(log.id ?? "").trim().slice(0, 96);
  const occurredAt = normalizeIso(log.completedAt);
  if (!qsoId || !occurredAt) return save;
  const state = normalizeMissionState(save.missionState);
  if (state.activeMissions.length === 0 || state.events.some((event) => event.qsoId === qsoId)) return save;
  const evaluations = state.activeMissions.map((active) => {
    const definition = missionDefinition(active.id);
    const failures = definition ? missionContractFailures(definition, active, log) : ["UNKNOWN_MISSION"];
    const progressed = Boolean(definition && failures.length === 0
      && evaluateObjective(definition, [log], save, active).current > 0);
    return { active, definition, failures, progressed };
  });
  const missionIds = evaluations.filter(({ progressed }) => progressed).map(({ active }) => active.id);
  const event = normalizeMissionEvent({
    id: `mission-qso:${qsoId}`,
    qsoId,
    occurredAt,
    callsign: log.callsign,
    missionIds,
    missionPhases: evaluations.map(({ active }) => active.contract?.missionPhase).filter(Boolean),
    requiredTopics: evaluations.flatMap(({ active }) => active.contract?.requiredTopics ?? []),
    recoveryActions: evaluations.flatMap(({ active }) => active.contract?.recoveryActions ?? []),
    outcome: missionIds.length > 0 ? "progress" : "unmatched",
    failureReasons: evaluations.flatMap(({ failures }) => failures),
    facts: {
      propagationLevel: log.finalPropagationLevel,
      optionalTopic: log.optionalExchangeQuestion,
      optionalAnswered: log.optionalExchangeOutcome === "answered",
      recovered: usedRecovery(log),
      independentWatch: log.independentWatch === true,
      equipmentId: log.equipmentId,
      antennaId: log.antennaId,
    },
  });
  if (!event) return save;
  return {
    ...save,
    missionStateVersion: MISSION_STATE_VERSION,
    missionState: normalizeMissionState({ ...state, events: [...state.events, event] }),
  };
}

export function recentMissionDna(save) {
  const state = normalizeMissionState(save?.missionState);
  return state.history.map(({ dnaFingerprint }) => dnaFingerprint).filter(Boolean).slice(-RECENT_MISSION_DNA_LIMIT);
}

export function targetCallsignForActiveMission(save) {
  const state = normalizeMissionState(save?.missionState);
  for (const active of state.activeMissions) {
    const definition = missionDefinition(active.id);
    if (definition?.targetCallsign) return definition.targetCallsign;
  }
  return null;
}

export function abandonMission(save, missionId) {
  const state = normalizeMissionState(save?.missionState);
  if (!state.activeMissions.some(({ id }) => id === missionId)) {
    return { save, abandoned: false, reason: "MISSION_NOT_ACTIVE" };
  }
  return {
    save: {
      ...save,
      missionStateVersion: MISSION_STATE_VERSION,
      missionState: normalizeMissionState({ ...state, activeMissions: state.activeMissions.filter(({ id }) => id !== missionId) }),
    },
    abandoned: true,
    reason: null,
  };
}
