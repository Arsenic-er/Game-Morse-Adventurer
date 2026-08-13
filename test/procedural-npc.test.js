import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  PROCEDURAL_NPC_CALLSIGN_MULTIPLIERS,
  PROCEDURAL_NPC_CALLSIGN_SPACE,
  PROCEDURAL_NPC_CATALOG_REVISION,
  PROCEDURAL_NPC_GENERATOR_VERSION,
  PROCEDURAL_NPC_REGIONS,
  PROCEDURAL_NPC_SCHEMA_VERSION,
  PROCEDURAL_NPC_WORLD_SIZE,
  assertCompatibleProceduralWorldHeader,
  generateNpcBatch,
  generateProceduralNpc,
  generateProceduralNpcAt,
  generateProceduralNpcFromHeader,
  proceduralNpcCoordinates,
  proceduralNpcToStation,
  proceduralWorldFingerprint,
  proceduralWorldHeader,
} from "../src/qso/proceduralNpc.js";

function gcd(left, right) {
  let a = Math.abs(left);
  let b = Math.abs(right);
  while (b) [a, b] = [b, a % b];
  return a;
}

test("the virtual population has frozen, disjoint regional quotas totaling 100,000", () => {
  assert.equal(PROCEDURAL_NPC_SCHEMA_VERSION, 1);
  assert.equal(PROCEDURAL_NPC_GENERATOR_VERSION, "npcgen-1");
  assert.equal(PROCEDURAL_NPC_CATALOG_REVISION, 1);
  assert.equal(PROCEDURAL_NPC_WORLD_SIZE, 100000);
  assert.equal(PROCEDURAL_NPC_REGIONS.reduce((total, region) => total + region.quota, 0), 100000);
  assert.equal(new Set(PROCEDURAL_NPC_REGIONS.map((region) => region.callPrefix)).size, PROCEDURAL_NPC_REGIONS.length);
  assert.equal(Object.isFrozen(PROCEDURAL_NPC_REGIONS), true);
  for (const region of PROCEDURAL_NPC_REGIONS) assert.ok(region.quota <= PROCEDURAL_NPC_CALLSIGN_SPACE);
  for (const multiplier of PROCEDURAL_NPC_CALLSIGN_MULTIPLIERS) assert.equal(gcd(multiplier, PROCEDURAL_NPC_CALLSIGN_SPACE), 1);
});

test("profiles are deterministic, seed-sensitive, bounded, and carry no portrait path", () => {
  const first = generateProceduralNpc({ worldSeed: "alpha", regionId: "JP", localIndex: 42 });
  const repeated = generateProceduralNpc({ worldSeed: "alpha", regionId: "JP", localIndex: 42 });
  const changed = generateProceduralNpc({ worldSeed: "bravo", regionId: "JP", localIndex: 42 });
  assert.deepEqual(first, repeated);
  assert.notDeepEqual(first, changed);
  assert.match(first.npcId, /^N1-JP-[0-9A-Z]{4}$/);
  assert.match(first.station.callsign, /^SIMJ[0-9A-Z]{3}$/);
  assert.match(first.identity.fictionalNameId, /^JP-NAME-[0-9A-Z]{4}$/);
  assert.match(first.worldFingerprint, /^W1-[0-9A-Z]{14}$/);
  assert.equal(first.worldNpcKey, `${first.worldFingerprint}:${first.npcId}`);
  assert.notEqual(first.worldNpcKey, changed.worldNpcKey);
  assert.equal(first.fixed, false);
  assert.equal(first.identity.nameLocaleId, "JP");
  assert.ok(first.identity.ageYears >= 16 && first.identity.ageYears <= 84);
  assert.ok(first.radio.experienceYears >= 0 && first.radio.experienceYears <= first.identity.ageYears - 10);
  assert.ok(first.radio.comfortableMinWpm >= 5);
  assert.ok(first.radio.comfortableMaxWpm <= 40);
  assert.ok(first.station.latitude >= -90 && first.station.latitude <= 90);
  assert.ok(first.station.longitude >= -180 && first.station.longitude <= 180);
  assert.ok(["power", "location", "weather", "name", "age"].includes(first.qso.optionalQuestionTopic));
  const serialized = JSON.stringify(first);
  assert.doesNotMatch(serialized, /portrait|imagePath|assetPath/i);
  assert.ok(Buffer.byteLength(serialized, "utf8") < 2400);
});

