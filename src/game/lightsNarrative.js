import { LIGHTS_PHASES } from "./lightsRun.js";

export const LIGHTS_NARRATIVE_KEYS = Object.freeze({
  novaAnnouncement: "narrativeNovaAnnouncement",
  soraChase: "narrativeSoraChase",
  soraInvitation: "narrativeSoraInvitation",
  soraHandoff: "narrativeSoraHandoff",
  morseSignoff: "narrativeMorseSignoff",
  soraDebriefIdentification: "narrativeSoraDebriefIdentification",
  soraDebriefNoContacts: "narrativeSoraDebriefNoContacts",
  soraDebriefCoverage: "narrativeSoraDebriefCoverage",
  soraDebriefTiming: "narrativeSoraDebriefTiming",
});

const ON_AIR_PHASES = new Set(Object.values(LIGHTS_PHASES).filter((phase) => phase !== LIGHTS_PHASES.RUN_COMPLETE));
const CHASE_PHASES = new Set([
  LIGHTS_PHASES.CHASE_CQ,
  LIGHTS_PHASES.CHASE_PLAYER_CALL,
  LIGHTS_PHASES.CHASE_NPC_REPORT,
  LIGHTS_PHASES.CHASE_PLAYER_REPORT,
]);

export function isOnAirLightsPhase(phase) {
  return ON_AIR_PHASES.has(phase);
}

function failedNarrativeKey(result) {
  if (Number(result?.misidentificationCount) > 0) return LIGHTS_NARRATIVE_KEYS.soraDebriefIdentification;
  if (Number(result?.validQsoCount) <= 0) return LIGHTS_NARRATIVE_KEYS.soraDebriefNoContacts;
  if (Number(result?.distinctRegionCount) < 3) return LIGHTS_NARRATIVE_KEYS.soraDebriefCoverage;
  return LIGHTS_NARRATIVE_KEYS.soraDebriefTiming;
}

export function lightsNarrativeBeat({ stage = null, phase = null, chaseCompleted = false, result = null } = {}) {
  if (stage === "announcement") {
    return { speaker: "NOVA", textKey: LIGHTS_NARRATIVE_KEYS.novaAnnouncement, showPortrait: true };
  }
  const onAir = isOnAirLightsPhase(phase);
  if (phase === LIGHTS_PHASES.RUN_COMPLETE) {
    return result?.grade && result.grade !== "none"
      ? { speaker: "MORSE", textKey: LIGHTS_NARRATIVE_KEYS.morseSignoff, showPortrait: true }
      : { speaker: "SORA", textKey: failedNarrativeKey(result), showPortrait: true };
  }
  if (phase === LIGHTS_PHASES.CHASE_FINAL) {
    return { speaker: "SORA", textKey: LIGHTS_NARRATIVE_KEYS.soraInvitation, showPortrait: !onAir };
  }
  if (CHASE_PHASES.has(phase)) {
    return { speaker: "SORA", textKey: LIGHTS_NARRATIVE_KEYS.soraChase, showPortrait: !onAir };
  }
  return {
    speaker: "SORA",
    textKey: chaseCompleted ? LIGHTS_NARRATIVE_KEYS.soraHandoff : LIGHTS_NARRATIVE_KEYS.soraChase,
    showPortrait: !onAir,
  };
}

function archiveRuns(archive) {
  if (!archive || typeof archive !== "object" || Array.isArray(archive)) return [];
  return [
    archive.storyBest,
    ...(Array.isArray(archive.annualBests) ? archive.annualBests : []),
    ...(Array.isArray(archive.practiceBests) ? archive.practiceBests : []),
  ].filter((run) => run && typeof run === "object" && !Array.isArray(run));
}

function selectedRun(archive, eventRunId) {
  const runs = archiveRuns(archive);
  if (eventRunId) return runs.find((run) => run.eventRunId === eventRunId) ?? null;
  return archive?.storyBest ?? runs.at(-1) ?? null;
}

function storedContacts(run) {
  return (Array.isArray(run?.contacts) ? run.contacts : []).slice(0, 7).filter((contact) => (
    contact && typeof contact === "object" && typeof contact.eventRegionCode === "string"
  ));
}

function storedLocalDateTime(contact) {
  const instant = new Date(contact?.completedAt);
  if (!Number.isFinite(instant.getTime()) || typeof contact?.timeZone !== "string") return null;
  try {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: contact.timeZone,
      year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", hourCycle: "h23",
    }).formatToParts(instant);
    const value = Object.fromEntries(parts.map(({ type, value: part }) => [type, part]));
    return `${value.year}-${value.month}-${value.day} ${value.hour}:${value.minute}`;
  } catch {
    return null;
  }
}

export function buildLightsMapModel(archive, { eventRunId = null, selectedPersonId = null } = {}) {
  const run = selectedRun(archive, eventRunId);
  const contacts = storedContacts(run);
  const byRegion = new Map();
  for (const contact of contacts) {
    const regionCode = contact.eventRegionCode;
    if (!byRegion.has(regionCode)) byRegion.set(regionCode, []);
    byRegion.get(regionCode).push({ ...contact });
  }
  const lights = [...byRegion].map(([regionCode, regionContacts]) => ({ regionCode, contacts: regionContacts }));
  const selectedContact = contacts.find(({ personId }) => personId === selectedPersonId) ?? contacts[0] ?? null;
  return {
    eventRunId: run?.eventRunId ?? null,
    litRegions: lights.map(({ regionCode }) => regionCode),
    lights,
    selected: selectedContact ? {
      ...selectedContact,
      localDateTime: storedLocalDateTime(selectedContact),
    } : null,
  };
}

function historyRecord(run) {
  return {
    eventRunId: run.eventRunId,
    stationDate: run.stationDate,
    score: run.score,
    grade: run.grade,
    stamp: run.stamp,
    contacts: storedContacts(run).length,
  };
}

export function buildLightsHistoryModel(archive) {
  const annual = Array.isArray(archive?.annualBests) ? archive.annualBests : [];
  const practice = Array.isArray(archive?.practiceBests) ? archive.practiceBests : [];
  return {
    storyBest: archive?.storyBest ? historyRecord(archive.storyBest) : null,
    annualRecords: annual.filter(Boolean).map(historyRecord).sort((a, b) => b.stationDate.localeCompare(a.stationDate)),
    practiceRecords: practice.filter(Boolean).map(historyRecord).sort((a, b) => b.stationDate.localeCompare(a.stationDate)),
  };
}
