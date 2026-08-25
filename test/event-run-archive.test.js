import test from "node:test";
import assert from "node:assert/strict";
import {
  EVENT_RUN_ARCHIVE_VERSION,
  createEventRunSnapshot,
  emptyEventRunArchive,
  normalizeEventRunArchive,
  recordEventRunArchive,
} from "../src/game/eventRunArchive.js";

const CONTACT_LOCATIONS = [
  ["JP", "japan-tokyo-kanto", "Asia/Tokyo"],
  ["US", "usa-new-england", "America/New_York"],
  ["CN", "china-chengdu-plain", "Asia/Shanghai"],
  ["GE", "europe-rhine-valley", "Europe/Berlin"],
  ["CH", "europe-swiss-lake", "Europe/Zurich"],
  ["FI", "europe-finland-lake", "Europe/Helsinki"],
  ["JP", "japan-hokkaido-furano", "Asia/Tokyo"],
];

function result({
  runId = "story:archive-1",
  mode = "story",
  completedAt = "2026-05-05T01:08:00.000Z",
  score = 7,
  grade = "gold",
  contacts = true,
} = {}) {
  return {
    runId,
    mode,
    startedAt: new Date(Date.parse(completedAt) - 8 * 60 * 1000).toISOString(),
    completedAt,
    playerCallsign: "JA1LGT",
    score,
    grade,
    contacts: contacts ? CONTACT_LOCATIONS.map(([eventRegionCode, locationId], index) => ({
      id: `${runId}:contact-${index}`,
      npcId: `N1-${eventRegionCode}-${String(index + 1).padStart(4, "0")}`,
      callsign: `SIM${index + 1}LT`,
      eventRegionCode,
      locationId,
      completedAt: new Date(Date.parse(completedAt) - (7 - index) * 60_000).toISOString(),
    })) : [],
  };
}

test("a lights run becomes a seven-contact identity and local-context snapshot", () => {
  const snapshot = createEventRunSnapshot(result(), {
    stationTimeZone: "Asia/Tokyo",
    stamp: "special",
  });

  assert.equal(snapshot.version, EVENT_RUN_ARCHIVE_VERSION);
  assert.equal(snapshot.eventRunId, "story:archive-1");
  assert.equal(snapshot.stationDate, "2026-05-05");
  assert.equal(snapshot.stamp, "special");
  assert.equal(snapshot.contacts.length, 7);
  assert.deepEqual(snapshot.contacts[0], {
    personId: "person:procedural:N1-JP-0001",
    stationId: "station:procedural:N1-JP-0001",
    onAirCallsign: "SIM1LT",
    eventRegionCode: "JP",
    locationId: "japan-tokyo-kanto",
    timeZone: "Asia/Tokyo",
    completedAt: "2026-05-05T01:01:00.000Z",
    weatherCode: "rain",
    messageKey: "lights.archive.message.shared-sky",
  });
  assert.deepEqual(snapshot.contacts.map(({ timeZone }) => timeZone), CONTACT_LOCATIONS.map(([, , timeZone]) => timeZone));
  assert.equal(JSON.stringify(snapshot).includes("operatorName"), false);
  assert.equal(JSON.stringify(snapshot).includes("freeText"), false);
});

test("weather and message facts are deterministic across normalization and JSON round trips", () => {
  const first = createEventRunSnapshot(result(), { stationTimeZone: "Asia/Tokyo", stamp: "special" });
  const repeated = createEventRunSnapshot(result(), { stationTimeZone: "Asia/Tokyo", stamp: "special" });
  const roundTrip = normalizeEventRunArchive(JSON.parse(JSON.stringify(recordEventRunArchive(null, first))));

  assert.deepEqual(repeated, first);
  assert.deepEqual(roundTrip.storyBest, first);
  assert.deepEqual(normalizeEventRunArchive(roundTrip), roundTrip);
});

test("reload preserves validated archived contact facts across JSON round trips", () => {
  const stored = JSON.parse(JSON.stringify(recordEventRunArchive(null, createEventRunSnapshot(result(), {
    stationTimeZone: "Asia/Tokyo",
    stamp: "special",
  }))));
  Object.assign(stored.storyBest.contacts[0], {
    timeZone: "Pacific/Auckland",
    weatherCode: "snow",
    messageKey: "lights.archive.message.return",
  });

  const reloaded = normalizeEventRunArchive(stored);

  assert.deepEqual({
    timeZone: reloaded.storyBest.contacts[0].timeZone,
    weatherCode: reloaded.storyBest.contacts[0].weatherCode,
    messageKey: reloaded.storyBest.contacts[0].messageKey,
  }, {
    timeZone: "Pacific/Auckland",
    weatherCode: "snow",
    messageKey: "lights.archive.message.return",
  });
  assert.deepEqual(normalizeEventRunArchive(JSON.parse(JSON.stringify(reloaded))), reloaded);
});