test("all 100,000 conceptual operators have unique IDs and fictional callsigns", () => {
  const ids = new Set();
  const nameIds = new Set();
  const worldKeys = new Set();
  const callsigns = new Set();
  const appearanceByRegion = new Map();
  const namesByGender = new Map();
  let profileBytes = 0;
  for (let globalIndex = 0; globalIndex < PROCEDURAL_NPC_WORLD_SIZE; globalIndex += 1) {
    const profile = generateProceduralNpcAt({ worldSeed: "uniqueness-audit", globalIndex });
    assert.equal(profile.station.callsign.length, 7);
    assert.match(profile.station.callsign, /^SIM[JUCGHF][0-9A-Z]{3}$/);
    ids.add(profile.npcId);
    nameIds.add(profile.identity.fictionalNameId);
    worldKeys.add(profile.worldNpcKey);
    callsigns.add(profile.station.callsign);
    const regionAppearance = appearanceByRegion.get(profile.station.regionId) ?? new Set();
    regionAppearance.add(profile.identity.appearanceGroup);
    appearanceByRegion.set(profile.station.regionId, regionAppearance);
    if (profile.identity.ageYears < 18) {
      assert.equal(profile.appearance.facialHair, "none");
      assert.doesNotMatch(profile.appearance.hairColor, /gray|silver/);
      assert.ok(["club-station", "home-shack"].includes(profile.station.stationContext));
      assert.ok(["power", "weather"].includes(profile.qso.optionalQuestionTopic));
    }
    assert.ok(profile.radio.correctionEventPermille >= 0 && profile.radio.correctionEventPermille <= 34);
    profileBytes += Buffer.byteLength(JSON.stringify(profile), "utf8");
    const bucket = namesByGender.get(profile.identity.gender) ?? new Set();
    bucket.add(profile.identity.operatorName);
    namesByGender.set(profile.identity.gender, bucket);
  }
  assert.equal(ids.size, PROCEDURAL_NPC_WORLD_SIZE);
  assert.equal(nameIds.size, PROCEDURAL_NPC_WORLD_SIZE);
  assert.equal(worldKeys.size, PROCEDURAL_NPC_WORLD_SIZE);
  assert.equal(callsigns.size, PROCEDURAL_NPC_WORLD_SIZE);
  for (const groups of appearanceByRegion.values()) {
    assert.deepEqual(groups, new Set(["black", "east-asian", "latino", "mixed", "other", "white"]));
  }
  assert.ok(profileBytes / PROCEDURAL_NPC_WORLD_SIZE < 2400);
  for (const observedNames of namesByGender.values()) assert.ok(observedNames.size > 20);
});

test("global and regional batch indexing is stable and boundary checked", () => {
  assert.deepEqual(proceduralNpcCoordinates(0), { regionId: "JP", localIndex: 0 });
  assert.deepEqual(proceduralNpcCoordinates(19999), { regionId: "JP", localIndex: 19999 });
  assert.deepEqual(proceduralNpcCoordinates(20000), { regionId: "US", localIndex: 0 });
  assert.deepEqual(proceduralNpcCoordinates(99999), { regionId: "FI", localIndex: 8999 });
  assert.throws(() => proceduralNpcCoordinates(-1), RangeError);
  assert.throws(() => proceduralNpcCoordinates(100000), RangeError);
  assert.deepEqual(
    generateNpcBatch({ worldSeed: "batch", regionId: "CN", offset: 8, count: 3 }),
    [8, 9, 10].map((localIndex) => generateProceduralNpc({ worldSeed: "batch", regionId: "CN", localIndex })),
  );
  assert.throws(() => generateNpcBatch({ regionId: "FI", offset: 8999, count: 2 }), RangeError);
});

test("appearance and demographics do not hard-fix radio skill", () => {
  const profiles = generateNpcBatch({ worldSeed: "independence-audit", offset: 0, count: 5000 });
  const groups = new Map();
  for (const profile of profiles) {
    const key = `${profile.identity.gender}:${profile.identity.appearanceGroup}`;
    const group = groups.get(key) ?? { min: 101, max: -1, ages: new Set() };
    group.min = Math.min(group.min, profile.radio.rxSkill);
    group.max = Math.max(group.max, profile.radio.rxSkill);
    group.ages.add(profile.identity.ageYears);
    groups.set(key, group);
  }
  assert.ok(groups.size >= 8);
  for (const group of groups.values()) {
    if (group.ages.size >= 8) assert.ok(group.max - group.min >= 20);
  }
});

