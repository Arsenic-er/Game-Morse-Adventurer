export const MISSION_STATE_VERSION = 1;
export const MAX_ACTIVE_DAILY_MISSIONS = 2;
export const STORY_MISSION_IDS = Object.freeze(["story-01", "story-02", "story-03"]);

const DAILY_KINDS = Object.freeze(["clean", "weak", "regions", "distance", "independent"]);
const STORY_MISSIONS = Object.freeze([
  Object.freeze({
    id: "story-01", type: "story", chapter: 1, titleKey: "story01Title", descriptionKey: "story01Description",
    objectiveKey: "story01Objective", objective: "first-qso", target: 1, moneyReward: 150, technologyPointsReward: 0,
  }),
  Object.freeze({
    id: "story-02", type: "story", chapter: 2, titleKey: "story02Title", descriptionKey: "story02Description",
    objectiveKey: "story02Objective", objective: "old-friend-repeat", target: 1, targetCallsign: "SIM3RA",
    prerequisiteId: "story-01", moneyReward: 220, technologyPointsReward: 1,
  }),
  Object.freeze({
    id: "story-03", type: "story", chapter: 3, titleKey: "story03Title", descriptionKey: "story03Description",
    objectiveKey: "story03Objective", objective: "operator-styles", target: 3, prerequisiteId: "story-02",
    moneyReward: 300, technologyPointsReward: 1,
  }),
]);

const DAILY_TEMPLATES = Object.freeze({
  clean: Object.freeze({ titleKey: "cleanTitle", descriptionKey: "cleanDescription", objectiveKey: "cleanObjective", objective: "clean-qso", target: 1, moneyReward: 120 }),
  weak: Object.freeze({ titleKey: "weakTitle", descriptionKey: "weakDescription", objectiveKey: "weakObjective", objective: "weak-qso", target: 1, moneyReward: 190 }),
  regions: Object.freeze({ titleKey: "regionsTitle", descriptionKey: "regionsDescription", objectiveKey: "regionsObjective", objective: "distinct-regions", target: 2, moneyReward: 170 }),
  distance: Object.freeze({ titleKey: "distanceTitle", descriptionKey: "distanceDescription", objectiveKey: "distanceObjective", objective: "distance-qso", target: 1, moneyReward: 180 }),
  independent: Object.freeze({ titleKey: "independentTitle", descriptionKey: "independentDescription", objectiveKey: "independentObjective", objective: "independent-qso", target: 1, moneyReward: 210 }),
});

function safeInteger(value, maximum = Number.MAX_SAFE_INTEGER) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? Math.min(maximum, Math.max(0, Math.floor(numeric))) : 0;
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
  return knownMissionId(id) && acceptedAt ? { id, acceptedAt } : null;
}

export function emptyMissionState() {
  return {
    version: MISSION_STATE_VERSION,
    activeMissions: [],
    claimedMissionIds: [],
    history: [],
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
    };
  }).filter(Boolean).slice(-80);
  return {
    version: MISSION_STATE_VERSION,
    activeMissions: activeMissions.filter(({ id }) => !claimed.has(id)).slice(0, 4),
    claimedMissionIds,
    history,
  };
}

function dailyDefinitionForId(id) {
  const match = /^daily:(\d{4}-\d{2}-\d{2}):([a-z-]+)$/.exec(String(id ?? ""));
  if (!match || !DAILY_KINDS.includes(match[2])) return null;
  const template = DAILY_TEMPLATES[match[2]];
  return Object.freeze({
    ...template,
    id: `daily:${match[1]}:${match[2]}`,
    dayKey: match[1],
    kind: match[2],
    type: "daily",
    technologyPointsReward: 0,
  });
}

