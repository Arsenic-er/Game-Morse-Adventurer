export const PROCEDURAL_NPC_SCHEMA_VERSION = 1;
export const PROCEDURAL_NPC_GENERATOR_VERSION = "npcgen-1";
export const PROCEDURAL_NPC_CATALOG_REVISION = 1;

export const PROCEDURAL_NPC_CALLSIGN_SPACE = 36 ** 3;
export const PROCEDURAL_NPC_CALLSIGN_MULTIPLIERS = Object.freeze([5, 7, 11, 13, 17, 19, 23, 25, 29, 31]);
const SUPPORTED_OPTIONAL_EXCHANGE_TOPICS = Object.freeze(new Set(["power", "location", "weather", "name", "age"]));

const locations = Object.freeze({
  JP: Object.freeze([
    Object.freeze({ id: "japan-tokyo-kanto", latitude: 35.6762, longitude: 139.6503 }),
    Object.freeze({ id: "japan-nagano-suwa", latitude: 36.0392, longitude: 138.1142 }),
    Object.freeze({ id: "japan-hokkaido-furano", latitude: 43.342, longitude: 142.383 }),
  ]),
  US: Object.freeze([
    Object.freeze({ id: "usa-pacific-northwest", latitude: 47.6062, longitude: -122.3321 }),
    Object.freeze({ id: "usa-arizona-sonoran", latitude: 32.2226, longitude: -110.9747 }),
    Object.freeze({ id: "usa-new-england", latitude: 42.3601, longitude: -71.0589 }),
  ]),
  CN: Object.freeze([
    Object.freeze({ id: "china-beijing-outskirts", latitude: 39.9042, longitude: 116.4074 }),
    Object.freeze({ id: "china-chengdu-plain", latitude: 30.5728, longitude: 104.0668 }),
    Object.freeze({ id: "china-guilin", latitude: 25.2742, longitude: 110.296 }),
  ]),
  DE: Object.freeze([
    Object.freeze({ id: "europe-rhine-valley", latitude: 49.9929, longitude: 8.2473 }),
  ]),
  CH: Object.freeze([
    Object.freeze({ id: "europe-swiss-lake", latitude: 47.0502, longitude: 8.3093 }),
  ]),
  FI: Object.freeze([
    Object.freeze({ id: "europe-finland-lake", latitude: 62.2426, longitude: 25.7473 }),
  ]),
});

export const PROCEDURAL_NPC_REGIONS = Object.freeze([
  Object.freeze({ id: "JP", countryId: "JP", callPrefix: "SIMJ", quota: 20000, locations: locations.JP }),
  Object.freeze({ id: "US", countryId: "US", callPrefix: "SIMU", quota: 26000, locations: locations.US }),
  Object.freeze({ id: "CN", countryId: "CN", callPrefix: "SIMC", quota: 26000, locations: locations.CN }),
  Object.freeze({ id: "DE", countryId: "DE", callPrefix: "SIMG", quota: 12000, locations: locations.DE }),
  Object.freeze({ id: "CH", countryId: "CH", callPrefix: "SIMH", quota: 7000, locations: locations.CH }),
  Object.freeze({ id: "FI", countryId: "FI", callPrefix: "SIMF", quota: 9000, locations: locations.FI }),
]);

export const PROCEDURAL_NPC_WORLD_SIZE = PROCEDURAL_NPC_REGIONS.reduce(
  (total, region) => total + region.quota,
  0,
);

