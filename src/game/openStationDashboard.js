import { ACHIEVEMENT_CATALOG, normalizeClaimedAchievementRewards } from "./achievements.js";
import { ACCESSORIES } from "./accessoryCatalog.js";
import { ANTENNAS } from "./antennaCatalog.js";
import { TRANSMITTERS } from "./equipmentCatalog.js";
import { normalizeOpenStationGoal, normalizeOpenStationState } from "./openStationState.js";
import { normalizeStoryContinuationState, STORY_CONTINUATION_STATE_VERSION } from "./storyContinuationState.js";
import { TECHNOLOGIES } from "./technologyTree.js";

export const OPEN_STATION_DASHBOARD_VERSION = 1;
export const OPEN_STATION_LINE_IDS = Object.freeze(["world-log", "award-wall", "people-network", "station-engineering", "annual-career"]);

function own(value, key) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  try { const descriptor = Object.getOwnPropertyDescriptor(value, key); return descriptor && Object.hasOwn(descriptor, "value") ? descriptor.value : undefined; }
  catch { return undefined; }
}
function integer(value) { const numeric = Number(value); return Number.isFinite(numeric) ? Math.min(Number.MAX_SAFE_INTEGER, Math.max(0, Math.floor(numeric))) : 0; }
function iso(value) { if (typeof value !== "string" || value.length > 32) return null; const time = Date.parse(value); return Number.isFinite(time) && new Date(time).toISOString() === value ? value : null; }
function ownTail(value, maximum) {
  if (!Array.isArray(value)) return [];
  let length; try { length = Object.getOwnPropertyDescriptor(value, "length")?.value; } catch { return []; }
  if (!Number.isSafeInteger(length) || length < 0) return [];
  const result = [];
  for (let index = Math.max(0, length - maximum); index < length; index += 1) {
    let descriptor; try { descriptor = Object.getOwnPropertyDescriptor(value, String(index)); } catch { return []; }
    if (!descriptor || !Object.hasOwn(descriptor, "value")) return [];
    result.push(descriptor.value);
  }
  return result;
}
function stringSet(value, maximum, allowed = null) {
  const result = new Set();
  for (const candidate of ownTail(value, maximum)) {
    if (typeof candidate === "string" && candidate.length <= 96 && candidate.trim() === candidate
      && candidate && (!allowed || allowed.has(candidate))) result.add(candidate);
  }
  return result;
}
function validOrdinaryLogs(save) {
  const result = [];
  for (const value of ownTail(own(save, "qsoLogs"), 200)) {
    const id = own(value, "id"); const callsign = own(value, "callsign"); const personId = own(value, "personId");
    const location = own(value, "location"); const completedAt = iso(own(value, "completedAt"));
    const eventId = own(value, "eventId"); const propagation = Number(own(value, "finalPropagationLevel"));
    if (typeof id === "string" && id && id.length <= 96 && typeof callsign === "string" && /^[A-Z0-9]{3,7}$/.test(callsign)
      && typeof personId === "string" && personId && personId.length <= 96 && typeof location === "string" && location && location.length <= 32
      && completedAt && (eventId === null || eventId === undefined) && Number.isFinite(propagation) && propagation >= 0 && propagation <= 4) {
      result.push({ id, callsign, personId, location, completedAt, propagation: Math.round(propagation) });
    }
  }
  return result;
}
function prefixFor(callsign) { return /^[A-Z]+\d/.exec(callsign)?.[0] ?? callsign.slice(0, 3); }
function line(id, facts) { return Object.freeze({ id, facts: Object.freeze(facts) }); }

