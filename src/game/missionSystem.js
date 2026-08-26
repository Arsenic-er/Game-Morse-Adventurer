export const MISSION_STATE_VERSION = 2;
export const MAX_ACTIVE_DAILY_MISSIONS = 2;
export const STORY_MISSION_IDS = Object.freeze(["story-01", "story-02", "story-03", "story-04", "story-05", "story-06"]);
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
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map((item) => String(item ?? "").trim().slice(0, itemLength)).filter(Boolean))].slice(-maximum);
}

function normalizeMissionContract(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return {
    missionPhase: String(value.missionPhase ?? "standard-qso").trim().slice(0, 48) || "standard-qso",
    targetCallsign: String(value.targetCallsign ?? "").trim().toUpperCase().slice(0, 16) || null,
    requiredTopics: normalizeStringList(value.requiredTopics, 12, 32),
    recoveryActions: normalizeStringList(value.recoveryActions, 8, 16),
    maximumPropagationLevel: value.maximumPropagationLevel == null
      ? null : Math.min(4, safeInteger(value.maximumPropagationLevel, 4)),
    recoveryRequired: value.recoveryRequired === true,
    requiredDistinctOperators: safeInteger(value.requiredDistinctOperators, 100),
    eventId: String(value.eventId ?? "").toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 48) || null,
    eventMode: ["story", "annual", "practice"].includes(value.eventMode) ? value.eventMode : null,
    minimumGrade: ["base", "silver", "gold"].includes(value.minimumGrade) ? value.minimumGrade : null,
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

function normalizeMissionEvent(value) {
  const id = String(value?.id ?? "").trim().slice(0, 128);
  const qsoId = String(value?.qsoId ?? "").trim().slice(0, 96);
  const occurredAt = normalizeIso(value?.occurredAt);
  if (!id || !qsoId || !occurredAt) return null;
  return {
    id,
    qsoId,
    occurredAt,
    callsign: String(value?.callsign ?? "").trim().toUpperCase().slice(0, 16),
    missionIds: normalizeStringList(value?.missionIds, 4, 48).filter(knownMissionId),
    missionPhases: normalizeStringList(value?.missionPhases, 4, 48),
    requiredTopics: normalizeStringList(value?.requiredTopics, 12, 32),
    recoveryActions: normalizeStringList(value?.recoveryActions, 8, 16),
    outcome: value?.outcome === "progress" ? "progress" : "unmatched",
    failureReasons: normalizeStringList(value?.failureReasons, 12, 48),
    facts: {
      propagationLevel: Math.min(4, safeInteger(value?.facts?.propagationLevel, 4)),
      optionalTopic: String(value?.facts?.optionalTopic ?? "").trim().slice(0, 32) || null,
      optionalAnswered: value?.facts?.optionalAnswered === true,
      recovered: value?.facts?.recovered === true,
      independentWatch: value?.facts?.independentWatch === true,
      equipmentId: String(value?.facts?.equipmentId ?? "").trim().slice(0, 48) || null,
      antennaId: String(value?.facts?.antennaId ?? "").trim().slice(0, 48) || null,
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
  const id = String(value?.id ?? "").trim();
  const acceptedAt = normalizeIso(value?.acceptedAt);
  return knownMissionId(id) && acceptedAt ? {
    id,
    acceptedAt,
    baselineQsoIds: normalizeStringList(value?.baselineQsoIds, 200, 96),
    baselineLightsRunIds: normalizeStringList(value?.baselineLightsRunIds, 200, 128),
    baselineExpeditionRunIds: normalizeStringList(value?.baselineExpeditionRunIds, 200, 128),
    knownCallsigns: normalizeStringList(value?.knownCallsigns, 2000, 16),
    contract: normalizeMissionContract(value?.contract),
    dnaFingerprint: String(value?.dnaFingerprint ?? "").trim().slice(0, 240) || null,
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
  const source = value && typeof value === "object" ? value : {};
  const activeIds = new Set();
  const activeMissions = [];
  for (const candidate of Array.isArray(source.activeMissions) ? source.activeMissions : []) {
    const normalized = normalizeActiveMission(candidate);
    if (!normalized || activeIds.has(normalized.id)) continue;
    activeIds.add(normalized.id);
    activeMissions.push(normalized);
  }
  const claimedMissionIds = [...new Set((Array.isArray(source.claimedMissionIds) ? source.claimedMissionIds : [])
    .map((id) => String(id ?? "").trim()).filter(knownMissionId))].slice(-400);
  const claimed = new Set(claimedMissionIds);
  const history = (Array.isArray(source.history) ? source.history : []).map((entry) => {
    const id = String(entry?.id ?? "").trim();
    const claimedAt = normalizeIso(entry?.claimedAt);
    if (!knownMissionId(id) || !claimedAt) return null;
    return {
      id,
      claimedAt,
      moneyReward: safeInteger(entry?.moneyReward, 1_000_000),
      technologyPointsReward: safeInteger(entry?.technologyPointsReward, 1000),
      dnaFingerprint: String(entry?.dnaFingerprint ?? "").trim().slice(0, 240) || null,
      outcome: String(entry?.outcome ?? "completed").trim().slice(0, 48) || "completed",
    };
  }).filter(Boolean).slice(-80);
  const events = (Array.isArray(source.events) ? source.events : [])
    .map(normalizeMissionEvent).filter(Boolean).slice(-MISSION_EVENT_LIMIT);
  return {
    version: MISSION_STATE_VERSION,
    activeMissions: activeMissions.filter(({ id }) => !claimed.has(id)).slice(0, 4),
    claimedMissionIds,
    history,
    events,
  };
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
  if (!active) return [];
  const logs = Array.isArray(save?.qsoLogs) ? save.qsoLogs : [];
  const acceptedAt = Date.parse(active.acceptedAt ?? "");
  if (!Number.isFinite(acceptedAt)) return [];
  const baseline = new Set(active.baselineQsoIds ?? []);
  return logs.filter((entry) => !baseline.has(String(entry?.id ?? ""))
    && Date.parse(entry?.completedAt) >= acceptedAt);
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
    const acceptedAt = Date.parse(active?.acceptedAt ?? "");
    const baseline = new Set(active?.baselineExpeditionRunIds ?? []);
    const completedRuns = Array.isArray(save?.expeditionState?.completedRuns)
      ? save.expeditionState.completedRuns.slice(-80) : [];
    current = completedRuns.some((run) => {
      const completedAt = Date.parse(run?.completedAt ?? "");
      return String(run?.runId ?? "") && !baseline.has(String(run.runId))
        && Number.isFinite(acceptedAt) && Number.isFinite(completedAt) && completedAt >= acceptedAt
        && String(run?.qsoId ?? "").trim();
    }) ? 1 : 0;
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
  const locked = definition.type === "story" && definition.prerequisiteId
    ? !state.claimedMissionIds.includes(definition.prerequisiteId)
    : false;
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
    baselineQsoIds: (Array.isArray(save?.qsoLogs) ? save.qsoLogs : []).map(({ id }) => id).filter(Boolean),
    baselineLightsRunIds: (Array.isArray(save?.lightsEventState?.settledRunIds)
      ? save.lightsEventState.settledRunIds : []).map((id) => String(id)).filter(Boolean),
    baselineExpeditionRunIds: (Array.isArray(save?.expeditionState?.settledRunIds)
      ? save.expeditionState.settledRunIds.slice(-200) : []).map((id) => String(id)).filter(Boolean),
    knownCallsigns: (Array.isArray(save?.operatorRelationships) ? save.operatorRelationships : [])
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
  return {
    save: {
      ...save,
      missionStateVersion: MISSION_STATE_VERSION,
      missionState,
      money: safeAdd(save?.money, moneyAwarded),
      technologyPoints: safeAdd(save?.technologyPoints, technologyPointsAwarded),
      ...(knownOperatorNames ? { knownOperatorNames } : {}),
      ...(expeditionState ? { expeditionState } : {}),
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