export function dailyMissionDefinitions(save, utc = new Date()) {
  const dayKey = utcDayKey(utc);
  const seed = hashString(`${save?.id ?? "station"}:${dayKey}:mission-board-v1`);
  const ordered = [...DAILY_KINDS]
    .map((kind, index) => ({ kind, order: hashString(`${seed}:${kind}:${index}`) }))
    .sort((left, right) => left.order - right.order || left.kind.localeCompare(right.kind))
    .slice(0, 3);
  return ordered.map(({ kind }) => dailyDefinitionForId(`daily:${dayKey}:${kind}`));
}

function missionDefinition(id) {
  return STORY_MISSIONS.find((mission) => mission.id === id) ?? dailyDefinitionForId(id);
}

function logsForMission(save, active, definition) {
  const logs = Array.isArray(save?.qsoLogs) ? save.qsoLogs : [];
  if (definition.type === "story") return logs;
  const acceptedAt = Date.parse(active?.acceptedAt ?? "");
  if (!Number.isFinite(acceptedAt)) return [];
  return logs.filter((entry) => Date.parse(entry?.completedAt) >= acceptedAt);
}

function evaluateObjective(definition, logs, save) {
  let current = 0;
  if (definition.objective === "first-qso") current = Math.max(safeInteger(save?.qsoRecords?.total), logs.length);
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
  if (definition.objective === "clean-qso") {
    current = logs.filter((entry) => safeInteger(entry?.repeatRequests) === 0
      && Number(entry?.transmitAccuracy) >= 85 && Number(entry?.keyingScore) >= 75).length;
  }
  if (definition.objective === "weak-qso") current = logs.filter((entry) => Number(entry?.finalPropagationLevel) <= 2).length;
  if (definition.objective === "distinct-regions") current = new Set(logs.map((entry) => String(entry?.location ?? "").trim()).filter(Boolean)).size;
  if (definition.objective === "distance-qso") current = logs.filter((entry) => Number(entry?.distanceKm) >= 3000).length;
  if (definition.objective === "independent-qso") current = logs.filter((entry) => entry?.independentWatch === true).length;
  return { current: Math.min(current, definition.target), complete: current >= definition.target };
}

function evaluatedMission(save, state, definition) {
  const claimed = state.claimedMissionIds.includes(definition.id);
  const active = state.activeMissions.find((mission) => mission.id === definition.id) ?? null;
  const locked = definition.type === "story" && definition.prerequisiteId
    ? !state.claimedMissionIds.includes(definition.prerequisiteId)
    : false;
  const progress = evaluateObjective(definition, logsForMission(save, active, definition), save);
  const status = claimed ? "claimed" : locked ? "locked" : active
    ? progress.complete ? "ready" : "active"
    : "available";
  return { ...definition, ...progress, status, acceptedAt: active?.acceptedAt ?? null };
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
  const missionState = normalizeMissionState({
    ...state,
    activeMissions: [...state.activeMissions, { id: definition.id, acceptedAt }],
  });
  return { save: { ...save, missionState }, accepted: true, reason: null, mission: boardMission };
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
    history: [...state.history, { id: definition.id, claimedAt, moneyReward: moneyAwarded, technologyPointsReward: technologyPointsAwarded }],
  });
  const knownOperatorNames = definition.id === "story-02"
    ? [...new Set([...(Array.isArray(save?.knownOperatorNames) ? save.knownOperatorNames : []), "MORSE"])]
    : save?.knownOperatorNames;
  return {
    save: {
      ...save,
      missionState,
      money: safeInteger(save?.money) + moneyAwarded,
      technologyPoints: safeInteger(save?.technologyPoints) + technologyPointsAwarded,
      ...(knownOperatorNames ? { knownOperatorNames } : {}),
    },
    claimed: true,
    reason: null,
    mission: evaluated,
    moneyAwarded,
    technologyPointsAwarded,
  };
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
      missionState: normalizeMissionState({ ...state, activeMissions: state.activeMissions.filter(({ id }) => id !== missionId) }),
    },
    abandoned: true,
    reason: null,
  };
}
