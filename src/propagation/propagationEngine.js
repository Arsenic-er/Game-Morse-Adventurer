import { clamp } from "../cw/morse.js";

export const GRID_WIDTH = 72;
export const GRID_HEIGHT = 36;
export const FREQUENCY_MHZ = 21.06;

export const DEFAULT_PLAYER_LOCATION = Object.freeze({ id: "JA-ISHIKAWA", label: "Ishikawa / JA", latitude: 36.56, longitude: 136.65 });

export const NPC_STATIONS = Object.freeze([
  { callsign: "SIM7QX", regionId: "NA-W", latitude: 37.77, longitude: -122.42, wpm: 18, baseToneHz: 650, stationBonus: 0, isStrongStation: false, isFictional: true },
  { callsign: "SIM3RA", regionId: "NA-E", latitude: 40.71, longitude: -74.0, wpm: 17, baseToneHz: 646, stationBonus: 1, isStrongStation: true, isFictional: true },
  { callsign: "SIM9AK", regionId: "EU-W", latitude: 51.51, longitude: -0.13, wpm: 20, baseToneHz: 652, stationBonus: 0, isStrongStation: false, isFictional: true },
  { callsign: "SIM5TU", regionId: "EU-C", latitude: 52.52, longitude: 13.4, wpm: 19, baseToneHz: 648, stationBonus: 0, isStrongStation: false, isFictional: true },
  { callsign: "SIM2DX", regionId: "AF-S", latitude: -33.92, longitude: 18.42, wpm: 16, baseToneHz: 655, stationBonus: 1, isStrongStation: true, isFictional: true },
  { callsign: "SIM8CW", regionId: "OC-AU", latitude: -33.87, longitude: 151.21, wpm: 18, baseToneHz: 651, stationBonus: 0, isStrongStation: false, isFictional: true },
  { callsign: "SIM4NZ", regionId: "OC-NZ", latitude: -36.85, longitude: 174.76, wpm: 17, baseToneHz: 649, stationBonus: 1, isStrongStation: true, isFictional: true },
  { callsign: "SIM6JP", regionId: "AS-JA", latitude: 35.68, longitude: 139.76, wpm: 19, baseToneHz: 653, stationBonus: 0, isStrongStation: false, isFictional: true },
  { callsign: "SIM1IN", regionId: "AS-IN", latitude: 28.61, longitude: 77.21, wpm: 16, baseToneHz: 647, stationBonus: 0, isStrongStation: false, isFictional: true },
  { callsign: "SIM0BR", regionId: "SA-BR", latitude: -23.55, longitude: -46.63, wpm: 18, baseToneHz: 654, stationBonus: 0, isStrongStation: false, isFictional: true },
]);

function radians(degrees) { return degrees * Math.PI / 180; }
function normalizeLongitude(longitude) { return ((longitude + 180) % 360 + 360) % 360 - 180; }
function localSolarHour(utcHour, longitude) { return ((utcHour + longitude / 15) % 24 + 24) % 24; }
function daylightFactor(hour) { return clamp(1 - Math.abs(hour - 13) / 8.5, 0, 1); }

export function greatCircleDistanceDegrees(left, right) {
  const lat1 = radians(left.latitude);
  const lat2 = radians(right.latitude);
  const lonDelta = radians(right.longitude - left.longitude);
  const cosine = Math.sin(lat1) * Math.sin(lat2) + Math.cos(lat1) * Math.cos(lat2) * Math.cos(lonDelta);
  return Math.acos(clamp(cosine, -1, 1)) * 180 / Math.PI;
}

function cellLevel({ latitude, longitude, playerLocation, utcHour, template }) {
  const targetDay = daylightFactor(localSolarHour(utcHour, longitude));
  const playerDay = daylightFactor(localSolarHour(utcHour, playerLocation.longitude));
  const distance = greatCircleDistanceDegrees(playerLocation, { latitude, longitude });
  const pathFactor = Math.max(0, 1 - Math.abs(distance - 72) / 95);
  const grayLine = Math.max(0, 1 - Math.abs(targetDay - .35) / .5);
  const latitudePenalty = Math.max(0, (Math.abs(latitude) - 58) / 35);
  const wave = .28 * Math.sin(radians(longitude * 2 + template * 47)) + .22 * Math.cos(radians(latitude * 3 - template * 31));
  const score = .35 + 1.65 * Math.sqrt(targetDay * Math.max(.2, playerDay)) + 1.25 * pathFactor + .45 * grayLine + wave - latitudePenalty;
  if (score < .75) return 0;
  if (score < 1.35) return 1;
  if (score < 1.9) return 2;
  if (score < 2.35) return 3;
  return 4;
}

export function generatePropagationMap({ playerLocation = DEFAULT_PLAYER_LOCATION, utc = new Date() } = {}) {
  const date = utc instanceof Date ? utc : new Date(utc);
  const utcHour = date.getUTCHours() + date.getUTCMinutes() / 60;
  const template = Math.floor(date.getUTCHours() / 6);
  const cells = new Array(GRID_WIDTH * GRID_HEIGHT);
  for (let y = 0; y < GRID_HEIGHT; y += 1) {
    const latitude = 90 - (y + .5) * 180 / GRID_HEIGHT;
    for (let x = 0; x < GRID_WIDTH; x += 1) {
      const longitude = -180 + (x + .5) * 360 / GRID_WIDTH;
      cells[y * GRID_WIDTH + x] = cellLevel({ latitude, longitude, playerLocation, utcHour, template });
    }
  }
  return {
    frequencyMhz: FREQUENCY_MHZ,
    generatedAtUtc: date.toISOString(),
    source: "OFFLINE_DEFAULT",
    gridWidth: GRID_WIDTH,
    gridHeight: GRID_HEIGHT,
    playerLocation: { ...playerLocation, longitude: normalizeLongitude(playerLocation.longitude) },
    template,
    cells,
  };
}