test("inherited archive fact fields are ignored instead of becoming persisted data", () => {
  const input = result();
  input.contacts = [Object.assign(Object.create({
    timeZone: "Pacific/Auckland",
    weatherCode: "snow",
    messageKey: "lights.archive.message.return",
  }), input.contacts[0])];

  const snapshot = createEventRunSnapshot(input, { stationTimeZone: "Asia/Tokyo" });

  assert.deepEqual({
    timeZone: snapshot.contacts[0].timeZone,
    weatherCode: snapshot.contacts[0].weatherCode,
    messageKey: snapshot.contacts[0].messageKey,
  }, {
    timeZone: "Asia/Tokyo",
    weatherCode: "rain",
    messageKey: "lights.archive.message.shared-sky",
  });
});

test("archive retains the story best, twenty recent annual bests, and thirty-one recent practice-day bests", () => {
  let archive = emptyEventRunArchive();
  archive = recordEventRunArchive(archive, result({ runId: "story:base", score: 3, grade: "base", contacts: false }), { stationTimeZone: "UTC" });
  archive = recordEventRunArchive(archive, result({ runId: "story:gold", score: 7, grade: "gold", contacts: false }), { stationTimeZone: "UTC" });

  for (let year = 2000; year <= 2024; year += 1) {
    archive = recordEventRunArchive(archive, result({
      runId: `annual:${year}`,
      mode: "annual",
      completedAt: `${year}-05-05T12:00:00.000Z`,
      score: 3,
      grade: "base",
      contacts: false,
    }), { stationTimeZone: "UTC", stamp: "standard" });
  }
  archive = recordEventRunArchive(archive, result({
    runId: "annual:2024:gold",
    mode: "annual",
    completedAt: "2024-05-06T12:00:00.000Z",
    score: 7,
    grade: "gold",
    contacts: false,
  }), { stationTimeZone: "UTC", stamp: "special" });

  for (let day = 0; day < 35; day += 1) {
    const completedAt = new Date(Date.UTC(2026, 0, 1 + day, 12)).toISOString();
    archive = recordEventRunArchive(archive, result({
      runId: `practice:${day}`,
      mode: "practice",
      completedAt,
      score: 3,
      grade: "base",
      contacts: false,
    }), { stationTimeZone: "UTC" });
  }

  assert.equal(archive.storyBest.eventRunId, "story:gold");
  assert.equal(archive.annualBests.length, 20);
  assert.equal(archive.annualBests[0].stationDate, "2005-05-05");
  assert.equal(archive.annualBests.at(-1).eventRunId, "annual:2024:gold");
  assert.equal(archive.practiceBests.length, 31);
  assert.equal(archive.practiceBests[0].stationDate, "2026-01-05");
  assert.equal(archive.practiceBests.at(-1).stationDate, "2026-02-04");
});

test("hostile archive inputs are bounded, reject invalid snapshots, and never retain supplied prose", () => {
  const annualBests = Array.from({ length: 10_000 }, (_, index) => result({
    runId: `annual:hostile:${index}`,
    mode: "annual",
    completedAt: `${2000 + (index % 25)}-05-05T12:00:00.000Z`,
    contacts: false,
  }));
  const practiceBests = Array.from({ length: 10_000 }, (_, index) => result({
    runId: `practice:hostile:${index}`,
    mode: "practice",
    completedAt: new Date(Date.UTC(2026, 0, 1 + (index % 35), 12)).toISOString(),
    contacts: false,
  }));
  Object.defineProperty(annualBests[0], "runId", { get() { throw new Error("unbounded-annual-scan"); } });
  Object.defineProperty(practiceBests[0], "runId", { get() { throw new Error("unbounded-practice-scan"); } });

  const normalized = normalizeEventRunArchive({
    version: -1,
    storyBest: { nope: true },
    annualBests,
    practiceBests,
  });
  assert.equal(normalized.version, EVENT_RUN_ARCHIVE_VERSION);
  assert.equal(normalized.storyBest, null);
  assert.equal(normalized.annualBests.length <= 20, true);
  assert.equal(normalized.practiceBests.length <= 31, true);

  const suppliedProse = result();
  suppliedProse.contacts[0].operatorName = "PLAYER SUPPLIED PROSE";
  suppliedProse.contacts[0].weatherCode = "real-weather";
  suppliedProse.contacts[0].messageKey = "<script>";
  suppliedProse.contacts[0].timeZone = "<script>";
  suppliedProse.contacts.push(...Array.from({ length: 100 }, () => suppliedProse.contacts[0]));
  const snapshot = createEventRunSnapshot(suppliedProse, { stationTimeZone: "Asia/Tokyo" });
  assert.equal(snapshot.contacts.length, 7);
  assert.equal(JSON.stringify(snapshot).includes("PLAYER SUPPLIED PROSE"), false);
  assert.equal(JSON.stringify(snapshot).includes("real-weather"), false);
  assert.equal(JSON.stringify(snapshot).includes("<script>"), false);
});
