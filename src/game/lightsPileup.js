import { encodeTextToEvents, normalizeCwText } from "../cw/morse.js";
import { generateProceduralNpc, PROCEDURAL_NPC_REGIONS } from "../qso/proceduralNpc.js";
import { LIGHTS_EVENT, LIGHTS_EVENT_REGIONS } from "./lightsEventCatalog.js";
import { getLocation } from "./locations.js";
import { personIdForOperator, stationIdentityForCallsign } from "./personIdentity.js";

const REGION_SOURCE = Object.freeze({ JP: "JP", US: "US", CN: "CN", GE: "DE", CH: "CH", FI: "FI" });
const GUIDANCE = Object.freeze({
  full: Object.freeze({ minimumCallers: 2, maximumCallers: 2, minimumWpm: 12, maximumWpm: 16, minimumTone: 540, maximumTone: 720, minimumOffset: 180, maximumOffset: 480 }),
  hints: Object.freeze({ minimumCallers: 2, maximumCallers: 3, minimumWpm: 15, maximumWpm: 20, minimumTone: 520, maximumTone: 760, minimumOffset: 120, maximumOffset: 520 }),
  off: Object.freeze({ minimumCallers: 3, maximumCallers: 4, minimumWpm: 18, maximumWpm: 24, minimumTone: 500, maximumTone: 780, minimumOffset: 80, maximumOffset: 560 }),
});

function hash32(value) {
  let hash = 2166136261;
  for (const character of String(value).normalize("NFC")) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function boundedInteger(seed, minimum, maximum) {
  return minimum + (hash32(seed) % (maximum - minimum + 1));
}

function sourceRegion(eventCode) {
  return PROCEDURAL_NPC_REGIONS.find(({ id }) => id === REGION_SOURCE[eventCode]);
}

function callerFor({ seed, worldSeed, round, guidance, code, index, count }) {
  const source = sourceRegion(code);
  const localIndex = hash32(`${seed}:${round}:${code}:${index}:operator`) % source.quota;
  const npc = generateProceduralNpc({ worldSeed, regionId: source.id, localIndex });
  const pitchStep = count === 1 ? 0 : Math.floor((guidance.maximumTone - guidance.minimumTone) / (count - 1));
  const toneHz = guidance.minimumTone + index * pitchStep;
  const wpm = Math.min(guidance.maximumWpm, Math.max(guidance.minimumWpm, npc.radio.preferredWpm));
  const startOffsetMs = boundedInteger(
    `${seed}:${round}:${index}:offset`, guidance.minimumOffset, guidance.maximumOffset,
  );
  const signalGain = Number((.55 + (hash32(`${seed}:${round}:${index}:gain`) % 46) / 100).toFixed(2));
  const qsbDepth = Number((.08 + (hash32(`${seed}:${round}:${index}:qsb`) % 43) / 100).toFixed(2));
  const text = `${LIGHTS_EVENT.callsign} DE ${npc.station.callsign} ${npc.station.callsign} K`;
  const encoded = encodeTextToEvents(text, { wpm });
  const personId = personIdForOperator({ npcId: npc.npcId, callsign: npc.station.callsign });
  const station = stationIdentityForCallsign(npc.station.callsign, { npcId: npc.npcId });
  return Object.freeze({
    npcId: npc.npcId,
    personId,
    stationId: station.stationId,
    callsign: npc.station.callsign,
    regionCode: code,
    locationId: npc.station.locationId,
    timeZone: getLocation(npc.station.locationId).timeZone,
    operatorName: npc.identity.operatorName,
    operatorProfileId: npc.qso.operatorProfileId,
    wpm,
    toneHz,
    signalGain,
    qsbDepth,
    startOffsetMs,
    text,
    events: Object.freeze(encoded.events.map((event) => Object.freeze({ ...event }))),
  });
}

export function createLightsPileup({
  seed = "lights", worldSeed = seed, round = 1, guidance = "full",
} = {}) {
  const profile = GUIDANCE[guidance] ?? GUIDANCE.full;
  const safeRound = Math.max(1, Math.floor(Number(round) || 1));
  const count = boundedInteger(`${seed}:${safeRound}:count`, profile.minimumCallers, profile.maximumCallers);
  const regionStart = (safeRound - 1) % LIGHTS_EVENT_REGIONS.length;
  const codes = Array.from({ length: count }, (_, index) => (
    LIGHTS_EVENT_REGIONS[(regionStart + index) % LIGHTS_EVENT_REGIONS.length]
  ));
  const callers = codes.map((code, index) => callerFor({
    seed: String(seed), worldSeed: String(worldSeed), round: safeRound,
    guidance: profile, code, index, count,
  }));
  return Object.freeze({
    id: `lights-pileup:${String(seed)}:${safeRound}`,
    seed: String(seed),
    round: safeRound,
    guidance: GUIDANCE[guidance] ? guidance : "full",
    callers: Object.freeze(callers),
  });
}

function partialMatches(callers, token) {
  if ((token.match(/\?/g) ?? []).length !== 1) return [];
  const known = token.replace("?", "");
  if (known.length < 2) return [];
  if (token.startsWith("?")) return callers.filter(({ callsign }) => callsign.endsWith(known));
  if (token.endsWith("?")) return callers.filter(({ callsign }) => callsign.startsWith(known));
  const [prefix, suffix] = token.split("?");
  return callers.filter(({ callsign }) => callsign.startsWith(prefix) && callsign.endsWith(suffix));
}

export function resolveLightsCallsignSelection(pileup, message) {
  const callers = Array.isArray(pileup?.callers) ? pileup.callers : [];
  const normalized = normalizeCwText(message);
  if (/^(AGN|QRZ) K$/.test(normalized)) {
    return { kind: "repeat", selected: null, callers, partial: false };
  }
  const tokens = normalized.split(" ").filter(Boolean);
  const selected = callers.find(({ callsign }) => tokens.includes(callsign));
  if (selected) return { kind: "selected", selected, callers: [selected], partial: false };
  const partialToken = tokens.find((token) => token.includes("?"));
  if (partialToken) {
    const matches = partialMatches(callers, partialToken);
    if (matches.length === 1) return { kind: "selected", selected: matches[0], callers: matches, partial: true };
    if (matches.length > 1) return { kind: "ambiguous", selected: null, callers: matches, partial: true };
    return { kind: "no-match", selected: null, callers, partial: true };
  }
  const ignored = new Set(["K", "KN", "DE", LIGHTS_EVENT.callsign, "AGN", "QRZ"]);
  const suppliedCall = tokens.find((token) => /^[A-Z0-9]{3,7}$/.test(token) && !ignored.has(token));
  return suppliedCall
    ? { kind: "misidentified", selected: null, callers, partial: false }
    : { kind: "no-match", selected: null, callers, partial: false };
}

export function lightsPileupPlaybackLayers(pileup) {
  return (pileup?.callers ?? []).map((caller) => ({
    events: caller.events,
    startOffsetMs: caller.startOffsetMs,
    channel: { toneHz: caller.toneHz, signalGain: caller.signalGain, qsbDepth: caller.qsbDepth },
  }));
}