const names = Object.freeze({
  JP: Object.freeze(["AKIRA", "AOI", "EMI", "HARU", "HINA", "KAITO", "KEN", "MAI", "REN", "RIN", "SORA", "YUI"]),
  US: Object.freeze(["ALEX", "CASEY", "DANA", "ELI", "JAMIE", "JORDAN", "LEE", "MORGAN", "NOVA", "RILEY", "ROBIN", "TAYLOR"]),
  CN: Object.freeze(["AN", "CHEN", "HAO", "JIA", "JUN", "KAI", "LAN", "LIN", "MEI", "WEI", "XIN", "YU"]),
  DE: Object.freeze(["ANJA", "EMIL", "ERIK", "FELIX", "GRETA", "HANS", "INA", "LEON", "MARA", "NINA", "OTTO", "TIMO"]),
  CH: Object.freeze(["ANNA", "ELIA", "FLORIN", "LENA", "LIVIA", "LUCA", "MARA", "NICO", "NOAH", "SILVAN", "TINA", "URS"]),
  FI: Object.freeze(["AINO", "EERO", "ELINA", "ILKKA", "JOEL", "KAISA", "MIKA", "NOORA", "OLLI", "SAMI", "TUULI", "VILLE"]),
});

const appearanceGroups = Object.freeze({
  JP: Object.freeze(["black", "east-asian", "east-asian", "east-asian", "east-asian", "east-asian", "east-asian", "east-asian", "east-asian", "latino", "mixed", "mixed", "other", "white"]),
  US: Object.freeze(["black", "black", "black", "east-asian", "east-asian", "latino", "latino", "latino", "mixed", "mixed", "other", "white", "white", "white", "white"]),
  CN: Object.freeze(["black", "east-asian", "east-asian", "east-asian", "east-asian", "east-asian", "east-asian", "east-asian", "east-asian", "latino", "mixed", "mixed", "other", "white"]),
  DE: Object.freeze(["black", "east-asian", "latino", "mixed", "other", "white", "white", "white", "white", "white", "white", "white"]),
  CH: Object.freeze(["black", "east-asian", "latino", "mixed", "other", "white", "white", "white", "white", "white", "white", "white"]),
  FI: Object.freeze(["black", "east-asian", "latino", "mixed", "other", "white", "white", "white", "white", "white", "white", "white"]),
});

const skinTonesByAppearance = Object.freeze({
  black: Object.freeze(["deep", "deep", "dark", "dark", "medium-dark"]),
  "east-asian": Object.freeze(["light", "light-medium", "light-medium", "medium", "medium"]),
  latino: Object.freeze(["light-medium", "medium", "medium", "medium-dark"]),
  mixed: Object.freeze(["deep", "dark", "light", "light-medium", "medium", "medium-dark"]),
  white: Object.freeze(["light", "light", "light-medium", "light-medium", "medium"]),
  other: Object.freeze(["deep", "dark", "light", "light-medium", "medium", "medium-dark"]),
});

const fieldCatalogs = Object.freeze({
  gender: Object.freeze(["female", "male", "nonbinary"]),
  presentation: Object.freeze(["feminine", "masculine", "neutral"]),
  skinTone: Object.freeze(["deep", "dark", "medium-dark", "medium", "light-medium", "light"]),
  faceShape: Object.freeze(["angular", "heart", "long", "oval", "round", "square"]),
  hairStyle: Object.freeze(["afro", "bob", "braids", "buzz", "curly", "long", "short", "wavy"]),
  eyeStyle: Object.freeze(["bright", "calm", "deep-set", "narrow", "round", "soft"]),
  outfit: Object.freeze(["camp-shirt", "club-jacket", "field-vest", "hoodie", "radio-shirt", "sweater"]),
  visualPalette: Object.freeze(["clear-forest", "cool-daylight", "neutral-daylight", "soft-spring"]),
  stationContext: Object.freeze(["apartment", "club-station", "field-day", "home-shack", "portable", "rural-home"]),
  queryStyle: Object.freeze(["AGN", "QRS", "QRZ", "QUESTION"]),
  replyStyle: Object.freeze(["FRIENDLY", "REPEAT", "STANDARD", "TERSE"]),
  topics: Object.freeze(["age", "antenna", "equipment", "location", "name", "power", "weather"]),
});