export function buildOpenStationDashboard(save) {
  const continuation = normalizeStoryContinuationState(own(save, "storyContinuationState"));
  const state = normalizeOpenStationState(continuation.openStation);
  const base = { version: OPEN_STATION_DASHBOARD_VERSION, unlocked: state.unlocked,
    firstGoal: state.firstGoal, activeGoal: state.activeGoal, goalUpdatedAt: state.goalUpdatedAt };
  if (!state.unlocked) return Object.freeze({ ...base, lines: Object.freeze([]), recent: Object.freeze([]) });

  const logs = validOrdinaryLogs(save);
  const records = own(save, "qsoRecords");
  const regions = stringSet(own(records, "contactedRegions"), 64);
  const claimedAchievements = normalizeClaimedAchievementRewards(own(save, "claimedAchievementRewards"));
  const claimedStories = [...stringSet(own(own(save, "missionState"), "claimedMissionIds"), 400)]
    .filter((id) => /^story-(?:0[1-9]|1[0-5])$/.test(id));
  const relationships = ownTail(own(save, "operatorRelationships"), 2000).filter((entry) => typeof own(entry, "personId") === "string");
  const qslRecords = ownTail(own(save, "qslRecords"), 100).filter((entry) => typeof own(entry, "id") === "string");
  const technologyIds = new Set(TECHNOLOGIES.map(({ id }) => id));
  const technologies = stringSet(own(save, "unlockedTechnologies"), TECHNOLOGIES.length, technologyIds);
  const radioIds = new Set(TRANSMITTERS.map(({ id }) => id)); const antennaIds = new Set(ANTENNAS.map(({ id }) => id)); const accessoryIds = new Set(ACCESSORIES.map(({ id }) => id));
  const ownedItems = stringSet(own(save, "ownedEquipment"), 32, radioIds).size
    + stringSet(own(save, "ownedAntennas"), 32, antennaIds).size + stringSet(own(save, "accessories"), 32, accessoryIds).size;
  const annualRuns = ownTail(own(own(save, "eventRunArchive"), "annualBests"), 20);
  const legacyAnnual = ownTail(own(own(save, "lightsEventState"), "annualBests"), 20);
  const lightYears = new Set([...annualRuns, ...legacyAnnual].map((entry) => integer(own(entry, "year"))).filter((year) => year >= 1970 && year <= 9999));
  const expeditions = ownTail(own(own(save, "expeditionState"), "completedRuns"), 80)
    .filter((entry) => typeof own(entry, "runId") === "string").length;
  const contestBest = integer(own(own(continuation.chapter10, "personalBest"), "score"));
  const lines = Object.freeze([
    line("world-log", { ordinaryQsos: Math.max(integer(own(records, "total")), logs.length), regions: regions.size,
      people: new Set(logs.map(({ personId }) => personId)).size, propagationConditions: new Set(logs.map(({ propagation }) => propagation)).size,
      prefixes: new Set(logs.map(({ callsign }) => prefixFor(callsign)).filter(Boolean)).size }),
    line("award-wall", { achievements: claimedAchievements.filter((id) => ACHIEVEMENT_CATALOG.some((entry) => entry.id === id)).length, storyCertificates: claimedStories.length }),
    line("people-network", { relationships: new Set(relationships.map((entry) => own(entry, "personId"))).size, qslRecords: qslRecords.length }),
    line("station-engineering", { technologies: technologies.size, ownedItems }),
    line("annual-career", { lightsYears: lightYears.size, expeditions, contestBest, activeGoal: state.activeGoal }),
  ]);
  const recent = Object.freeze(logs.slice(0, 8).map(({ id, callsign, location, completedAt }) => Object.freeze({ id, kind: "ordinary-qso", callsign, location, completedAt })));
  return Object.freeze({ ...base, lines, recent });
}

export function updateOpenStationGoal(save, goalValue, updatedAtValue) {
  if (!save || typeof save !== "object" || Array.isArray(save)) throw new TypeError("A save record is required.");
  const continuation = normalizeStoryContinuationState(own(save, "storyContinuationState"));
  const state = normalizeOpenStationState(continuation.openStation);
  if (!state.unlocked) return { save, updated: false, reason: "OPEN_STATION_LOCKED" };
  const goal = normalizeOpenStationGoal(goalValue); if (!goal) return { save, updated: false, reason: "INVALID_GOAL" };
  const updatedAt = iso(updatedAtValue);
  if (!updatedAt || Date.parse(updatedAt) < Date.parse(state.goalUpdatedAt)) return { save, updated: false, reason: "INVALID_UPDATE_TIME" };
  if (goal === state.activeGoal) return { save, updated: false, reason: "GOAL_ALREADY_ACTIVE" };
  const openStation = normalizeOpenStationState({ ...state, activeGoal: goal, goalUpdatedAt: updatedAt });
  if (!openStation.unlocked || openStation.firstGoal !== state.firstGoal || openStation.activeGoal !== goal) return { save, updated: false, reason: "STATE_REJECTED" };
  return { save: { ...save, storyContinuationStateVersion: STORY_CONTINUATION_STATE_VERSION,
    storyContinuationState: Object.freeze({ ...continuation, openStation }) }, updated: true, reason: null };
}