export function cellCoordinatesForLocation(location) {
  const longitude = normalizeLongitude(location.longitude);
  const latitude = clamp(location.latitude, -89.999, 89.999);
  return {
    x: clamp(Math.floor((longitude + 180) / 360 * GRID_WIDTH), 0, GRID_WIDTH - 1),
    y: clamp(Math.floor((90 - latitude) / 180 * GRID_HEIGHT), 0, GRID_HEIGHT - 1),
  };
}

export function baseLevelAt(map, location) {
  const { x, y } = cellCoordinatesForLocation(location);
  return map.cells[y * map.gridWidth + x];
}

export function finalPropagationLevel(baseLevel, playerEquipmentBonus = 0, npcStationBonus = 0) {
  return Math.round(clamp(baseLevel + playerEquipmentBonus + npcStationBonus, 0, 4));
}

export function evaluatedNpcStations(map, { playerEquipmentBonus = 0, stations = NPC_STATIONS } = {}) {
  return stations.map((npc) => {
    const baseLevel = baseLevelAt(map, npc);
    const finalLevel = finalPropagationLevel(baseLevel, playerEquipmentBonus, npc.stationBonus);
    const eligible = finalLevel >= 2 || (finalLevel === 1 && npc.isStrongStation);
    const weight = eligible ? [0, 1, 3, 6, 9][finalLevel] * (npc.isStrongStation ? .45 : 1) : 0;
    return { ...npc, baseLevel, finalLevel, eligible, weight };
  });
}

function hashString(value) {
  let hash = 2166136261;
  for (const character of String(value)) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function selectNpcForQso(map, { playerEquipmentBonus = 0, stations = NPC_STATIONS, seed } = {}) {
  const evaluated = evaluatedNpcStations(map, { playerEquipmentBonus, stations });
  let candidates = evaluated.filter((npc) => npc.eligible && npc.weight > 0);
  if (!candidates.length) {
    const fallback = [...evaluated].sort((left, right) => right.finalLevel - left.finalLevel || Number(right.isStrongStation) - Number(left.isStrongStation))[0];
    return fallback ? { ...fallback, eligible: true, fallback: true } : null;
  }
  const totalWeight = candidates.reduce((total, npc) => total + npc.weight, 0);
  const bucket = seed ?? `${map.generatedAtUtc.slice(0, 13)}:${map.playerLocation.latitude.toFixed(1)}:${map.playerLocation.longitude.toFixed(1)}`;
  let cursor = (hashString(bucket) / 0xffffffff) * totalWeight;
  for (const npc of candidates) {
    cursor -= npc.weight;
    if (cursor <= 0) return npc;
  }
  return candidates[candidates.length - 1];
}

export function channelProfileForLevel(level, npc = {}, modifiers = {}) {
  const profiles = [
    { noiseGain: .2, qsbDepth: .9, qsbRateHz: .7, signalGain: .25, offset: 9 },
    { noiseGain: .14, qsbDepth: .72, qsbRateHz: .55, signalGain: .42, offset: 7 },
    { noiseGain: .085, qsbDepth: .46, qsbRateHz: .4, signalGain: .62, offset: 4 },
    { noiseGain: .04, qsbDepth: .22, qsbRateHz: .28, signalGain: .82, offset: 2 },
    { noiseGain: .018, qsbDepth: .08, qsbRateHz: .18, signalGain: 1, offset: 1 },
  ];
  const safeLevel = Math.round(clamp(level, 0, 4));
  const base = profiles[safeLevel];
  const direction = hashString(npc.callsign ?? "SIM") % 2 ? 1 : -1;
  const qsbDepthMultiplier = Number.isFinite(modifiers.qsbDepthMultiplier)
    ? clamp(modifiers.qsbDepthMultiplier, 0, 2)
    : 1;
  return {
    level: safeLevel,
    noiseGain: base.noiseGain,
    qsbDepth: base.qsbDepth * qsbDepthMultiplier,
    qsbRateHz: base.qsbRateHz,
    signalGain: base.signalGain,
    frequencyOffsetHz: direction * (Number.isFinite(npc.frequencyOffsetHz) ? Math.abs(npc.frequencyOffsetHz) : base.offset),
    toneHz: Number(npc.baseToneHz) || 650,
  };
}

export function locationFromNormalizedPoint(x, y) {
  return {
    latitude: Number((90 - clamp(y, 0, 1) * 180).toFixed(2)),
    longitude: Number((-180 + clamp(x, 0, 1) * 360).toFixed(2)),
  };
}

export function normalizedPointFromLocation(location) {
  const latitude = clamp(Number(location?.latitude) || 0, -90, 90);
  const longitude = clamp(Number(location?.longitude) || 0, -180, 180);
  return {
    x: (longitude + 180) / 360,
    y: (90 - latitude) / 180,
  };
}