function hash32(value) {
  let hash = 2166136261;
  const normalized = String(value).normalize("NFC");
  for (let index = 0; index < normalized.length; index += 1) {
    hash ^= normalized.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  hash ^= hash >>> 16;
  hash = Math.imul(hash, 0x7feb352d);
  hash ^= hash >>> 15;
  hash = Math.imul(hash, 0x846ca68b);
  hash ^= hash >>> 16;
  return hash >>> 0;
}

export function proceduralWorldFingerprint(worldSeed = "default") {
  const seed = String(worldSeed).normalize("NFC");
  const left = hash32(`world-a|${seed}`).toString(36).toUpperCase().padStart(7, "0");
  const right = hash32(`world-b|${seed}`).toString(36).toUpperCase().padStart(7, "0");
  return `W1-${left}${right}`;
}

function streamKey(worldSeed, regionId, localIndex, field) {
  return `${PROCEDURAL_NPC_GENERATOR_VERSION}|${worldSeed}|${regionId}|${localIndex}|${field}`;
}

function unit(worldSeed, regionId, localIndex, field) {
  return hash32(streamKey(worldSeed, regionId, localIndex, field)) / 0x100000000;
}

function integer(worldSeed, regionId, localIndex, field, minimum, maximum) {
  return minimum + Math.floor(unit(worldSeed, regionId, localIndex, field) * (maximum - minimum + 1));
}

function pick(catalog, worldSeed, regionId, localIndex, field) {
  const stableCatalog = [...catalog].sort((left, right) => {
    const leftKey = typeof left === "object" ? String(left.id) : String(left);
    const rightKey = typeof right === "object" ? String(right.id) : String(right);
    if (leftKey < rightKey) return -1;
    if (leftKey > rightKey) return 1;
    return 0;
  });
  return stableCatalog[Math.floor(unit(worldSeed, regionId, localIndex, field) * stableCatalog.length)];
}

function boundedScore(worldSeed, regionId, localIndex, field, minimum = 0, maximum = 100) {
  return integer(worldSeed, regionId, localIndex, field, minimum, maximum);
}

function assertInteger(value, label) {
  if (!Number.isSafeInteger(value)) throw new TypeError(`${label} must be a safe integer`);
}

function regionById(regionId) {
  const normalized = String(regionId ?? "").toUpperCase();
  const region = PROCEDURAL_NPC_REGIONS.find((candidate) => candidate.id === normalized);
  if (!region) throw new RangeError(`Unknown procedural NPC region: ${regionId}`);
  return region;
}

function callsignFor(worldSeed, region, localIndex) {
  const multiplier = PROCEDURAL_NPC_CALLSIGN_MULTIPLIERS[
    hash32(`${PROCEDURAL_NPC_GENERATOR_VERSION}|${worldSeed}|${region.id}|callsign-multiplier`) % PROCEDURAL_NPC_CALLSIGN_MULTIPLIERS.length
  ];
  const offset = hash32(`${PROCEDURAL_NPC_GENERATOR_VERSION}|${worldSeed}|${region.id}|callsign-offset`) % PROCEDURAL_NPC_CALLSIGN_SPACE;
  const slot = (multiplier * localIndex + offset) % PROCEDURAL_NPC_CALLSIGN_SPACE;
  return `${region.callPrefix}${slot.toString(36).toUpperCase().padStart(3, "0")}`;
}

function ageFor(worldSeed, regionId, localIndex) {
  const roll = unit(worldSeed, regionId, localIndex, "age-band");
  if (roll < .04) return integer(worldSeed, regionId, localIndex, "age-value", 16, 19);
  if (roll < .24) return integer(worldSeed, regionId, localIndex, "age-value", 20, 29);
  if (roll < .59) return integer(worldSeed, regionId, localIndex, "age-value", 30, 44);
  if (roll < .84) return integer(worldSeed, regionId, localIndex, "age-value", 45, 59);
  return integer(worldSeed, regionId, localIndex, "age-value", 60, 84);
}

function hairColorFor(ageYears, worldSeed, regionId, localIndex) {
  if (ageYears < 25) return pick(["black", "black", "brown", "dark-brown", "dark-brown", "red"], worldSeed, regionId, localIndex, "hair-color");
  if (ageYears < 50) return pick(["black", "black", "brown", "brown", "dark-brown", "dark-brown", "gray", "red"], worldSeed, regionId, localIndex, "hair-color");
  return pick(["black", "brown", "dark-brown", "gray", "gray", "gray", "red", "silver", "silver"], worldSeed, regionId, localIndex, "hair-color");
}

function facialHairFor(ageYears, worldSeed, regionId, localIndex) {
  if (ageYears < 18) return "none";
  const roll = unit(worldSeed, regionId, localIndex, "facial-hair-roll");
  if (roll < .72) return "none";
  return pick(["beard", "moustache", "stubble"], worldSeed, regionId, localIndex, "facial-hair-style");
}

function stationContextFor(ageYears, worldSeed, regionId, localIndex) {
  const catalog = ageYears < 18 ? ["club-station", "home-shack"] : fieldCatalogs.stationContext;
  return pick(catalog, worldSeed, regionId, localIndex, "station-context");
}

function optionalQuestionTopicFor(ageYears, worldSeed, regionId, localIndex) {
  const catalog = ageYears < 18 ? ["power", "weather"] : [...SUPPORTED_OPTIONAL_EXCHANGE_TOPICS];
  return pick(catalog, worldSeed, regionId, localIndex, "optional-question-topic");
}

function coordinateAround(location, worldSeed, regionId, localIndex) {
  const latitudeJitter = (unit(worldSeed, regionId, localIndex, "latitude") - .5) * 2.4;
  const longitudeJitter = (unit(worldSeed, regionId, localIndex, "longitude") - .5) * 3.2;
  return {
    latitude: Number(Math.max(-89.9, Math.min(89.9, location.latitude + latitudeJitter)).toFixed(4)),
    longitude: Number((((location.longitude + longitudeJitter + 180) % 360 + 360) % 360 - 180).toFixed(4)),
  };
}

function topicSet(worldSeed, regionId, localIndex) {
  const preferredTopic = pick(fieldCatalogs.topics, worldSeed, regionId, localIndex, "preferred-topic");
  const secondTopic = pick(
    fieldCatalogs.topics.filter((topic) => topic !== preferredTopic),
    worldSeed,
    regionId,
    localIndex,
    "secondary-topic",
  );
  return { preferredTopic, topics: Object.freeze([preferredTopic, secondTopic].sort()) };
}

function closestOperatorProfileId(personality, radio) {
  if (radio.weakSignalSkill >= 86 && personality.patience >= 65) return "weak-signal-listener";
  if (radio.preferredWpm >= 25 && personality.competitiveness >= 55) return "contest-sprinter";
  if (personality.sociability >= 72 && personality.formality <= 45) return "friendly-ragchewer";
  if (radio.experienceYears <= 3 && personality.patience >= 55) return "careful-beginner";
  if (personality.formality >= 72) return "traditional-fist";
  return "patient-veteran";
}

export function generateProceduralNpc({ worldSeed = "default", regionId, localIndex } = {}) {
  const seed = String(worldSeed).normalize("NFC");
  const worldFingerprint = proceduralWorldFingerprint(seed);
  const region = regionById(regionId);
  assertInteger(localIndex, "localIndex");
  if (localIndex < 0 || localIndex >= region.quota) {
    throw new RangeError(`localIndex must be between 0 and ${region.quota - 1} for ${region.id}`);
  }

  const ageYears = ageFor(seed, region.id, localIndex);
  const experienceCap = Math.max(0, ageYears - 10);
  const experienceYears = Math.min(
    experienceCap,
    Math.floor(unit(seed, region.id, localIndex, "experience") ** 1.55 * (experienceCap + 1)),
  );
  const practiceLift = Math.min(18, Math.round(Math.sqrt(experienceYears) * 3));
  const rxSkill = boundedScore(seed, region.id, localIndex, "rx-skill", 38, 82) + practiceLift;
  const txSkill = boundedScore(seed, region.id, localIndex, "tx-skill", 42, 84) + Math.round(practiceLift * .8);
  const weakSignalSkill = boundedScore(seed, region.id, localIndex, "weak-signal-skill", 30, 80) + Math.round(practiceLift * .9);
  const personality = Object.freeze({
    patience: boundedScore(seed, region.id, localIndex, "patience", 18, 98),
    sociability: boundedScore(seed, region.id, localIndex, "sociability", 12, 98),
    curiosity: boundedScore(seed, region.id, localIndex, "curiosity", 10, 98),
    formality: boundedScore(seed, region.id, localIndex, "formality", 10, 95),
    empathy: boundedScore(seed, region.id, localIndex, "empathy", 12, 98),
    competitiveness: boundedScore(seed, region.id, localIndex, "competitiveness", 5, 96),
  });
  const preferredWpm = integer(seed, region.id, localIndex, "preferred-wpm", 7, 32);
  const wpmSpan = integer(seed, region.id, localIndex, "wpm-span", 3, 9);
  const topics = topicSet(seed, region.id, localIndex);
  const location = pick(region.locations, seed, region.id, localIndex, "location");
  const coordinates = coordinateAround(location, seed, region.id, localIndex);
  const radio = Object.freeze({
    experienceYears,
    rxSkill: Math.min(100, rxSkill),
    txSkill: Math.min(100, txSkill),
    weakSignalSkill: Math.min(100, weakSignalSkill),
    preferredWpm,
    comfortableMinWpm: Math.max(5, preferredWpm - wpmSpan),
    comfortableMaxWpm: Math.min(40, preferredWpm + wpmSpan),
    timingJitter: boundedScore(seed, region.id, localIndex, "timing-jitter", 0, 35),
    correctionEventPermille: Math.min(34, boundedScore(seed, region.id, localIndex, "correction-event", 0, 16)
      + Math.round((100 - Math.min(100, txSkill)) * .25)),
  });
  const operatorProfileId = closestOperatorProfileId(personality, radio);
  const npcId = `N1-${region.id}-${localIndex.toString(36).toUpperCase().padStart(4, "0")}`;

  return Object.freeze({
    schemaVersion: PROCEDURAL_NPC_SCHEMA_VERSION,
    generatorVersion: PROCEDURAL_NPC_GENERATOR_VERSION,
    catalogRevision: PROCEDURAL_NPC_CATALOG_REVISION,
    npcId,
    worldFingerprint,
    worldNpcKey: `${worldFingerprint}:${npcId}`,
    fixed: false,
    identity: Object.freeze({
      fictionalNameId: `${region.id}-NAME-${localIndex.toString(36).toUpperCase().padStart(4, "0")}`,
      operatorName: pick(names[region.id], seed, region.id, localIndex, "operator-name"),
      gender: pick(fieldCatalogs.gender, seed, region.id, localIndex, "gender"),
      presentation: pick(fieldCatalogs.presentation, seed, region.id, localIndex, "presentation"),
      ageYears,
      appearanceGroup: pick(appearanceGroups[region.id], seed, region.id, localIndex, "appearance-group"),
      nameLocaleId: region.id,
    }),
    station: Object.freeze({
      countryId: region.countryId,
      regionId: region.id,
      locationId: location.id,
      callsign: callsignFor(seed, region, localIndex),
      stationContext: stationContextFor(ageYears, seed, region.id, localIndex),
      ...coordinates,
    }),
    appearance: Object.freeze({
      skinTone: pick(skinTonesByAppearance[pick(appearanceGroups[region.id], seed, region.id, localIndex, "appearance-group")], seed, region.id, localIndex, "skin-tone"),
      faceShape: pick(fieldCatalogs.faceShape, seed, region.id, localIndex, "face-shape"),
      hairStyle: pick(fieldCatalogs.hairStyle, seed, region.id, localIndex, "hair-style"),
      hairColor: hairColorFor(ageYears, seed, region.id, localIndex),
      eyeStyle: pick(fieldCatalogs.eyeStyle, seed, region.id, localIndex, "eye-style"),
      facialHair: facialHairFor(ageYears, seed, region.id, localIndex),
      accessoryBits: integer(seed, region.id, localIndex, "accessories", 0, 15),
      outfitId: pick(fieldCatalogs.outfit, seed, region.id, localIndex, "outfit"),
      visualPaletteId: pick(fieldCatalogs.visualPalette, seed, region.id, localIndex, "visual-palette"),
    }),
    personality,
    radio,
    qso: Object.freeze({
      topics: topics.topics,
      preferredTopic: topics.preferredTopic,
      optionalQuestionChance: boundedScore(seed, region.id, localIndex, "optional-question", 0, 72),
      optionalQuestionTopic: optionalQuestionTopicFor(ageYears, seed, region.id, localIndex),
      verbosity: boundedScore(seed, region.id, localIndex, "verbosity", 8, 96),
      procedureStrictness: boundedScore(seed, region.id, localIndex, "procedure-strictness", 8, 96),
      replyDelayMs: integer(seed, region.id, localIndex, "reply-delay", 600, 4200),
      responseLength: pick(["brief", "normal", "long"], seed, region.id, localIndex, "response-length"),
      queryStyle: pick(fieldCatalogs.queryStyle, seed, region.id, localIndex, "query-style"),
      replyStyle: pick(fieldCatalogs.replyStyle, seed, region.id, localIndex, "reply-style"),
      firmThreshold: boundedScore(seed, region.id, localIndex, "firm-threshold", 35, 92),
      operatorProfileId,
    }),
  });
}

export function proceduralNpcCoordinates(globalIndex) {
  assertInteger(globalIndex, "globalIndex");
  if (globalIndex < 0 || globalIndex >= PROCEDURAL_NPC_WORLD_SIZE) {
    throw new RangeError(`globalIndex must be between 0 and ${PROCEDURAL_NPC_WORLD_SIZE - 1}`);
  }
  let cursor = globalIndex;
  for (const region of PROCEDURAL_NPC_REGIONS) {
    if (cursor < region.quota) return { regionId: region.id, localIndex: cursor };
    cursor -= region.quota;
  }
  throw new RangeError(`Unable to map globalIndex ${globalIndex}`);
}

export function generateProceduralNpcAt({ worldSeed = "default", globalIndex } = {}) {
  return generateProceduralNpc({ worldSeed, ...proceduralNpcCoordinates(globalIndex) });
}

export function* iterateNpcBatch({ worldSeed = "default", offset = 0, count = 20, regionId = null } = {}) {
  assertInteger(offset, "offset");
  assertInteger(count, "count");
  if (offset < 0 || count < 0) throw new RangeError("offset and count must be non-negative");
  if (regionId !== null && regionId !== undefined && regionId !== "") {
    const region = regionById(regionId);
    if (offset + count > region.quota) throw new RangeError(`Batch exceeds the ${region.id} quota`);
    for (let index = 0; index < count; index += 1) {
      yield generateProceduralNpc({ worldSeed, regionId: region.id, localIndex: offset + index });
    }
    return;
  }
  if (offset + count > PROCEDURAL_NPC_WORLD_SIZE) throw new RangeError("Batch exceeds the procedural NPC world size");
  for (let index = 0; index < count; index += 1) {
    yield generateProceduralNpcAt({ worldSeed, globalIndex: offset + index });
  }
}

export function generateNpcBatch(options = {}) {
  return Array.from(iterateNpcBatch(options));
}

export function proceduralNpcToStation(npc) {
  if (!npc?.station || !npc?.radio || !npc?.qso || !npc?.personality) {
    throw new TypeError("A complete procedural NPC profile is required");
  }
  const strong = npc.radio.weakSignalSkill >= 88 && npc.radio.experienceYears >= 8;
  const optionalQuestion = npc.qso.optionalQuestionChance >= 48
    && SUPPORTED_OPTIONAL_EXCHANGE_TOPICS.has(npc.qso.optionalQuestionTopic)
    ? npc.qso.optionalQuestionTopic
    : null;
  return Object.freeze({
    callsign: npc.station.callsign,
    regionId: npc.station.locationId,
    latitude: npc.station.latitude,
    longitude: npc.station.longitude,
    wpm: npc.radio.preferredWpm,
    baseToneHz: 620 + (hash32(`${npc.worldNpcKey ?? npc.npcId}|tone`) % 81),
    frequencyOffsetHz: hash32(`${npc.worldNpcKey ?? npc.npcId}|offset`) % 10,
    stationBonus: strong ? 1 : 0,
    isStrongStation: strong,
    isFictional: true,
    proceduralNpcId: npc.npcId,
    operatorProfileId: npc.qso.operatorProfileId,
    operatorOverrides: Object.freeze({
      rxSkill: npc.radio.rxSkill,
      txAccuracy: Number((100 - npc.radio.correctionEventPermille / 10).toFixed(1)),
      preferredWpm: npc.radio.preferredWpm,
      speedTolerance: Math.min(100, (npc.radio.comfortableMaxWpm - npc.radio.comfortableMinWpm) * 6),
      patience: npc.personality.patience,
      procedureStrictness: npc.qso.procedureStrictness,
      responseTempo: Math.max(0, Math.min(100, Math.round(112 - npc.qso.replyDelayMs / 40))),
      fistStability: Math.max(0, 100 - npc.radio.timingJitter),
      verbosity: npc.qso.verbosity,
      initiative: npc.personality.curiosity,
      queryStyle: npc.qso.queryStyle,
      replyStyle: npc.qso.replyStyle,
      optionalQuestion,
      personaName: npc.identity.operatorName,
      personaAge: npc.identity.ageYears,
    }),
  });
}

export function proceduralWorldHeader(worldSeed = "default") {
  return Object.freeze({
    schemaVersion: PROCEDURAL_NPC_SCHEMA_VERSION,
    generatorVersion: PROCEDURAL_NPC_GENERATOR_VERSION,
    catalogRevision: PROCEDURAL_NPC_CATALOG_REVISION,
    worldSeed: String(worldSeed).normalize("NFC"),
    worldFingerprint: proceduralWorldFingerprint(worldSeed),
    npcCount: PROCEDURAL_NPC_WORLD_SIZE,
  });
}
export function assertCompatibleProceduralWorldHeader(header) {
  if (!header || typeof header !== "object") throw new TypeError("A procedural world header is required");
  if (header.schemaVersion !== PROCEDURAL_NPC_SCHEMA_VERSION
    || header.generatorVersion !== PROCEDURAL_NPC_GENERATOR_VERSION
    || header.catalogRevision !== PROCEDURAL_NPC_CATALOG_REVISION
    || header.npcCount !== PROCEDURAL_NPC_WORLD_SIZE
    || typeof header.worldSeed !== "string"
    || header.worldFingerprint !== proceduralWorldFingerprint(header.worldSeed)) {
    throw new RangeError("Unsupported procedural NPC world version; migrate or use a matching generator");
  }
  return header;
}

export function generateProceduralNpcFromHeader({ header, regionId, localIndex } = {}) {
  const compatible = assertCompatibleProceduralWorldHeader(header);
  return generateProceduralNpc({ worldSeed: compatible.worldSeed, regionId, localIndex });
}