test("station adapter matches the propagation and operator-profile contracts", () => {
  const profile = generateProceduralNpc({ worldSeed: "station", regionId: "DE", localIndex: 12 });
  const station = proceduralNpcToStation(profile);
  assert.equal(station.callsign, profile.station.callsign);
  assert.equal(station.regionId, profile.station.locationId);
  assert.equal(station.isFictional, true);
  assert.equal(station.proceduralNpcId, profile.npcId);
  assert.equal(station.operatorOverrides.personaName, profile.identity.operatorName);
  assert.equal(station.operatorOverrides.personaAge, profile.identity.ageYears);
  assert.ok(station.baseToneHz >= 620 && station.baseToneHz <= 700);
  assert.equal(station.operatorOverrides.txAccuracy, Number((100 - profile.radio.correctionEventPermille / 10).toFixed(1)));
  assert.ok(station.operatorOverrides.txAccuracy >= 96.6 && station.operatorOverrides.txAccuracy <= 100);
  assert.ok(station.operatorOverrides.receptionTolerance >= 0 && station.operatorOverrides.receptionTolerance <= 100);
  assert.match(station.operatorOverrides.personaRig, /^[A-Z0-9 ]+$/);
  assert.match(station.operatorOverrides.personaAntenna, /^[A-Z0-9 ]+$/);
  assert.ok([5, 10, 20, 50, 100].includes(station.operatorOverrides.personaPowerWatts));
  assert.match(station.operatorOverrides.personaQth, /^[A-Z0-9 ]+$/);
  assert.match(station.operatorOverrides.personaWeather, /^[A-Z]+$/);
  assert.ok(station.operatorOverrides.optionalQuestion === null
    || ["power", "location", "weather", "name", "age"].includes(station.operatorOverrides.optionalQuestion));
});

test("a tiny world header can reconstruct the population without storing 100,000 records", () => {
  const header = proceduralWorldHeader("save-seed-01");
  assert.deepEqual(header, {
    schemaVersion: 1,
    generatorVersion: "npcgen-1",
    catalogRevision: 1,
    worldSeed: "save-seed-01",
    worldFingerprint: proceduralWorldFingerprint("save-seed-01"),
    npcCount: 100000,
  });
  assert.ok(Buffer.byteLength(JSON.stringify(header), "utf8") < 256);
  assert.equal(assertCompatibleProceduralWorldHeader(header), header);
  assert.deepEqual(
    generateProceduralNpcFromHeader({ header, regionId: "JP", localIndex: 42 }),
    generateProceduralNpc({ worldSeed: "save-seed-01", regionId: "JP", localIndex: 42 }),
  );
  assert.throws(() => assertCompatibleProceduralWorldHeader({ ...header, generatorVersion: "npcgen-0" }), RangeError);
  assert.throws(() => assertCompatibleProceduralWorldHeader({ ...header, catalogRevision: 2 }), RangeError);
  assert.throws(() => assertCompatibleProceduralWorldHeader({ ...header, worldFingerprint: "W1-BAD" }), RangeError);
});

 test("the v1 golden population and non-BMP seeds cannot drift silently", () => {
  const profiles = PROCEDURAL_NPC_REGIONS.flatMap((region) => [0, region.quota - 1].map((localIndex) => (
    generateProceduralNpc({ worldSeed: "golden-世界-😀", regionId: region.id, localIndex })
  )));
  const digest = createHash("sha256").update(JSON.stringify(profiles)).digest("hex");
  assert.equal(digest, "f40b8e41e11b578310ea90a2d8b7e3c4c1a1347411796369b72101cc98fd0dd1");
  assert.notDeepEqual(
    generateProceduralNpc({ worldSeed: "😀", regionId: "US", localIndex: 7 }),
    generateProceduralNpc({ worldSeed: "😁", regionId: "US", localIndex: 7 }),
  );
});

test("the CLI emits parseable streaming JSON without materializing a profiles array", () => {
  const script = fileURLToPath(new URL("../scripts/generate-npc-roster.mjs", import.meta.url));
  const result = spawnSync(process.execPath, [script, "--seed", "cli-世界-😀", "--count", "4", "--format", "json"], {
    encoding: "utf8",
    maxBuffer: 2 * 1024 * 1024,
  });
  assert.equal(result.status, 0, result.stderr);
  const parsed = JSON.parse(result.stdout);
  assert.equal(parsed.profiles.length, 4);
  assert.equal(parsed.header.worldSeed, "cli-世界-😀");
  const source = readFileSync(new URL("../scripts/generate-npc-roster.mjs", import.meta.url), "utf8");
  assert.doesNotMatch(source, /profiles:\s*\[\.\.\.profiles\]/);
});

test("runtime contains no NPC portrait module or public character asset directory", () => {
  assert.equal(existsSync(new URL("../public/assets/characters", import.meta.url)), false);
  const app = readFileSync(new URL("../src/App.jsx", import.meta.url), "utf8");
  const css = readFileSync(new URL("../src/pixel-theme.css", import.meta.url), "utf8");
  assert.doesNotMatch(app, /npcPortraits|npc-portrait|data-npc-expression|assets\/characters/);
  assert.doesNotMatch(css, /npc-portrait|data-npc-expression|assets\/characters/);
});
