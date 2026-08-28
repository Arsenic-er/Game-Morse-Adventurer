const fs = require("fs/promises");
const path = require("path");

const LIGHTS_QA_WPM = 12;
const QA_QSO_LOG_VERSION = 9;
const QA_STORAGE_KEYS = Object.freeze([
  "game-morse-adventurer.saves.v1",
  "game-morse-adventurer.active-save.v1",
  "game-morse-adventurer.language.v1",
]);
const QA_LANGUAGE_IDS = Object.freeze(["zh-CN", "zh-TW", "ja", "en", "es", "de", "ru"]);
const QA_INITIAL_STORY_MISSION_IDS = Object.freeze([
  "story-01", "story-02", "story-03", "story-04", "story-05",
  "story-06", "story-07", "story-08", "story-09", "story-10",
]);
const QA_SUPPORTED_SCOPES = Object.freeze([
  "full", "bootstrap", "inventory", "equipment", "practice", "qso", "expedition",
  "qsl-story", "service-net", "coordinate-relay", "contest",
]);
const QA_SEGMENT_PREDECESSORS = Object.freeze({
  inventory: "bootstrap",
  equipment: "inventory",
  practice: "equipment",
  qso: "practice",
  expedition: "qso",
  "qsl-story": "expedition",
  "service-net": "qsl-story",
  "coordinate-relay": "service-net",
  contest: "coordinate-relay",
});
const QA_RUN_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const QA_CAPTURE_STEMS = Object.freeze({
  bootstrap: [
    "start", "language-start-seven", "language-settings-russian", "language-reload-spanish",
    "station-manual-page-1", "station-manual-language-updated", "station-manual-page-2",
    "station-manual-page-3", "station-manual-page-4", "practice-session-only", "save-create", "home",
    "home-escape-menu", "home-motion-a", "home-motion-b", "mission-story-initial",
    "mission-story-active", "mission-daily", "home-hover-store", "store-antenna", "store-radio",
    "store-accessory-research",
  ],
  inventory: [
    "home-hover-warehouse", "technology-tree-initial", "warehouse-radio-warmup", "warehouse-radio",
    "warehouse-accessories", "warehouse-antenna-selected", "warehouse-antenna-equipped",
    "home-hover-achievements", "achievements-empty", "home-log-empty-warmup", "home-log-empty", "save-loaded",
  ],
  equipment: [
    "mission-story-ready", "store-accessory-owned", "store-radio-available-warmup", "store-radio-available",
    "store-radio-owned-warmup", "store-radio-owned", "warehouse-accessory-selected",
    "warehouse-accessory-equipped", "warehouse-radio-selected", "warehouse-radio-equipped",
    "achievements-populated", "home-log-populated-warmup", "home-log-populated", "home-log-detail-second",
  ],
  practice: [
    "home-hover-practice", "practice-overview-initial", "practice-lesson-guidance", "practice-session-summary",
    "practice-overview-after-lesson", "practice-weak-recovery-review", "practice-weak-summary-recovered",
    "practice-weak-cleared", "home-after-practice", "practice-weak-cleared-reloaded",
    "practice-callsign-region-selected", "practice-callsign-region-locked", "practice-callsign-region-reloaded",
  ],
  qso: [
    "qso-duty-briefing", "station-listening-warmup", "station-listening", "station-radio-tx",
    "qso-leave-active", "station-input-cleared", "qso-npc-query", "qso-blind-copy", "qso-specific-error",
    "qso-agn-repeat", "qso-optional-query", "qso-result-unsaved-warmup", "qso-result-unsaved",
    "qso-leave-unsaved", "qso-operation-review", "achievement-qso-5-unlocked", "qso-result-saved",
    "home-log-after-qso-warmup", "home-log-after-qso", "home-log-operation-review", "propagation-map",
    "world-map", "mission-story-claimed", "reload-without-achievement-repeat",
  ],
  expedition: [
    "expedition-mission-available", "expedition-site", "expedition-setup-penalty",
    "expedition-ready", "expedition-calling", "expedition-recovering", "expedition-result",
    "expedition-settled", "expedition-reloaded-qsl", "expedition-choice-confirmed",
    "expedition-choice-reloaded",
  ],
  "qsl-story": [
    "qsl-mission-available", "qsl-accounts", "qsl-clarification-error", "qsl-clarification-reply",
    "qsl-final-choice", "qsl-result", "qsl-settled", "qsl-reloaded",
  ],
  "service-net": [
    "service-mission-available", "service-briefing", "service-check-in-error", "service-queue",
    "service-message", "service-agn", "service-ack-error", "service-result", "service-settled", "service-reloaded",
  ],
  "coordinate-relay": [
    "coordinate-mission-available", "coordinate-briefing", "coordinate-packet", "coordinate-readback-error",
    "coordinate-correction", "coordinate-relay", "coordinate-confirmation", "coordinate-result",
    "coordinate-settled", "coordinate-reloaded",
  ],
  contest: [
    "contest-mission-available", "contest-briefing", "contest-run-pileup", "contest-interruption",
    "contest-run-contact", "contest-sp-pool", "contest-agn", "contest-busted-call",
    "contest-score-ready", "contest-result", "contest-settled", "contest-reloaded",
  ],
});

function buildQaSegmentPlan({ suffix = "qa" } = {}) {
  const regularScopes = QA_SUPPORTED_SCOPES.slice(1);
  const segments = regularScopes.map((scope) => ({
    scope,
    mode: "qa-capture",
    predecessor: QA_SEGMENT_PREDECESSORS[scope] ?? null,
    timeoutMs: ["qso", "expedition", "qsl-story", "service-net", "coordinate-relay", "contest"].includes(scope) ? 8 * 60_000 : 5 * 60_000,
    screenshots: QA_CAPTURE_STEMS[scope].map((stem) => `${stem}-${suffix}.png`),
  }));
  segments.push({
    scope: "lights",
    mode: "qa-lights-capture",
    predecessor: null,
    timeoutMs: 8 * 60_000,
    screenshots: buildLightsQaPlan({ suffix }).screenshots,
  });
  return { schemaVersion: 1, suffix, segments };
}

function validateQaStorage(storage) {
  if (!isPlainObject(storage)) throw new Error("QA state storage must be a plain object");
  const keys = Object.keys(storage);
  if (keys.length !== QA_STORAGE_KEYS.length
    || keys.some((key) => !QA_STORAGE_KEYS.includes(key))) {
    throw new Error("QA state storage key allowlist was violated");
  }
  for (const key of QA_STORAGE_KEYS) {
    if (!Object.hasOwn(storage, key)) throw new Error(`QA state is missing storage key ${key}`);
  }
  let saves;
  try {
    saves = JSON.parse(storage[QA_STORAGE_KEYS[0]]);
  } catch {
    throw new Error("QA state saves storage is not valid JSON");
  }
  if (!Array.isArray(saves) || saves.length === 0
    || saves.some((save) => !isPlainObject(save) || typeof save.id !== "string" || !save.id.trim())) {
    throw new Error("QA state saves storage must contain at least one identified save");
  }
  const activeId = storage[QA_STORAGE_KEYS[1]];
  if (typeof activeId !== "string" || !saves.some((save) => save.id === activeId)) {
    throw new Error("QA state active save does not identify a stored save");
  }
  const language = storage[QA_STORAGE_KEYS[2]];
  if (language !== null && (typeof language !== "string" || !QA_LANGUAGE_IDS.includes(language))) {
    throw new Error("QA state language is unsupported");
  }
  return { saves, activeSave: saves.find((save) => save.id === activeId) };
}

function validateQaFacts(facts, activeSave, producerScope) {
  if (!isPlainObject(facts)) throw new Error("QA state facts must be a plain object");
  const keys = Object.keys(facts);
  if (keys.some((key) => key !== "practiceWrongTarget")) {
    throw new Error("QA state facts contain an unsupported key");
  }
  const target = facts.practiceWrongTarget;
  if (producerScope === "practice" && (typeof target !== "string" || !target.trim())) {
    throw new Error("QA state practiceWrongTarget is required after practice");
  }
  if (target !== undefined) {
    const recentTargets = activeSave?.practiceRecords?.["character-rx"]?.recentTargets;
    if (typeof target !== "string" || !target.trim() || !Array.isArray(recentTargets)
      || !recentTargets.includes(target)) {
      throw new Error("QA state practiceWrongTarget is not present in character-rx recentTargets");
    }
  }
}

function validateQaRunId(value, expected = null) {
  if (typeof value !== "string" || !QA_RUN_ID_PATTERN.test(value)) {
    throw new Error("QA run id must be a random UUID");
  }
  if (expected !== null && value !== expected) {
    throw new Error(`QA run id mismatch: expected ${expected}, received ${value}`);
  }
  return value;
}

function validateQaStateShape(value, { qaRunId = null } = {}) {
  if (!isPlainObject(value)) throw new Error("QA state input must be a plain object");
  if (value.schemaVersion !== 1) throw new Error("QA state schemaVersion is unsupported");
  validateQaRunId(value.qaRunId, qaRunId);
  if (!QA_SUPPORTED_SCOPES.slice(1).includes(value.producerScope)) {
    throw new Error("QA state producerScope is unsupported");
  }
  const { activeSave } = validateQaStorage(value.storage);
  validateQaFacts(value.facts, activeSave, value.producerScope);
  return value;
}

function validateChapterQaBase(value, { qaRunId, activity }) {
  const evidence = requirePlainObject(value, `${activity} evidence`);
  if (evidence.schemaVersion !== 1 || evidence.activity !== activity) throw new Error(`${activity} QA evidence has the wrong schema or activity`);
  validateQaRunId(evidence.qaRunId, qaRunId);
  for (const key of ["settled", "missionClaimed", "reloadPersisted", "duplicateSettlementNoOp"]) {
    if (evidence[key] !== true) throw new Error(`${activity} QA evidence requires ${key}`);
  }
  return evidence;
}

function validateQslStoryQaEvidence(value, { qaRunId = null } = {}) {
  const evidence = validateChapterQaBase(value, { qaRunId, activity: "qsl-story" });
  if (evidence.sourcePersonId !== "person:sora" || !["believe", "request-review", "defer"].includes(evidence.finalChoice)
    || evidence.eventQsoCount !== 1) throw new Error("qsl-story QA evidence facts are incomplete");
  return evidence;
}

function validateServiceNetQaEvidence(value, { qaRunId = null } = {}) {
  const evidence = validateChapterQaBase(value, { qaRunId, activity: "service-net" });
  if (evidence.messageCount !== 3 || evidence.receiptCount !== 3 || evidence.eventQsoCount !== 1) {
    throw new Error("service-net QA evidence facts are incomplete");
  }
  return evidence;
}

function validateCoordinateRelayQaEvidence(value, { qaRunId = null } = {}) {
  const evidence = validateChapterQaBase(value, { qaRunId, activity: "coordinate-relay" });
  if (!/^\d{3}$/.test(evidence.packetId) || !/^PX-\d{4}-\d{4}$/.test(evidence.grid) || evidence.eventQsoCount !== 2) {
    throw new Error("coordinate-relay QA evidence facts are incomplete");
  }
  return evidence;
}

function validateContestQaEvidence(value, { qaRunId = null } = {}) {
  const evidence = validateChapterQaBase(value, { qaRunId, activity: "contest" });
  if (!Number.isInteger(evidence.validContacts) || evidence.validContacts < 6 || evidence.validContacts > 10
    || !Number.isInteger(evidence.runContacts) || evidence.runContacts < 2
    || !Number.isInteger(evidence.spContacts) || evidence.spContacts < 2
    || !Number.isInteger(evidence.uniqueRegions) || evidence.uniqueRegions < 3
    || evidence.eventQsoCount !== evidence.validContacts
    || !["complete", "silver", "gold"].includes(evidence.grade)) {
    throw new Error("contest QA evidence facts are incomplete");
  }
  return evidence;
}

function createQaStateEnvelope({ qaRunId, producerScope, storage, facts = {} }) {
  return validateQaStateShape({ schemaVersion: 1, qaRunId, producerScope, storage, facts });
}

function validateQaStateEnvelope(value, { consumerScope, qaRunId }) {
  if (consumerScope === "bootstrap") {
    if (value !== null && value !== undefined) throw new Error("QA bootstrap rejects state input");
    return null;
  }
  if (!Object.hasOwn(QA_SEGMENT_PREDECESSORS, consumerScope)) {
    throw new Error(`QA state consumer scope is unsupported: ${consumerScope}`);
  }
  const envelope = validateQaStateShape(value, { qaRunId });
  if (envelope.producerScope !== QA_SEGMENT_PREDECESSORS[consumerScope]) {
    throw new Error(`QA state predecessor for ${consumerScope} must be ${QA_SEGMENT_PREDECESSORS[consumerScope]}`);
  }
  return envelope;
}

async function importQaStateIntoRenderer(window, value, { consumerScope, qaRunId }) {
  const envelope = validateQaStateEnvelope(value, { consumerScope, qaRunId });
  await window.webContents.executeJavaScript(`(() => {
    const keys = ${JSON.stringify(QA_STORAGE_KEYS)};
    const storage = ${JSON.stringify(envelope.storage)};
    for (const key of keys) localStorage.removeItem(key);
    for (const key of keys) {
      if (storage[key] !== null) localStorage.setItem(key, storage[key]);
    }
  })()`, true);
  await window.reload();
  return envelope;
}

async function exportQaStateFromRenderer(window, { qaRunId, producerScope, facts = {} }) {
  const storage = await window.webContents.executeJavaScript(`(() => {
    const keys = ${JSON.stringify(QA_STORAGE_KEYS)};
    return Object.fromEntries(keys.map((key) => [key, localStorage.getItem(key)]));
  })()`, true);
  return createQaStateEnvelope({ qaRunId, producerScope, storage: { ...storage }, facts });
}

async function writeQaSegmentResult(window, {
  outputDir,
  stateOutFile = path.join(outputDir, "qa-state-out.json"),
  qaRunId,
  scope,
  suffix,
  consoleErrors,
  facts = {},
}) {
  const segment = buildQaSegmentPlan({ suffix }).segments.find((candidate) => candidate.scope === scope);
  if (!segment || scope === "lights") throw new Error(`Unsupported ordinary QA segment: ${scope}`);
  const state = await exportQaStateFromRenderer(window, { qaRunId, producerScope: scope, facts });
  await fs.writeFile(stateOutFile, `${JSON.stringify(state, null, 2)}\n`, "utf8");
  const result = {
    schemaVersion: 1,
    qaRunId,
    scope,
    captures: segment.screenshots,
    stateOut: path.relative(outputDir, stateOutFile),
    consoleErrorCount: consoleErrors.length,
    completedAt: new Date().toISOString(),
  };
  await fs.writeFile(
    path.join(outputDir, "qa-segment-result.json"),
    `${JSON.stringify(result, null, 2)}\n`,
    "utf8",
  );
  return result;
}

function buildLightsQaPlan({ suffix = "qa" } = {}) {
  const screenshot = (name) => `lights-${name}-${suffix}.png`;
  return {
    checkpoints: [
      "story-ready", "keying-probe", "story-launch", "chase-complete", "control-entered", "escape-paused",
      "escape-resumed", "failed-run", "retry-control", "settled", "reloaded-history", "duplicate-settlement",
    ].map((id) => ({ id })),
    screenshots: [
      screenshot("story-launch"), screenshot("chase"), screenshot("control"), screenshot("failed"),
      screenshot("result"), screenshot("reloaded-history"),
    ],
    resultFile: "lights-qa-result.json",
  };
}

function isPlainObject(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function requirePlainObject(value, label) {
  if (!isPlainObject(value)) throw new Error(`Lights QA ${label} must be a plain object`);
  return value;
}

function requireNonNegativeInteger(value, label) {
  if (!Number.isSafeInteger(value) || value < 0) throw new Error(`Lights QA ${label} must be a finite nonnegative integer`);
  return value;
}

function requireStringArray(value, label, { allowEmpty = false } = {}) {
  if (!Array.isArray(value) || (!allowEmpty && value.length === 0)
    || value.some((item) => typeof item !== "string" || !item.trim())
    || new Set(value).size !== value.length) {
    throw new Error(`Lights QA ${label} must be a${allowEmpty ? " unique" : " nonempty unique"} string array`);
  }
  return value;
}

function validateDurableLightsSnapshot(value, label, { allowEmptyRunIds = false } = {}) {
  const snapshot = requirePlainObject(value, label);
  requireNonNegativeInteger(snapshot.money, `${label}.money`);
  requireNonNegativeInteger(snapshot.qsoLogCount, `${label}.qsoLogCount`);
  requireNonNegativeInteger(snapshot.eventQsoCredits, `${label}.eventQsoCredits`);
  requireStringArray(snapshot.settledRunIds, `${label}.settledRunIds`, { allowEmpty: allowEmptyRunIds });
  requireStringArray(snapshot.claimedAchievementRewards, `${label}.claimedAchievementRewards`, { allowEmpty: true });
  return snapshot;
}

function sameStringArray(left, right) {
  return Array.isArray(left) && Array.isArray(right)
    && left.length === right.length && left.every((value, index) => value === right[index]);
}

function sameDurableLightsSnapshot(left, right) {
  return left.money === right.money
    && left.qsoLogCount === right.qsoLogCount
    && left.eventQsoCredits === right.eventQsoCredits
    && sameStringArray(left.settledRunIds, right.settledRunIds)
    && sameStringArray(left.claimedAchievementRewards, right.claimedAchievementRewards);
}

function stringArrayDifference(after, before) {
  const previous = new Set(before);
  return after.filter((value) => !previous.has(value));
}

function durableLightsQaSnapshot(value) {
  return {
    money: value.money,
    qsoLogCount: value.qsoLogCount,
    eventQsoCredits: value.eventQsoCredits,
    settledRunIds: [...value.settledRunIds],
    claimedAchievementRewards: [...value.claimedAchievementRewards],
  };
}

function buildLightsQaMoneyFlow({
  seed, beforeBaseClick, afterAchievementSettlement, afterMissionClaim, gradeMoneyAwarded,
}) {
  const seedSnapshot = durableLightsQaSnapshot(seed);
  const beforeSnapshot = durableLightsQaSnapshot(beforeBaseClick);
  const achievementSnapshot = durableLightsQaSnapshot(afterAchievementSettlement);
  const missionSnapshot = durableLightsQaSnapshot(afterMissionClaim);
  const missionMoneyAwarded = afterMissionClaim.story05MissionMoneyAwarded;
  const missionStageMoneyAwarded = missionSnapshot.money - achievementSnapshot.money;
  return {
    seed: seedSnapshot,
    beforeBaseClick: beforeSnapshot,
    baseSettlement: {
      gradeMoneyAwarded,
      eventQsoCreditsAwarded: achievementSnapshot.eventQsoCredits - beforeSnapshot.eventQsoCredits,
      qsoLogDelta: achievementSnapshot.qsoLogCount - beforeSnapshot.qsoLogCount,
      settledRunIdDelta: achievementSnapshot.settledRunIds.length - beforeSnapshot.settledRunIds.length,
    },
    afterAchievementSettlement: {
      ...achievementSnapshot,
      achievementMoneyAwarded: achievementSnapshot.money - beforeSnapshot.money - gradeMoneyAwarded,
      newlyClaimedAchievementRewards: stringArrayDifference(
        achievementSnapshot.claimedAchievementRewards, beforeSnapshot.claimedAchievementRewards,
      ),
    },
    missionClaim: {
      missionMoneyAwarded,
      achievementMoneyAwarded: missionStageMoneyAwarded - missionMoneyAwarded,
      totalMoneyAwarded: missionStageMoneyAwarded,
      newlyClaimedAchievementRewards: stringArrayDifference(
        missionSnapshot.claimedAchievementRewards, achievementSnapshot.claimedAchievementRewards,
      ),
      after: missionSnapshot,
    },
  };
}

function validateLightsQaEvidence(result, { qaRunId = null } = {}) {
  requirePlainObject(result, "evidence");
  validateQaRunId(result.qaRunId, qaRunId);
  if (result.schemaVersion !== 1 || result.activity !== "lights-across-air"
    || result.resultFile !== "lights-qa-result.json") {
    throw new Error("Lights QA evidence has an unsupported schema");
  }
  const screenshots = requireStringArray(result.screenshots, "screenshots");
  if (screenshots.length !== 6) throw new Error("Lights QA evidence must name exactly six screenshots");
  for (const name of ["story-launch", "chase", "control", "failed", "result", "reloaded-history"]) {
    if (!screenshots.some((filename) => new RegExp(`^lights-${name}-.*\\.png$`).test(filename))) {
      throw new Error(`Lights QA evidence is missing ${name} screenshot`);
    }
  }

  const checkpoints = requirePlainObject(result.checkpoints, "checkpoints");
  const required = [
    "story-ready", "keying-probe", "story-launch", "chase-complete", "control-entered", "escape-paused",
    "escape-resumed", "failed-run", "retry-control", "settled", "duplicate-settlement", "reloaded-history",
  ];
  for (const id of required) {
    if (!Object.hasOwn(checkpoints, id)) throw new Error(`Lights QA evidence is missing ${id} checkpoint`);
    requirePlainObject(checkpoints[id], `${id} checkpoint`);
  }

  const storyReady = checkpoints["story-ready"];
  if (storyReady.prerequisiteClaimed !== true || storyReady.story05Active !== true) {
    throw new Error("Lights QA story-ready checkpoint did not activate story-05");
  }
  const keyingProbe = checkpoints["keying-probe"];
  if (keyingProbe.text !== "RRR RST" || keyingProbe.wpm !== LIGHTS_QA_WPM || keyingProbe.exact !== true) {
    throw new Error("Lights QA keying-probe checkpoint did not prove exact repeated-R input");
  }
  const expectedPhases = {
    "story-launch": "CHASE_PLAYER_CALL", "chase-complete": "CONTROL_CQ", "control-entered": "CONTROL_CQ",
    "escape-paused": "CONTROL_CQ", "escape-resumed": "CONTROL_CQ", "failed-run": "RUN_COMPLETE",
    "retry-control": "CONTROL_CQ",
  };
  for (const [id, phase] of Object.entries(expectedPhases)) {
    if (checkpoints[id].phase !== phase) throw new Error(`Lights QA ${id} phase is not ${phase}`);
  }
  if (checkpoints["story-launch"].mode !== "story") throw new Error("Lights QA story-launch mode is not story");
  if (checkpoints["chase-complete"].completed !== true) throw new Error("Lights QA chase-complete fact is false");
  if (checkpoints["escape-paused"].settingsVisible !== true) throw new Error("Lights QA escape-paused settingsVisible is not true");
  if (checkpoints["escape-resumed"].settingsVisible !== false) throw new Error("Lights QA escape-resumed settingsVisible is not false");
  if (checkpoints["failed-run"].grade !== "none") throw new Error("Lights QA failed-run grade is not none");
  if (checkpoints["retry-control"].failedRunSettlementCount !== 1) {
    throw new Error("Lights QA retry-control failedRunSettlementCount is not 1");
  }

  const settled = checkpoints.settled;
  requireNonNegativeInteger(settled.contacts, "settled.contacts");
  requireNonNegativeInteger(settled.validQsoCount, "settled.validQsoCount");
  requireNonNegativeInteger(settled.distinctRegionCount, "settled.distinctRegionCount");
  requireNonNegativeInteger(settled.resolvedPileupCount, "settled.resolvedPileupCount");
  if (settled.phase !== "RUN_COMPLETE" || settled.grade !== "base" || settled.contacts < 3
    || settled.validQsoCount < 3 || settled.distinctRegionCount < 2 || settled.resolvedPileupCount < 1) {
    throw new Error("Lights QA settled checkpoint did not prove a Base-grade overlapping pile-up run");
  }
  if (!Array.isArray(settled.selectedContacts) || settled.selectedContacts.length < 3
    || settled.selectedContacts.some((contact) => !isPlainObject(contact)
      || typeof contact.callsign !== "string" || !contact.callsign.trim()
      || typeof contact.regionCode !== "string" || !contact.regionCode.trim())) {
    throw new Error("Lights QA settled.selectedContacts are malformed");
  }
  const selectedRegions = new Set(settled.selectedContacts.map(({ regionCode }) => regionCode));
  if (selectedRegions.size < 2 || settled.selectedContacts.length !== settled.validQsoCount
    || selectedRegions.size !== settled.distinctRegionCount || settled.contacts !== settled.validQsoCount) {
    throw new Error("Lights QA settled.selectedContacts do not match the QSO and region facts");
  }

  const moneyFlow = requirePlainObject(settled.moneyFlow, "settled.moneyFlow");
  const seed = validateDurableLightsSnapshot(moneyFlow.seed, "settled.moneyFlow.seed", { allowEmptyRunIds: true });
  const storySeed = validateDurableLightsSnapshot(storyReady.seed, "story-ready.seed", { allowEmptyRunIds: true });
  const beforeBase = validateDurableLightsSnapshot(moneyFlow.beforeBaseClick, "settled.moneyFlow.beforeBaseClick");
  const baseSettlement = requirePlainObject(moneyFlow.baseSettlement, "settled.moneyFlow.baseSettlement");
  const afterAchievement = validateDurableLightsSnapshot(
    moneyFlow.afterAchievementSettlement, "settled.moneyFlow.afterAchievementSettlement",
  );
  const missionClaim = requirePlainObject(moneyFlow.missionClaim, "settled.moneyFlow.missionClaim");
  const afterMissionClaim = validateDurableLightsSnapshot(missionClaim.after, "settled.moneyFlow.missionClaim.after");
  const final = validateDurableLightsSnapshot(settled.final, "settled.final");

  if (!sameDurableLightsSnapshot(seed, storySeed) || seed.money !== 0 || seed.qsoLogCount !== 0
    || seed.eventQsoCredits !== 0 || seed.settledRunIds.length !== 0
    || seed.claimedAchievementRewards.length !== 0) {
    throw new Error("Lights QA seed snapshot is not the isolated zero baseline");
  }
  if (beforeBase.money !== seed.money || beforeBase.qsoLogCount !== seed.qsoLogCount
    || beforeBase.eventQsoCredits !== seed.eventQsoCredits || beforeBase.settledRunIds.length !== 1
    || !sameStringArray(beforeBase.claimedAchievementRewards, seed.claimedAchievementRewards)) {
    throw new Error("Lights QA beforeBaseClick snapshot is inconsistent with the failed retry baseline");
  }
  for (const field of ["gradeMoneyAwarded", "eventQsoCreditsAwarded", "qsoLogDelta", "settledRunIdDelta"]) {
    requireNonNegativeInteger(baseSettlement[field], `settled.moneyFlow.baseSettlement.${field}`);
  }
  if (baseSettlement.gradeMoneyAwarded !== 0) throw new Error("Lights QA baseSettlement.gradeMoneyAwarded is not zero");
  if (baseSettlement.eventQsoCreditsAwarded !== 0 || afterAchievement.eventQsoCredits !== 0) {
    throw new Error("Lights QA baseSettlement eventQsoCredits are not zero");
  }
  if (baseSettlement.qsoLogDelta !== settled.validQsoCount
    || afterAchievement.qsoLogCount - beforeBase.qsoLogCount !== baseSettlement.qsoLogDelta) {
    throw new Error("Lights QA baseSettlement qsoLogDelta is inconsistent");
  }
  if (baseSettlement.settledRunIdDelta !== 1
    || afterAchievement.settledRunIds.length - beforeBase.settledRunIds.length !== 1
    || !sameStringArray(afterAchievement.settledRunIds.slice(0, -1), beforeBase.settledRunIds)) {
    throw new Error("Lights QA baseSettlement settledRunIds are inconsistent");
  }
  requireNonNegativeInteger(afterAchievement.achievementMoneyAwarded, "settled.moneyFlow.afterAchievementSettlement.achievementMoneyAwarded");
  const newlySettledAchievements = requireStringArray(
    afterAchievement.newlyClaimedAchievementRewards,
    "settled.moneyFlow.afterAchievementSettlement.newlyClaimedAchievementRewards",
  );
  if (afterAchievement.achievementMoneyAwarded !== 540
    || afterAchievement.money - beforeBase.money !== afterAchievement.achievementMoneyAwarded
    || !sameStringArray(newlySettledAchievements, ["first-qso", "regions-3", "lights-base"])
    || !sameStringArray(
      stringArrayDifference(afterAchievement.claimedAchievementRewards, beforeBase.claimedAchievementRewards),
      newlySettledAchievements,
    )) {
    throw new Error("Lights QA achievement settlement did not account for first-qso + regions-3 + lights-base (540 money)");
  }

  const duplicate = checkpoints["duplicate-settlement"];
  if (duplicate.noOp !== true) throw new Error("Lights QA duplicate settlement no-op is false");
  const duplicateBefore = validateDurableLightsSnapshot(duplicate.before, "duplicate settlement before");
  const duplicateAfter = validateDurableLightsSnapshot(duplicate.after, "duplicate settlement after");
  if (!sameDurableLightsSnapshot(duplicateBefore, duplicateAfter)
    || !sameDurableLightsSnapshot(duplicateBefore, afterAchievement)) {
    throw new Error("Lights QA duplicate settlement changed durable facts");
  }

  for (const field of ["missionMoneyAwarded", "achievementMoneyAwarded", "totalMoneyAwarded"]) {
    requireNonNegativeInteger(missionClaim[field], `settled.moneyFlow.missionClaim.${field}`);
  }
  const newlyClaimedAchievements = requireStringArray(
    missionClaim.newlyClaimedAchievementRewards, "settled.moneyFlow.missionClaim.newlyClaimedAchievementRewards",
  );
  if (missionClaim.missionMoneyAwarded !== 500) throw new Error("Lights QA missionMoneyAwarded is not the story-05 reward");
  if (missionClaim.achievementMoneyAwarded !== 100
    || !sameStringArray(newlyClaimedAchievements, ["first-name"])) {
    throw new Error("Lights QA mission claim achievement award is not the first-name reward");
  }
  if (missionClaim.totalMoneyAwarded !== 600
    || missionClaim.totalMoneyAwarded !== missionClaim.missionMoneyAwarded + missionClaim.achievementMoneyAwarded
    || afterMissionClaim.money - duplicateAfter.money !== missionClaim.totalMoneyAwarded) {
    throw new Error("Lights QA mission claim total money is inconsistent");
  }
  if (afterMissionClaim.qsoLogCount !== duplicateAfter.qsoLogCount
    || afterMissionClaim.eventQsoCredits !== duplicateAfter.eventQsoCredits
    || !sameStringArray(afterMissionClaim.settledRunIds, duplicateAfter.settledRunIds)
    || !sameStringArray(
      afterMissionClaim.claimedAchievementRewards,
      ["first-qso", "regions-3", "first-name", "lights-base"],
    )
    || !sameStringArray(
      stringArrayDifference(afterMissionClaim.claimedAchievementRewards, duplicateAfter.claimedAchievementRewards),
      newlyClaimedAchievements,
    )) {
    throw new Error("Lights QA mission claim changed unrelated settlement facts");
  }
  if (!sameDurableLightsSnapshot(final, afterMissionClaim)) throw new Error("Lights QA final snapshot is inconsistent");

  const reloaded = validateDurableLightsSnapshot(checkpoints["reloaded-history"], "reloaded-history");
  if (checkpoints["reloaded-history"].storyBestGrade !== "base") {
    throw new Error("Lights QA reloaded-history storyBestGrade is not base");
  }
  if (!sameDurableLightsSnapshot(reloaded, final)) {
    throw new Error(`Lights QA settled facts did not match reloaded history: ${JSON.stringify({ settled: final, reloaded })}`);
  }
  return true;
}

function validateExpeditionQaEvidence(value, { qaRunId = null } = {}) {
  requirePlainObject(value, "Expedition evidence");
  validateQaRunId(value.qaRunId, qaRunId);
  if (value.schemaVersion !== 1 || value.activity !== "hill-expedition") {
    throw new Error("Expedition QA evidence has the wrong schema or activity");
  }
  if (value.failurePenaltyApplied !== true || !["AGN", "QRS"].includes(value.recoveryAction)
    || value.result !== "success" || value.settled !== true
    || typeof value.relationshipPersonId !== "string" || !value.relationshipPersonId.startsWith("person:")
    || value.qslPersonId !== value.relationshipPersonId
    || !["believe", "request-review", "defer"].includes(value.qslChoice)
    || value.qslChoicePersistedAfterReload !== true || value.duplicateChoiceNoOp !== true
    || value.timerPausedWithoutCatchUp !== true || value.timeoutReachable !== true
    || value.powerDepletedReachable !== true || value.replayEntryPersisted !== true
    || value.replayRewardNoOp !== true) {
    throw new Error("Expedition QA evidence is missing a required gameplay proof");
  }
  return value;
}

function validateStationEntryProbe(report) {
  if (report?.passed !== true || report?.afterClick?.stationPresent !== true || (report?.consoleErrors ?? []).length !== 0) {
    throw new Error(`Station entry probe failed: ${JSON.stringify(report)}`);
  }
  return true;
}

function selectLightsCallerFromRuntimeSnapshot(snapshot) {
  const caller = snapshot?.phase === "CONTROL_SELECTION"
    ? snapshot?.pileup?.callers?.find((candidate) => typeof candidate?.callsign === "string" && candidate.callsign)
    : null;
  if (!caller) throw new Error(`Lights QA could not read the current caller from rendered pile-up state: ${JSON.stringify(snapshot)}`);
  return caller.callsign;
}

function formatLightsWaitFailure(context, phase, snapshot) {
  return `Lights QA phase wait failed ${context}; expected ${phase}; rendered state: ${JSON.stringify(snapshot)}`;
}

async function waitFor(window, selector, timeout = 10000) {
  const source = `new Promise((resolve, reject) => {
    const started = Date.now();
    const timer = setInterval(() => {
      const node = document.querySelector(${JSON.stringify(selector)});
      if (node) { clearInterval(timer); resolve(true); }
      else if (Date.now() - started > ${timeout}) { clearInterval(timer); reject(new Error(${JSON.stringify(`Timed out: ${selector}`)})); }
    }, 40);
  })`;
  return window.webContents.executeJavaScript(source, true);
}

async function click(window, selector) {
  await window.webContents.executeJavaScript(`(() => {
    const node = document.querySelector(${JSON.stringify(selector)});
    if (!node) throw new Error(${JSON.stringify("Missing click target: ")} + ${JSON.stringify(selector)});
    node.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, view: window }));
  })()`, true);
}

async function setInputValue(window, selector, value) {
  await window.webContents.executeJavaScript(`(() => {
    const input = document.querySelector(${JSON.stringify(selector)});
    if (!input) throw new Error(${JSON.stringify("Missing input target: ")} + ${JSON.stringify(selector)});
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
    setter.call(input, ${JSON.stringify(value)});
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
    return new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  })()`, true);
}

async function hover(window, selector) {
  const point = await window.webContents.executeJavaScript(`(() => {
    const node = document.querySelector(${JSON.stringify(selector)});
    if (!node) throw new Error(${JSON.stringify("Missing hover target: ")} + ${JSON.stringify(selector)});
    const bounds = node.getBoundingClientRect();
    return { x: Math.round(bounds.left + bounds.width / 2), y: Math.round(bounds.top + bounds.height / 2) };
  })()`, true);
  window.webContents.sendInputEvent({ type: "mouseMove", x: point.x, y: point.y });
  await new Promise((resolve) => setTimeout(resolve, 250));
}

async function clearHover(window) {
  window.webContents.sendInputEvent({ type: "mouseMove", x: 840, y: 24 });
  await new Promise((resolve) => setTimeout(resolve, 120));
}

async function assertHoverTint(window, selector) {
  await clearHover(window);
  const bounds = await window.webContents.executeJavaScript(`(() => {
    const node = document.querySelector(${JSON.stringify(selector)});
    if (!node) throw new Error(${JSON.stringify("Missing hover-tint target: ")} + ${JSON.stringify(selector)});
    const rect = node.getBoundingClientRect();
    return {
      left: rect.left,
      top: rect.top,
      width: rect.width,
      height: rect.height,
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
    };
  })()`, true);
  const before = await capturePageWithVizRetry(window.webContents);
  await hover(window, selector);
  const after = await capturePageWithVizRetry(window.webContents);
  const size = before.getSize();
  const scaleX = size.width / bounds.viewportWidth;
  const scaleY = size.height / bounds.viewportHeight;
  const left = Math.max(0, Math.floor((bounds.left + bounds.width * 0.25) * scaleX));
  const right = Math.min(size.width, Math.ceil((bounds.left + bounds.width * 0.75) * scaleX));
  const top = Math.max(0, Math.floor((bounds.top + bounds.height * 0.15) * scaleY));
  const bottom = Math.min(size.height, Math.ceil((bounds.top + bounds.height * 0.5) * scaleY));
  const beforePixels = before.toBitmap();
  const afterPixels = after.toBitmap();
  let difference = 0;
  let samples = 0;
  for (let y = top; y < bottom; y += 2) {
    for (let x = left; x < right; x += 2) {
      const offset = (y * size.width + x) * 4;
      difference += Math.abs(beforePixels[offset] - afterPixels[offset]);
      difference += Math.abs(beforePixels[offset + 1] - afterPixels[offset + 1]);
      difference += Math.abs(beforePixels[offset + 2] - afterPixels[offset + 2]);
      samples += 3;
    }
  }
  let meanDifference = samples ? difference / samples : 0;
  if (meanDifference < 2) {
    await window.webContents.executeJavaScript(`(() => {
      const node = document.querySelector(${JSON.stringify(selector)});
      node?.focus({ focusVisible: true });
    })()`, true);
    await new Promise((resolve) => setTimeout(resolve, 120));
    const focused = await capturePageWithVizRetry(window.webContents);
    const focusedPixels = focused.toBitmap();
    difference = 0;
    samples = 0;
    for (let y = top; y < bottom; y += 2) {
      for (let x = left; x < right; x += 2) {
        const offset = (y * size.width + x) * 4;
        difference += Math.abs(beforePixels[offset] - focusedPixels[offset]);
        difference += Math.abs(beforePixels[offset + 1] - focusedPixels[offset + 1]);
        difference += Math.abs(beforePixels[offset + 2] - focusedPixels[offset + 2]);
        samples += 3;
      }
    }
    meanDifference = samples ? difference / samples : 0;
  }
  if (meanDifference < 2) {
    throw new Error(`Hover/focus tint did not visibly change ${selector}; mean RGB delta ${meanDifference.toFixed(2)}`);
  }
}

async function waitForMissing(window, selector, timeout = 10000) {
  const source = `new Promise((resolve, reject) => {
    const started = Date.now();
    const timer = setInterval(() => {
      const node = document.querySelector(${JSON.stringify(selector)});
      if (!node) { clearInterval(timer); resolve(true); }
      else if (Date.now() - started > ${timeout}) { clearInterval(timer); reject(new Error(${JSON.stringify(`Timed out waiting for removal: ${selector}`)})); }
    }, 40);
  })`;
  return window.webContents.executeJavaScript(source, true);
}

async function assertNoNpcPortraitRuntime(window, label) {
  const evidence = await window.webContents.executeJavaScript(`(() => ({
    elements: Array.from(document.querySelectorAll('.npc-portrait, [data-npc-expression], img[src*="assets/characters"]'), (node) => ({
      tag: node.tagName,
      className: node.className,
      src: node.getAttribute?.("src") ?? null,
    })),
    resources: performance.getEntriesByType("resource")
      .map((entry) => entry.name)
      .filter((name) => /assets[\\/]characters|npc-portrait/i.test(name)),
  }))()`, true);
  if (evidence.elements.length || evidence.resources.length) {
    throw new Error(`NPC portrait runtime leak at ${label}: ${JSON.stringify(evidence)}`);
  }
}
const MORSE = Object.freeze({
  A: ".-", B: "-...", C: "-.-.", D: "-..", E: ".", F: "..-.", G: "--.", H: "....", I: "..", J: ".---",
  K: "-.-", L: ".-..", M: "--", N: "-.", O: "---", P: ".--.", Q: "--.-", R: ".-.", S: "...", T: "-",
  U: "..-", V: "...-", W: ".--", X: "-..-", Y: "-.--", Z: "--..",
  0: "-----", 1: ".----", 2: "..---", 3: "...--", 4: "....-", 5: ".....", 6: "-....", 7: "--...", 8: "---..", 9: "----.",
});

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

const QSO_SUBMIT_ADVANCED_SELECTOR = [
  '[data-qso-phase="NPC_OPTIONAL_QUERY"]',
  '[data-qso-phase="PLAYER_OPTIONAL_ANSWER"]',
  '[data-qso-phase="NPC_73_AND_SK"]',
  '.qso-result-modal.success',
].join(", ");

async function waitForQsoSubmitDecision(window, {
  focusFn = focusQaWindow,
  waitForFn = waitFor,
} = {}) {
  await focusFn(window, "after submitting a QSO reply");
  await waitForFn(
    window,
    `${QSO_SUBMIT_ADVANCED_SELECTOR}, [data-qso-phase="PLAYER_RST_AND_73"] [data-action="submit-reply"][disabled]`,
    10000,
  );
  await waitForFn(
    window,
    `${QSO_SUBMIT_ADVANCED_SELECTOR}, [data-qso-phase="PLAYER_RST_AND_73"] [data-action="submit-reply"]:not([disabled])`,
    10000,
  );
  return window.webContents.executeJavaScript(
    'document.querySelector(".station-screen")?.dataset.qsoPhase ?? null',
    true,
  );
}

async function capturePageWithVizRetry(webContents, {
  maxAttempts = 4,
  retryDelayMs = 750,
  captureTimeoutMs = 10_000,
} = {}) {
  const boundedAttempts = Math.max(1, Math.floor(Number(maxAttempts) || 1));
  const boundedTimeout = Math.max(1, Math.floor(Number(captureTimeoutMs) || 1));
  for (let attempt = 1; attempt <= boundedAttempts; attempt += 1) {
    try {
      let timeoutId;
      try {
        return await Promise.race([
          Promise.resolve().then(() => webContents.capturePage()),
          new Promise((_, reject) => {
            timeoutId = setTimeout(() => {
              const timeout = new Error(`capturePage timed out after ${boundedTimeout}ms`);
              timeout.code = "CWGAME_CAPTURE_TIMEOUT";
              reject(timeout);
            }, boundedTimeout);
          }),
        ]);
      } finally {
        clearTimeout(timeoutId);
      }
    } catch (error) {
      const unknownViz = String(error?.message ?? error).includes("UnknownVizError");
      const captureTimeout = error?.code === "CWGAME_CAPTURE_TIMEOUT";
      if ((!unknownViz && !captureTimeout) || attempt === boundedAttempts) throw error;
      await delay(retryDelayMs);
    }
  }
  throw new Error("capturePage retry loop exhausted unexpectedly");
}

function automaticQaGapAfterElement(separator, wpm = 18) {
  const dotMs = 1200 / wpm;
  if (separator === "character") return dotMs * 2;
  if (separator === "word") return dotMs * 6;
  throw new Error(`Unsupported automatic QA separator: ${separator}`);
}

function automaticQaShouldWaitForIdleAfterSymbol(symbolIndex, symbolCount) {
  return symbolIndex === symbolCount - 1;
}

function lightsKeyInputForSymbol(symbol) {
  if (symbol === ".") return { keyCode: "Z" };
  if (symbol === "-") return { keyCode: "X" };
  throw new Error(`Unsupported Lights QA key symbol: ${symbol}`);
}

async function sendAutomaticStationText(window, text, wpm = 18) {
  const dotMs = 1200 / wpm;
  const tapHoldMs = dotMs * 0.12;
  const words = String(text).toUpperCase().trim().split(/\s+/);
  const expected = words.join(" ");
  const steps = [];
  for (let wordIndex = 0; wordIndex < words.length; wordIndex += 1) {
    const characters = [...words[wordIndex]];
    for (let characterIndex = 0; characterIndex < characters.length; characterIndex += 1) {
      const pattern = MORSE[characters[characterIndex]];
      if (!pattern) continue;
      const lastCharacter = characterIndex === characters.length - 1;
      const lastWord = wordIndex === words.length - 1;
      const separator = !lastCharacter ? "character" : !lastWord ? "word" : null;
      steps.push({
        character: characters[characterIndex],
        keyCodes: [...pattern].map((symbol) => (symbol === "." ? "Z" : "X")),
        gapMs: separator ? automaticQaGapAfterElement(separator, wpm) : 0,
      });
    }
  }
  let result = { decoded: "", pulseCount: 0 };
  for (let stepIndex = 0; stepIndex < steps.length; stepIndex += 1) {
    const step = steps[stepIndex];
    await focusQaWindow(
      window,
      `before station character ${stepIndex + 1}/${steps.length} (${step.character})`,
    );
    result = await window.webContents.executeJavaScript(`(async () => {
    const keyCodes = ${JSON.stringify(step.keyCodes)};
    const tapHoldMs = ${JSON.stringify(tapHoldMs)};
    const taskChannel = new MessageChannel();
    const taskWaiters = [];
    taskChannel.port1.onmessage = () => taskWaiters.shift()?.();
    const yieldTask = () => new Promise((resolve) => {
      taskWaiters.push(resolve);
      taskChannel.port2.postMessage(null);
    });
    const holdTap = () => {
      const started = performance.now();
      while (performance.now() - started < tapHoldMs) {}
    };
    const station = () => document.querySelector(".station-screen");
    const pulseCount = () => Number(station()?.dataset.pulseCount || 0);
    const waitUntil = (predicate, description) => new Promise((resolve, reject) => {
      const started = Date.now();
      const timer = setInterval(() => {
        if (predicate()) { clearInterval(timer); resolve(true); }
        else if (Date.now() - started > 3000) {
          clearInterval(timer);
          reject(new Error(description + "; rendered state: " + JSON.stringify({
            phase: station()?.dataset.qsoPhase ?? null,
            decoded: station()?.dataset.decoded ?? null,
            pulseCount: station()?.dataset.pulseCount ?? null,
            keyType: document.querySelector(".key-card strong")?.textContent ?? null,
            bodyClass: document.body.className,
            documentHasFocus: document.hasFocus(),
            visibilityState: document.visibilityState,
          })));
        }
      }, 20);
    });
    if (!Number.isFinite(pulseCount())) throw new Error("Station input DOM state is unavailable");
    await yieldTask();
    try {
      const before = pulseCount();
      const heldCodes = new Set();
      try {
        for (const keyCode of keyCodes) {
          const code = "Key" + keyCode;
          window.dispatchEvent(new KeyboardEvent("keydown", {
            code, key: keyCode.toLowerCase(), bubbles: true, cancelable: true,
          }));
          heldCodes.add(code);
          holdTap();
          window.dispatchEvent(new KeyboardEvent("keyup", {
            code, key: keyCode.toLowerCase(), bubbles: true, cancelable: true,
          }));
          heldCodes.delete(code);
          await yieldTask();
        }
      } finally {
        for (const code of heldCodes) {
          window.dispatchEvent(new KeyboardEvent("keyup", {
            code, key: code.slice(3).toLowerCase(), bubbles: true, cancelable: true,
          }));
        }
      }
      await waitUntil(
        () => pulseCount() >= before + keyCodes.length,
        "Station automatic-key character pulses were not observed",
      );
      await waitUntil(
        () => Boolean(document.querySelector('[data-action="submit-reply"]:not([disabled])')),
        "Station automatic keyer did not become idle",
      );
    } finally {
      taskChannel.port1.close();
      taskChannel.port2.close();
    }
    return { decoded: station()?.dataset.decoded ?? "", pulseCount: pulseCount() };
  })()`, true);
    if (step.gapMs > 0) await delay(step.gapMs);
  }
  if (result.decoded.trim().replace(/\s+/g, " ") !== expected) {
    throw new Error(`Station automatic input decoded '${result.decoded}' instead of '${expected}'`);
  }
  return result;
}

async function sendAutomaticContestText(window, text, wpm = 18) {
  const dotMs = 1200 / wpm;
  const tapHoldMs = dotMs * 0.12;
  const words = String(text).toUpperCase().trim().split(/\s+/);
  const expected = words.join(" ");
  const steps = [];
  for (let wordIndex = 0; wordIndex < words.length; wordIndex += 1) {
    const characters = [...words[wordIndex]];
    for (let characterIndex = 0; characterIndex < characters.length; characterIndex += 1) {
      const pattern = MORSE[characters[characterIndex]];
      if (!pattern) continue;
      const lastCharacter = characterIndex === characters.length - 1;
      const lastWord = wordIndex === words.length - 1;
      steps.push({
        character: characters[characterIndex],
        keyCodes: [...pattern].map((symbol) => (symbol === "." ? "Z" : "X")),
        gapMs: !lastCharacter ? automaticQaGapAfterElement("character", wpm)
          : !lastWord ? automaticQaGapAfterElement("word", wpm) : 0,
      });
    }
  }
  let result = { decoded: "", pulseCount: 0 };
  for (let stepIndex = 0; stepIndex < steps.length; stepIndex += 1) {
    const step = steps[stepIndex];
    await focusQaWindow(window, `before contest character ${stepIndex + 1}/${steps.length} (${step.character})`);
    result = await window.webContents.executeJavaScript(`(async () => {
      const screen = () => document.querySelector(".contest-screen");
      const pulseCount = () => Number(screen()?.dataset.pulseCount || 0);
      const keyCodes = ${JSON.stringify(step.keyCodes)};
      const tapHoldMs = ${JSON.stringify(tapHoldMs)};
      const channel = new MessageChannel();
      const waiters = [];
      channel.port1.onmessage = () => waiters.shift()?.();
      const yieldTask = () => new Promise((resolve) => { waiters.push(resolve); channel.port2.postMessage(null); });
      const waitUntil = (predicate, description) => new Promise((resolve, reject) => {
        const started = Date.now();
        const timer = setInterval(() => {
          if (predicate()) { clearInterval(timer); resolve(true); }
          else if (Date.now() - started > 3000) {
            clearInterval(timer);
            reject(new Error(description + "; rendered state: " + JSON.stringify({
              phase: screen()?.dataset.contestPhase ?? null,
              decoded: screen()?.dataset.decoded ?? null,
              pulseCount: screen()?.dataset.pulseCount ?? null,
              keying: screen()?.dataset.contestKeying ?? null,
              documentHasFocus: document.hasFocus(), visibilityState: document.visibilityState,
            })));
          }
        }, 20);
      });
      const before = pulseCount();
      try {
        for (const keyCode of keyCodes) {
          const code = "Key" + keyCode;
          window.dispatchEvent(new KeyboardEvent("keydown", { code, key: keyCode.toLowerCase(), bubbles: true, cancelable: true }));
          const started = performance.now();
          while (performance.now() - started < tapHoldMs) {}
          window.dispatchEvent(new KeyboardEvent("keyup", { code, key: keyCode.toLowerCase(), bubbles: true, cancelable: true }));
          await yieldTask();
        }
        await waitUntil(() => pulseCount() >= before + keyCodes.length, "Contest automatic-key character pulses were not observed");
        await waitUntil(() => screen()?.dataset.contestKeying === "false", "Contest automatic keyer did not become idle");
        return { decoded: screen()?.dataset.decoded ?? "", pulseCount: pulseCount() };
      } finally {
        channel.port1.close(); channel.port2.close();
      }
    })()`, true);
    if (step.gapMs > 0) await delay(step.gapMs);
  }
  if (result.decoded.trim().replace(/\s+/g, " ") !== expected) {
    throw new Error(`Contest automatic input decoded '${result.decoded}' instead of '${expected}'`);
  }
  return result;
}

async function sendAutomaticStationRun(window, symbol, count, { expectClear = false } = {}) {
  if (symbol !== "." && symbol !== "-") throw new Error(`Unsupported QA automatic-key symbol: ${symbol}`);
  const eventCode = symbol === "." ? "KeyZ" : "KeyX";
  const key = symbol === "." ? "z" : "x";
  return window.webContents.executeJavaScript(`(async () => {
    const station = () => document.querySelector(".station-screen");
    const pulseCount = () => Number(station()?.dataset.pulseCount || 0);
    const before = pulseCount();
    let sawProgress = false;
    for (let index = 0; index < ${count}; index += 1) {
      window.dispatchEvent(new KeyboardEvent("keydown", { code: ${JSON.stringify(eventCode)}, key: ${JSON.stringify(key)}, bubbles: true, cancelable: true }));
      window.dispatchEvent(new KeyboardEvent("keyup", { code: ${JSON.stringify(eventCode)}, key: ${JSON.stringify(key)}, bubbles: true, cancelable: true }));
    }
    await new Promise((resolve, reject) => {
      const started = Date.now();
      const timer = setInterval(() => {
        const current = pulseCount();
        if (current > before) sawProgress = true;
        if (${expectClear} ? sawProgress && current === 0 : current >= before + ${count}) {
          clearInterval(timer);
          resolve(true);
        } else if (Date.now() - started > 3000) {
          clearInterval(timer);
          reject(new Error("Automatic ${symbol} clear-gesture pulse was dropped at ${count}/${count}; rendered state: " + JSON.stringify({
            phase: station()?.dataset.qsoPhase ?? null,
            decoded: station()?.dataset.decoded ?? null,
            pulseCount: station()?.dataset.pulseCount ?? null,
            keyType: document.querySelector(".key-card strong")?.textContent ?? null,
            bodyClass: document.body.className,
          })));
        }
      }, 20);
    });
    await new Promise((resolve) => setTimeout(resolve, 120));
    return { decoded: station()?.dataset.decoded ?? "", pulseCount: pulseCount() };
  })()`, true);
}

const sendAutomaticText = sendAutomaticStationText;
const sendAutomaticRun = sendAutomaticStationRun;

async function assertHeldAutomaticKey(window, { code, key, holdMs, minimumPulses }) {
  const before = await window.webContents.executeJavaScript(
    'Number(document.querySelector(".practice-screen")?.dataset.pulseCount || 0)',
    true,
  );
  await window.webContents.executeJavaScript(`window.dispatchEvent(new KeyboardEvent("keydown", {
    code: ${JSON.stringify(code)},
    key: ${JSON.stringify(key)},
    bubbles: true,
    cancelable: true,
  }))`, true);
  await delay(holdMs);
  await window.webContents.executeJavaScript(`window.dispatchEvent(new KeyboardEvent("keyup", {
    code: ${JSON.stringify(code)},
    key: ${JSON.stringify(key)},
    bubbles: true,
    cancelable: true,
  }))`, true);
  await delay(260);
  const after = await window.webContents.executeJavaScript(
    'Number(document.querySelector(".practice-screen")?.dataset.pulseCount || 0)',
    true,
  );
  if (after - before < minimumPulses) {
    throw new Error(`Held ${code} generated only ${after - before} pulses; expected at least ${minimumPulses}`);
  }
  await delay(320);
  const settled = await window.webContents.executeJavaScript(
    'Number(document.querySelector(".practice-screen")?.dataset.pulseCount || 0)',
    true,
  );
  if (settled !== after) throw new Error(`Held ${code} continued after keyup (${after} -> ${settled})`);
}

async function writeQaStep(outputDir, step) {
  const target = path.join(outputDir, "qa-step.txt");
  const temporary = path.join(outputDir, `.qa-step-${process.pid}-${Date.now()}.tmp`);
  try {
    await fs.writeFile(temporary, `${JSON.stringify(step)}\n`, "utf8");
    await fs.rename(temporary, target);
  } finally {
    await fs.rm(temporary, { force: true });
  }
}

function screenshotDimensions(filename) {
  const match = /-(\d+)x(\d+)\.png$/i.exec(filename);
  if (!match) throw new Error(`QA screenshot filename must end in WIDTHxHEIGHT.png: ${filename}`);
  return { width: Number(match[1]), height: Number(match[2]) };
}

async function waitForRendererImages(webContents, { timeoutMs = 5_000 } = {}) {
  const boundedTimeout = Math.max(1, Math.floor(Number(timeoutMs) || 1));
  let timeoutId;
  try {
    return await Promise.race([
      webContents.executeJavaScript(`Promise.all(Array.from(document.images).map(async (image) => {
        if (!image.complete) await new Promise((resolve) => { image.addEventListener("load", resolve, { once: true }); image.addEventListener("error", resolve, { once: true }); });
        if (image.decode) await image.decode().catch(() => {});
      }))`, true).then(() => ({ timedOut: false })),
      new Promise((resolve) => {
        timeoutId = setTimeout(() => resolve({ timedOut: true }), boundedTimeout);
      }),
    ]);
  } finally {
    clearTimeout(timeoutId);
  }
}

async function capture(window, outputDir, filename, { scope = process.env.CWGAME_QA_SCOPE || "full" } = {}) {
  await writeQaStep(outputDir, {
    scope,
    filename,
    phase: "capture-start",
    at: new Date().toISOString(),
  });
  await waitForRendererImages(window.webContents);
  await new Promise((resolve) => setTimeout(resolve, 1000));
  // Software-rendered packaged builds can return the previous compositor frame
  // on the first capture after a large modal or route transition.
  await capturePageWithVizRetry(window.webContents);
  await new Promise((resolve) => setTimeout(resolve, 150));
  const image = await capturePageWithVizRetry(window.webContents);
  const { width, height } = screenshotDimensions(filename);
  const normalizedImage = image.resize({ width, height, quality: "best" });
  await fs.writeFile(path.join(outputDir, filename), normalizedImage.toPNG());
  await writeQaStep(outputDir, {
    scope,
    filename,
    phase: "capture-complete",
    at: new Date().toISOString(),
  });
}

async function clickAt(window, selector) {
  const point = await window.webContents.executeJavaScript(`(() => {
    const node = document.querySelector(${JSON.stringify(selector)});
    if (!node) throw new Error(${JSON.stringify("Missing click target: ")} + ${JSON.stringify(selector)});
    const rect = node.getBoundingClientRect();
    return { x: Math.round(rect.left + rect.width / 2), y: Math.round(rect.top + rect.height / 2) };
  })()`, true);
  window.webContents.sendInputEvent({ type: "mouseDown", x: point.x, y: point.y, button: "left", clickCount: 1 });
  window.webContents.sendInputEvent({ type: "mouseUp", x: point.x, y: point.y, button: "left", clickCount: 1 });
}

async function pressKey(window, { key, code }) {
  await window.webContents.executeJavaScript(`window.dispatchEvent(new KeyboardEvent("keydown", {
    key: ${JSON.stringify(key)}, code: ${JSON.stringify(code)}, bubbles: true, cancelable: true,
  }))`, true);
}

async function lightsQaPhaseDiagnostics(window) {
  const dom = await window.webContents.executeJavaScript(`(() => ({
    phase: document.querySelector(".lights-event-screen")?.dataset.eventPhase ?? null,
    expectedText: document.querySelector(".lights-tx-line strong")?.textContent ?? null,
    errorText: document.querySelector(".lights-error")?.textContent ?? null,
    documentHasFocus: document.hasFocus(),
    visibilityState: document.visibilityState,
  }))()`, true);
  try {
    return { ...dom, run: await readRenderedLightsRunSnapshot(window) };
  } catch (error) {
    return { ...dom, runReadError: error.message };
  }
}

async function waitForLightsPhase(window, phase, context = "while advancing Lights") {
  try {
    await focusQaWindow(window, context);
    await waitFor(window, `.lights-event-screen[data-event-phase="${phase}"]`);
  } catch (error) {
    const diagnostics = await lightsQaPhaseDiagnostics(window);
    throw new Error(formatLightsWaitFailure(context, phase, diagnostics));
  }
}

async function focusQaWindow(window, context) {
  const readRendererFocus = () => window.webContents.executeJavaScript(
    `({ hasFocus: document.hasFocus(), visibilityState: document.visibilityState })`, true,
  );
  const readRendererFocusSafely = async () => {
    try { return await readRendererFocus(); } catch { return null; }
  };
  const initial = await readRendererFocusSafely();
  if (initial?.hasFocus === true) return initial;
  if (window.isMinimized()) window.restore();
  window.show();
  window.focus();
  window.webContents.focus();
  try {
    await window.webContents.executeJavaScript(`new Promise((resolve, reject) => {
      const started = Date.now();
      const timer = setInterval(() => {
        if (document.hasFocus()) { clearInterval(timer); resolve(true); }
        else if (Date.now() - started > 3000) { clearInterval(timer); reject(new Error("renderer did not gain focus")); }
      }, 20);
    })`, true);
  } catch (error) {
    const state = await readRendererFocusSafely();
    const diagnostics = {
      windowIsFocused: typeof window.isFocused === "function" ? window.isFocused() : null,
      hasFocus: state?.hasFocus ?? null,
      visibilityState: state?.visibilityState ?? null,
      error: error.message,
    };
    throw new Error(`QA could not focus the real renderer ${context}: ${JSON.stringify(diagnostics)}`);
  }
}

async function waitForFocusedQsoState(window, selector, {
  context = "before waiting for focused QSO state",
  timeout = 10_000,
  waitForFn = waitFor,
} = {}) {
  await focusQaWindow(window, context);
  await waitForFn(window, selector, timeout);
  return window.webContents.executeJavaScript(
    'document.querySelector(".station-screen")?.dataset.qsoPhase ?? null',
    true,
  );
}

async function startGuidedQaWatch(window) {
  await focusQaWindow(window, "before starting the guided QSO watch");
  await click(window, '[data-action="start-guided-watch"]');
  await waitForMissing(window, '[data-testid="qso-briefing-modal"]');
  await waitFor(window, '[data-qso-phase="PLAYER_CQ"][data-receiver-active="true"]', 10000);
}

async function readRenderedLightsRunSnapshot(window) {
  return window.webContents.executeJavaScript(`(() => {
    const screen = document.querySelector(".lights-event-screen");
    if (!screen) throw new Error("Lights event screen is not mounted");
    const fiberKey = Object.keys(screen).find((key) => key.startsWith("__reactFiber$"));
    if (!fiberKey) throw new Error("Could not locate the rendered Lights React fiber");
    const visited = new Set();
    for (let fiber = screen[fiberKey]; fiber && !visited.has(fiber); fiber = fiber.return) {
      visited.add(fiber);
      for (let hook = fiber.memoizedState; hook; hook = hook.next) {
        const run = hook.memoizedState;
        if (!run || typeof run !== "object" || typeof run.phase !== "string" || !Array.isArray(run.contacts)) continue;
        return {
          phase: run.phase,
          lastError: run.lastError ?? null,
          pileup: run.pileup ? { callers: (run.pileup.callers ?? []).map(({ callsign, regionCode }) => ({ callsign, regionCode })) } : null,
          selectedCaller: run.selectedCaller ? { callsign: run.selectedCaller.callsign, regionCode: run.selectedCaller.regionCode } : null,
          contacts: run.contacts.map(({ callsign, eventRegionCode }) => ({ callsign, eventRegionCode })),
        };
      }
    }
    throw new Error("Could not locate the rendered Lights run state");
  })()`, true);
}

async function waitForStationAfterLog(window) {
  try {
    await waitFor(window, ".station-screen");
  } catch (error) {
    const diagnostics = await window.webContents.executeJavaScript(`(() => {
      const stationButton = document.querySelector(".hotspot-station");
      const screen = document.querySelector("main.screen");
      return {
        screenClass: screen?.className ?? null,
        stationButton: stationButton ? {
          disabled: Boolean(stationButton.disabled),
          connected: stationButton.isConnected,
          bounds: stationButton.getBoundingClientRect().toJSON(),
        } : null,
        qsoLogVisible: Boolean(document.querySelector(".qso-log-modal")),
        modalCount: document.querySelectorAll('[aria-modal="true"]').length,
      };
    })()`, true);
    throw new Error(`Station did not mount after log return: ${JSON.stringify(diagnostics)}; ${error.message}`);
  }
}

async function advanceLightsClockToTimeout(window) {
  const installed = await window.webContents.executeJavaScript(`(() => {
    const original = window.__cwgameQaOriginalPerformanceNow ?? performance.now.bind(performance);
    window.__cwgameQaOriginalPerformanceNow = original;
    Object.defineProperty(performance, "now", {
      configurable: true,
      value: () => original() + 481000,
    });
    return performance.now() - original() >= 480000;
  })()`, true);
  if (!installed) throw new Error("Could not install the deterministic Lights QA clock");
  await waitForLightsPhase(window, "RUN_COMPLETE", "after deterministic active clock advance");
  await window.webContents.executeJavaScript(`(() => {
    if (!window.__cwgameQaOriginalPerformanceNow) throw new Error("Missing deterministic Lights QA clock");
    delete performance.now;
    delete window.__cwgameQaOriginalPerformanceNow;
  })()`, true);
}

async function readLightsQaSave(window) {
  return window.webContents.executeJavaScript(`(() => {
    const saves = JSON.parse(localStorage.getItem("game-morse-adventurer.saves.v1") || "[]");
    const save = saves.find((candidate) => candidate.id === "qa-lights-save");
    if (!save) throw new Error("Missing seeded Lights QA save");
    const qsoLogs = Array.isArray(save.qsoLogs) ? save.qsoLogs : [];
    const story05History = (save.missionState?.history ?? []).find(({ id }) => id === "story-05");
    return {
      id: save.id,
      callsign: save.callsign,
      claimedMissionIds: save.missionState?.claimedMissionIds ?? [],
      activeMissionIds: (save.missionState?.activeMissions ?? []).map(({ id }) => id),
      settledRunIds: save.lightsEventState?.settledRunIds ?? [],
      storyBest: save.lightsEventState?.storyBest ?? null,
      qsoLogCount: qsoLogs.length,
      eventQsoCredits: qsoLogs.reduce((total, log) => total + Number(log.credits ?? 0), 0),
      claimedAchievementRewards: save.claimedAchievementRewards ?? [],
      story05MissionMoneyAwarded: story05History?.moneyReward ?? null,
      money: Number(save.money ?? 0),
    };
  })()`, true);
}

async function transmitLightsText(window, text) {
  await focusQaWindow(window, `before transmitting ${text}`);
  await sendAutomaticLightsText(window, text);
  await waitFor(window, '[data-action="lights-transmit"]:not([disabled])');
  await click(window, '[data-action="lights-transmit"]');
}

async function sendAutomaticLightsText(window, text, wpm = LIGHTS_QA_WPM) {
  const words = String(text).toUpperCase().trim().split(/\s+/);
  const steps = [];
  for (let wordIndex = 0; wordIndex < words.length; wordIndex += 1) {
    const characters = [...words[wordIndex]];
    for (let characterIndex = 0; characterIndex < characters.length; characterIndex += 1) {
      const pattern = MORSE[characters[characterIndex]];
      if (!pattern) continue;
      const lastCharacter = characterIndex === characters.length - 1;
      const lastWord = wordIndex === words.length - 1;
      const separator = !lastCharacter ? "character" : !lastWord ? "word" : null;
      steps.push({
        character: characters[characterIndex],
        keyCodes: [...pattern].map((symbol) => lightsKeyInputForSymbol(symbol).keyCode),
        gapMs: separator ? automaticQaGapAfterElement(separator, wpm) : 0,
      });
    }
  }
  const expected = String(text).toUpperCase().trim().replace(/\s+/g, " ");
  for (let stepIndex = 0; stepIndex < steps.length; stepIndex += 1) {
    const step = steps[stepIndex];
    await focusQaWindow(window, `before Lights character ${stepIndex + 1}/${steps.length} (${step.character})`);
    await window.webContents.executeJavaScript(`(async () => {
    const keyCodes = ${JSON.stringify(step.keyCodes)};
    const pulseCount = () => Number(document.querySelector(".lights-event-screen")?.dataset.pulseCount);
    const decoded = () => document.querySelector(".lights-tx-line strong")?.textContent?.trim() || "";
    const waitUntil = (predicate, description) => new Promise((resolve, reject) => {
      const started = Date.now();
      const timer = setInterval(() => {
        if (predicate()) { clearInterval(timer); resolve(true); }
        else if (Date.now() - started > 3000) {
          clearInterval(timer);
          reject(new Error(description + "; rendered state: " + JSON.stringify({
            phase: document.querySelector(".lights-event-screen")?.dataset.eventPhase ?? null,
            pulseCount: pulseCount(), decoded: decoded(), documentHasFocus: document.hasFocus(),
            visibilityState: document.visibilityState,
          })));
        }
      }, 20);
    });
    if (!Number.isFinite(pulseCount())) throw new Error("Lights input DOM state is unavailable");
    const before = pulseCount();
    const heldCodes = new Set();
    try {
      for (const keyCode of keyCodes) {
        const code = "Key" + keyCode;
        window.dispatchEvent(new KeyboardEvent("keydown", {
          code, key: keyCode.toLowerCase(), bubbles: true, cancelable: true,
        }));
        heldCodes.add(code);
        window.dispatchEvent(new KeyboardEvent("keyup", {
          code, key: keyCode.toLowerCase(), bubbles: true, cancelable: true,
        }));
        heldCodes.delete(code);
      }
    } finally {
      for (const code of heldCodes) {
        window.dispatchEvent(new KeyboardEvent("keyup", {
          code, key: code.slice(3).toLowerCase(), bubbles: true, cancelable: true,
        }));
      }
    }
    await waitUntil(
      () => pulseCount() >= before + keyCodes.length,
      "Lights automatic-key character pulses were not observed",
    );
    await waitUntil(
      () => Boolean(document.querySelector('[data-action="lights-transmit"]:not([disabled])')),
      "Lights automatic keyer did not become idle",
    );
    return { decoded: decoded(), pulseCount: pulseCount() };
  })()`, true);
    if (step.gapMs > 0) await delay(step.gapMs);
  }
  return window.webContents.executeJavaScript(`(async () => {
    const expected = ${JSON.stringify(expected)};
    const decoded = () => document.querySelector(".lights-tx-line strong")?.textContent?.trim() || "";
    const started = Date.now();
    while (decoded() !== expected) {
      if (Date.now() - started > 3000) {
        throw new Error("Lights automatic input decoded '" + decoded() + "' instead of '" + expected + "'");
      }
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
    return {
      decoded: decoded(),
      pulseCount: Number(document.querySelector(".lights-event-screen")?.dataset.pulseCount),
    };
  })()`, true);
}

async function completeLightsControlRound(window) {
  await transmitLightsText(window, "CQ LGT CQ LGT DE SIM5LT K");
  await waitForLightsPhase(window, "CONTROL_SELECTION", "after control CQ transmission");
  const pileup = await readRenderedLightsRunSnapshot(window);
  const callsign = selectLightsCallerFromRuntimeSnapshot(pileup);
  await transmitLightsText(window, `${callsign} DE SIM5LT KN`);
  await waitForLightsPhase(window, "CONTROL_PLAYER_REPORT", `after selecting rendered caller ${callsign}`);
  const selected = await readRenderedLightsRunSnapshot(window);
  if (selected.selectedCaller?.callsign !== callsign || selected.lastError) {
    throw new Error(`Lights QA selection feedback did not confirm ${callsign}: ${JSON.stringify(selected)}`);
  }
  await transmitLightsText(window, `${callsign} DE SIM5LT RST 579 CN K`);
  await waitForLightsPhase(window, "CONTROL_CQ", `after reporting to rendered caller ${callsign}`);
  return { callsign, regionCode: pileup.pileup.callers.find((caller) => caller.callsign === callsign)?.regionCode ?? null };
}

async function seedLightsQaSave(window) {
  await window.webContents.executeJavaScript(`(() => {
    const save = {
      id: "qa-lights-save",
      callsign: "QA5LGT",
      locationId: "china-beijing-outskirts",
      keyType: "automatic",
      automaticKeyWpm: ${LIGHTS_QA_WPM},
      qsoGuidance: "full",
      missionState: {
        claimedMissionIds: ["story-01", "story-02", "story-03", "story-04"],
        activeMissions: [],
        history: [],
      },
      qsoLogs: [],
      qsoRecords: { total: 0, settledQsoIds: [] },
      lightsEventState: { settledRunIds: [], storyBest: null, lifetimeGradePaid: 0, practiceRecords: [] },
      createdAt: "2026-05-05T08:00:00.000Z",
      updatedAt: "2026-05-05T08:00:00.000Z",
    };
    localStorage.setItem("game-morse-adventurer.saves.v1", JSON.stringify([save]));
    localStorage.setItem("game-morse-adventurer.active-save.v1", save.id);
  })()`, true);
}

async function stationEntryDiagnostics(window) {
  return window.webContents.executeJavaScript(`(() => {
    const hotspot = document.querySelector(".hotspot-station");
    const active = document.activeElement;
    const rect = hotspot?.getBoundingClientRect();
    return {
      screenClass: document.querySelector("main.screen")?.className ?? null,
      hotspot: hotspot ? {
        disabled: Boolean(hotspot.disabled),
        connected: hotspot.isConnected,
        bounds: rect ? { left: rect.left, top: rect.top, width: rect.width, height: rect.height } : null,
      } : null,
      openModals: Array.from(document.querySelectorAll('[aria-modal="true"]'), (node) => node.className),
      visibilityState: document.visibilityState,
      documentHasFocus: document.hasFocus(),
      activeElement: active ? { tag: active.tagName, className: active.className, action: active.dataset?.action ?? null } : null,
      stationPresent: Boolean(document.querySelector(".station-screen")),
    };
  })()`, true);
}

async function runStationEntryProbe(window) {
  const consoleErrors = [];
  const onConsoleMessage = (_event, levelOrDetails, message) => {
    const details = typeof levelOrDetails === "object" ? levelOrDetails : { level: levelOrDetails, message };
    if (details.level === 2 || details.level === 3 || details.level === "warning" || details.level === "error") {
      consoleErrors.push({ level: details.level, message: details.message || message || "" });
    }
  };
  window.webContents.on("console-message", onConsoleMessage);
  try {
  await window.webContents.session.clearStorageData();
  await window.reload();
  await waitFor(window, ".start-screen");
  await click(window, ".start-actions button:nth-child(2)");
  await waitFor(window, ".practice-screen");
  await click(window, '[data-action="practice-back"]');
  await waitFor(window, ".start-screen");
  await seedLightsQaSave(window);
  await window.reload();
  await waitFor(window, ".start-screen");
  await click(window, ".menu-primary");
  await waitFor(window, ".save-select-screen");
  await click(window, ".save-primary-action");
  await waitFor(window, ".home-screen");
  const before = await stationEntryDiagnostics(window);
  await click(window, ".hotspot-station");
  const afterClick = await stationEntryDiagnostics(window);
  let error = null;
  try {
    await waitFor(window, ".station-screen");
  } catch (failure) {
    error = { message: failure.message, afterTimeout: await stationEntryDiagnostics(window) };
  }
  const report = { before, afterClick, error, consoleErrors, passed: error === null };
  await fs.writeFile(path.join(process.env.CWGAME_QA_OUTPUT, "station-entry-probe.json"), `${JSON.stringify(report, null, 2)}\n`, "utf8");
  validateStationEntryProbe(report);
  return report;
  } finally {
    window.webContents.removeListener("console-message", onConsoleMessage);
  }
}

async function runLightsQaCapture(window, outputDir, suffix, {
  qaRunId = process.env.CWGAME_QA_RUN_ID,
} = {}) {
  validateQaRunId(qaRunId);
  const plan = buildLightsQaPlan({ suffix });
  const facts = { checkpoints: {} };
  const checkpoint = (id, value) => { facts.checkpoints[id] = value; };
  await fs.mkdir(outputDir, { recursive: true });
  const markStep = async (step) => fs.writeFile(
    path.join(outputDir, "qa-step.txt"),
    `${JSON.stringify({ step, at: new Date().toISOString() })}\n`,
    "utf8",
  );

  await markStep("focus-renderer");
  window.webContents.focus();
  await markStep("seed-save");
  await seedLightsQaSave(window);
  await markStep("reload-start");
  await window.reload();
  await markStep("wait-start");
  await waitFor(window, ".start-screen");
  await markStep("open-saves");
  await click(window, ".menu-primary");
  await markStep("wait-save-select");
  await waitFor(window, ".save-select-screen");
  await markStep("select-save");
  await click(window, ".save-primary-action");
  await markStep("wait-home");
  await waitFor(window, ".home-screen");
  await markStep("open-missions");
  await click(window, '[data-action="open-missions"]');
  await markStep("wait-story05-available");
  await waitFor(window, '[data-mission-id="story-05"][data-mission-status="available"]');
  await markStep("accept-story05");
  await click(window, '[data-action="accept-mission"][data-mission-action-id="story-05"]');
  await markStep("wait-story05-active");
  await waitFor(window, '[data-mission-id="story-05"][data-mission-status="active"]');
  await markStep("read-prepared-save");
  const prepared = await readLightsQaSave(window);
  if (!prepared.claimedMissionIds.includes("story-04") || !prepared.activeMissionIds.includes("story-05")) {
    throw new Error(`Lights story preparation did not produce an active story-05 mission: ${JSON.stringify(prepared)}`);
  }
  checkpoint("story-ready", {
    prerequisiteClaimed: true,
    story05Active: true,
    seed: durableLightsQaSnapshot(prepared),
  });

  await markStep("launch-story-lights");
  await click(window, '[data-action="launch-lights-story"]');
  await markStep("wait-lights-screen");
  await waitFor(window, ".lights-event-screen");
  await markStep("wait-chase-player-call");
  await waitForLightsPhase(window, "CHASE_PLAYER_CALL", "after story Lights launch");
  await markStep("keying-probe-RRR-RST");
  await focusQaWindow(window, "before keying probe");
  await sendAutomaticLightsText(window, "RRR RST");
  checkpoint("keying-probe", { text: "RRR RST", wpm: LIGHTS_QA_WPM, exact: true });
  await click(window, ".lights-event-controls button:nth-child(2)");
  await window.webContents.executeJavaScript(`new Promise((resolve, reject) => {
    const started = Date.now();
    const timer = setInterval(() => {
      if ((document.querySelector(".lights-tx-line strong")?.textContent || "").trim() === "_") { clearInterval(timer); resolve(true); }
      else if (Date.now() - started > 3000) { clearInterval(timer); reject(new Error("Lights keying probe did not clear its input")); }
    }, 20);
  })`, true);
  await capture(window, outputDir, plan.screenshots[0]);
  checkpoint("story-launch", { phase: "CHASE_PLAYER_CALL", mode: "story" });

  await transmitLightsText(window, "SIM5LT DE QA5LGT K");
  await waitForLightsPhase(window, "CHASE_PLAYER_REPORT", "after player chase call");
  await capture(window, outputDir, plan.screenshots[1]);
  await transmitLightsText(window, "SIM5LT DE QA5LGT RST 579 CN K");
  await waitForLightsPhase(window, "CONTROL_CQ", "after chase report");
  checkpoint("chase-complete", { phase: "CONTROL_CQ", completed: true });
  await capture(window, outputDir, plan.screenshots[2]);
  checkpoint("control-entered", { phase: "CONTROL_CQ" });

  await pressKey(window, { key: "Escape", code: "Escape" });
  await waitFor(window, ".settings-modal");
  const pausedPhase = await window.webContents.executeJavaScript(
    'document.querySelector(".lights-event-screen")?.dataset.eventPhase ?? null', true,
  );
  if (pausedPhase !== "CONTROL_CQ") throw new Error(`Escape did not pause Lights in control: ${pausedPhase}`);
  checkpoint("escape-paused", { phase: pausedPhase, settingsVisible: true });
  await pressKey(window, { key: "Escape", code: "Escape" });
  await waitForMissing(window, ".settings-modal");
  await waitForLightsPhase(window, "CONTROL_CQ", "after Escape resumes control");
  checkpoint("escape-resumed", { phase: "CONTROL_CQ", settingsVisible: false });

  await advanceLightsClockToTimeout(window);
  await waitFor(window, '[data-action="lights-retry-control"]');
  await capture(window, outputDir, plan.screenshots[3]);
  const failed = await window.webContents.executeJavaScript(`(() => ({
    phase: document.querySelector(".lights-event-screen")?.dataset.eventPhase ?? null,
    grade: document.querySelector("[data-lights-grade]")?.dataset.lightsGrade ?? null,
  }))()`, true);
  if (failed.phase !== "RUN_COMPLETE" || failed.grade !== "none") throw new Error(`Lights QA failed-run checkpoint is invalid: ${JSON.stringify(failed)}`);
  checkpoint("failed-run", failed);

  await click(window, '[data-action="lights-retry-control"]');
  await waitForLightsPhase(window, "CONTROL_CQ", "after retrying failed run");
  const afterRetry = await readLightsQaSave(window);
  if (afterRetry.settledRunIds.length !== 1) throw new Error(`Failed run was not settled exactly once before retry: ${JSON.stringify(afterRetry)}`);
  checkpoint("retry-control", { phase: "CONTROL_CQ", failedRunSettlementCount: afterRetry.settledRunIds.length });

  // Caller selection reads the live React run state mounted by the real renderer. That
  // makes the DOM-driving workflow follow the actual pile-up, rather than assuming a seed roster.
  const completedContacts = [];
  completedContacts.push(await completeLightsControlRound(window));
  completedContacts.push(await completeLightsControlRound(window));
  completedContacts.push(await completeLightsControlRound(window));
  await advanceLightsClockToTimeout(window);
  await waitFor(window, '[data-action="lights-settle"]:not([disabled])');
  const resultFacts = await window.webContents.executeJavaScript(`(() => ({
    phase: document.querySelector(".lights-event-screen")?.dataset.eventPhase ?? null,
    grade: document.querySelector("[data-lights-grade]")?.dataset.lightsGrade ?? null,
    contacts: Number(document.querySelector(".lights-event-meter div:nth-child(2) strong")?.textContent.split("/")[0] ?? 0),
    validQsoCount: Number(document.querySelector(".lights-event-screen")?.dataset.validQsoCount),
    distinctRegionCount: Number(document.querySelector(".lights-event-screen")?.dataset.distinctRegionCount),
    resolvedPileupCount: Number(document.querySelector(".lights-event-screen")?.dataset.resolvedPileupCount),
  }))()`, true);
  if (resultFacts.phase !== "RUN_COMPLETE" || resultFacts.grade !== "base" || resultFacts.contacts < 3
    || resultFacts.validQsoCount < 3 || resultFacts.distinctRegionCount < 2 || resultFacts.resolvedPileupCount < 1) {
    throw new Error(`Lights retry did not reach the required Base result: ${JSON.stringify(resultFacts)}`);
  }
  const beforeBaseClick = await readLightsQaSave(window);
  await click(window, '[data-action="lights-settle"]');
  await waitFor(window, ".lights-settlement-banner");
  const gradeMoneyAwarded = await window.webContents.executeJavaScript(
    'Number(document.querySelector(".lights-settlement-banner")?.dataset.lightsMoneyAwarded)', true,
  );
  await capture(window, outputDir, plan.screenshots[4]);
  const afterAchievementSettlement = await readLightsQaSave(window);
  if (afterAchievementSettlement.settledRunIds.length !== 2 || afterAchievementSettlement.qsoLogCount !== 3
    || gradeMoneyAwarded !== 0 || afterAchievementSettlement.eventQsoCredits !== 0) {
    throw new Error(`Lights Base and achievement settlement facts are invalid: ${JSON.stringify({ gradeMoneyAwarded, afterAchievementSettlement })}`);
  }

  await click(window, '[data-action="lights-settle"]');
  const duplicate = await readLightsQaSave(window);
  if (!sameDurableLightsSnapshot(
    durableLightsQaSnapshot(duplicate), durableLightsQaSnapshot(afterAchievementSettlement),
  )) {
    throw new Error(`Duplicate Lights settlement changed the save: ${JSON.stringify({ afterAchievementSettlement, duplicate })}`);
  }
  checkpoint("duplicate-settlement", {
    noOp: true,
    before: durableLightsQaSnapshot(afterAchievementSettlement),
    after: durableLightsQaSnapshot(duplicate),
  });

  await click(window, ".lights-event-header button");
  await waitFor(window, ".home-screen");
  await click(window, '[data-action="open-missions"]');
  await waitFor(window, '[data-mission-id="story-05"][data-mission-status="ready"]');
  await click(window, '[data-action="claim-mission"][data-mission-action-id="story-05"]');
  await waitFor(window, '[data-mission-id="story-05"][data-mission-status="claimed"]');
  const afterMissionClaim = await readLightsQaSave(window);
  const moneyFlow = buildLightsQaMoneyFlow({
    seed: prepared,
    beforeBaseClick,
    afterAchievementSettlement,
    afterMissionClaim,
    gradeMoneyAwarded,
  });
  if (moneyFlow.afterAchievementSettlement.achievementMoneyAwarded !== 540
    || moneyFlow.missionClaim.missionMoneyAwarded !== 500
    || moneyFlow.missionClaim.achievementMoneyAwarded !== 100
    || moneyFlow.missionClaim.totalMoneyAwarded !== 600
    || afterMissionClaim.storyBest?.grade !== "base") {
    throw new Error(`Lights staged reward accounting is invalid: ${JSON.stringify({ moneyFlow, afterMissionClaim })}`);
  }
  checkpoint("settled", {
    ...resultFacts,
    selectedContacts: completedContacts,
    moneyFlow,
    final: durableLightsQaSnapshot(afterMissionClaim),
  });
  await click(window, '[data-action="close-missions-footer"]');
  await waitForMissing(window, '[data-testid="mission-center-modal"]');

  await window.reload();
  await waitFor(window, ".start-screen");
  await click(window, ".menu-primary");
  await waitFor(window, ".save-select-screen");
  await click(window, ".save-primary-action");
  await waitFor(window, ".home-screen");
  await capture(window, outputDir, plan.screenshots[5]);
  const reloaded = await readLightsQaSave(window);
  if (!sameDurableLightsSnapshot(
    durableLightsQaSnapshot(reloaded), durableLightsQaSnapshot(afterMissionClaim),
  )) {
    throw new Error(`Lights settlement history did not survive reload: ${JSON.stringify({ afterMissionClaim, reloaded })}`);
  }
  checkpoint("reloaded-history", {
    ...durableLightsQaSnapshot(reloaded),
    storyBestGrade: reloaded.storyBest?.grade ?? null,
  });

  const result = {
    schemaVersion: 1,
    qaRunId,
    activity: "lights-across-air",
    resultFile: plan.resultFile,
    screenshots: plan.screenshots,
    ...facts,
  };
  await fs.writeFile(path.join(outputDir, plan.resultFile), `${JSON.stringify(result, null, 2)}\n`, "utf8");
  validateLightsQaEvidence(result, { qaRunId });
  return result;
}

async function runLightsQaSegment(window, outputDir, suffix, {
  qaRunId = process.env.CWGAME_QA_RUN_ID,
  runCaptureImpl = runLightsQaCapture,
} = {}) {
  validateQaRunId(qaRunId);
  const consoleErrors = [];
  const onConsoleMessage = (_event, levelOrDetails, message) => {
    const details = typeof levelOrDetails === "object" ? levelOrDetails : { level: levelOrDetails, message };
    if (details.level === 2 || details.level === 3 || details.level === "warning" || details.level === "error") {
      consoleErrors.push({ level: details.level, message: details.message || message || "" });
    }
  };
  window.webContents.on("console-message", onConsoleMessage);
  try {
    const captureResult = await runCaptureImpl(window, outputDir, suffix, { qaRunId });
    if (captureResult?.qaRunId !== qaRunId) {
      throw new Error("Lights QA capture returned a mismatched QA run id");
    }
    const segment = buildQaSegmentPlan({ suffix }).segments.find(({ scope }) => scope === "lights");
    const result = {
      schemaVersion: 1,
      qaRunId,
      scope: "lights",
      captures: segment.screenshots,
      consoleErrorCount: consoleErrors.length,
      completedAt: new Date().toISOString(),
    };
    await fs.writeFile(
      path.join(outputDir, "qa-segment-result.json"),
      `${JSON.stringify(result, null, 2)}\n`,
      "utf8",
    );
    return result;
  } finally {
    try {
      await fs.writeFile(
        path.join(outputDir, "runtime-console-errors.json"),
        `${JSON.stringify(consoleErrors, null, 2)}\n`,
        "utf8",
      );
    } catch (error) {
      process.stderr.write(`Unable to write Lights QA console evidence: ${error.stack || error}\n`);
    }
    window.webContents.removeListener("console-message", onConsoleMessage);
  }
}

async function openQaActiveSave(window) {
  await waitFor(window, ".start-screen");
  await click(window, ".menu-primary");
  await waitFor(window, ".save-select-screen");
  await click(window, ".save-primary-action");
  await waitFor(window, ".home-screen");
}

async function claimQaStoryAndReload(window, missionId) {
  await click(window, '[data-action="open-missions"]');
  await waitFor(window, `[data-mission-id="${missionId}"][data-mission-status="ready"]`);
  await click(window, `[data-action="claim-mission"][data-mission-action-id="${missionId}"]`);
  await waitFor(window, `[data-mission-id="${missionId}"][data-mission-status="claimed"]`);
  await click(window, '[data-action="close-missions-footer"]');
  await waitForMissing(window, '[data-testid="mission-center-modal"]');
  await window.reload();
  await openQaActiveSave(window);
  await click(window, '[data-action="open-missions"]');
  await waitFor(window, `[data-mission-id="${missionId}"][data-mission-status="claimed"]`);
}

async function runQslStoryQaScope(window, outputDir, shot, { qaRunId }) {
  await openQaActiveSave(window);
  await click(window, '[data-action="open-missions"]');
  await waitFor(window, '[data-mission-id="story-07"][data-mission-status="available"]');
  await capture(window, outputDir, shot("qsl-mission-available"));
  await click(window, '[data-action="accept-mission"][data-mission-action-id="story-07"]');
  await waitFor(window, '[data-mission-id="story-07"][data-mission-status="active"]');
  await click(window, '[data-action="launch-qsl-story"]');
  await waitFor(window, '[data-testid="qsl-story-screen"][data-qsl-story-phase="CASE_OPEN"]');
  await capture(window, outputDir, shot("qsl-accounts"));
  await click(window, '[data-action="qsl-story-review"]');
  await waitFor(window, '[data-qsl-story-phase="PLAYER_CLARIFICATION_CALL"]');
  await setInputValue(window, '.qsl-story-message input', "QSL WRONG DE WRONG PSE K");
  await click(window, '[data-action="qsl-story-submit"]');
  await waitFor(window, '.qsl-story-error');
  await capture(window, outputDir, shot("qsl-clarification-error"));
  const clarification = await window.webContents.executeJavaScript(`(() => {
    const save = JSON.parse(localStorage.getItem("game-morse-adventurer.saves.v1"))[0];
    const run = save.storyContinuationState.chapter07.activeRun;
    return "QSL " + run.caseId + " DE " + run.playerCallsign + " PSE K";
  })()`, true);
  await setInputValue(window, '.qsl-story-message input', clarification);
  await click(window, '[data-action="qsl-story-submit"]');
  await waitFor(window, '[data-qsl-story-phase="SORA_CLARIFICATION_REPLY"]');
  await capture(window, outputDir, shot("qsl-clarification-reply"));
  await click(window, '[data-action="qsl-story-receive"]');
  await waitFor(window, '[data-qsl-story-phase="PLAYER_FINAL_CHOICE"]');
  await capture(window, outputDir, shot("qsl-final-choice"));
  await click(window, '.qsl-story-choices [data-qsl-choice="request-review"]');
  await waitFor(window, '[data-qsl-story-phase="COMPLETED"]');
  await capture(window, outputDir, shot("qsl-result"));
  await click(window, '[data-action="qsl-story-settle"]');
  await waitFor(window, '[data-action="qsl-story-settle"][disabled]');
  await capture(window, outputDir, shot("qsl-settled"));
  const beforeDuplicate = await window.webContents.executeJavaScript(
    'localStorage.getItem("game-morse-adventurer.saves.v1")', true,
  );
  await click(window, '[data-action="qsl-story-settle"]');
  await delay(80);
  const afterDuplicate = await window.webContents.executeJavaScript(
    'localStorage.getItem("game-morse-adventurer.saves.v1")', true,
  );
  await click(window, '.qsl-story-topbar button');
  await waitFor(window, '.home-screen');
  await claimQaStoryAndReload(window, "story-07");
  await capture(window, outputDir, shot("qsl-reloaded"));
  const facts = await window.webContents.executeJavaScript(`(() => {
    const save = JSON.parse(localStorage.getItem("game-morse-adventurer.saves.v1"))[0];
    const record = save.storyContinuationState.chapter07.cases.at(-1);
    return {
      sourcePersonId: record.personId,
      finalChoice: record.finalChoice,
      eventQsoCount: save.qsoLogs.filter((log) => log.eventKind === "qsl-story").length,
      missionClaimed: save.missionState.claimedMissionIds.includes("story-07"),
      reloadPersisted: save.storyContinuationState.chapter07.settledRunIds.includes(record.runId),
    };
  })()`, true);
  const evidence = {
    schemaVersion: 1, qaRunId, activity: "qsl-story", settled: true,
    duplicateSettlementNoOp: beforeDuplicate === afterDuplicate, ...facts,
  };
  validateQslStoryQaEvidence(evidence, { qaRunId });
  await fs.writeFile(path.join(outputDir, "qsl-story-qa-result.json"), `${JSON.stringify(evidence, null, 2)}\n`, "utf8");
  return evidence;
}

async function serviceNetCurrentMessage(window) {
  return window.webContents.executeJavaScript(`(() => {
    const save = JSON.parse(localStorage.getItem("game-morse-adventurer.saves.v1"))[0];
    const run = save.storyContinuationState.chapter08.activeRun;
    return run.messages[run.priorityOrder[run.currentPosition]];
  })()`, true);
}

async function submitQaTextInput(window, inputSelector, actionSelector, value) {
  await setInputValue(window, inputSelector, value);
  await click(window, actionSelector);
}

async function runServiceNetQaScope(window, outputDir, shot, { qaRunId }) {
  await openQaActiveSave(window);
  await click(window, '[data-action="open-missions"]');
  await waitFor(window, '[data-mission-id="story-08"][data-mission-status="available"]');
  await capture(window, outputDir, shot("service-mission-available"));
  await click(window, '[data-action="accept-mission"][data-mission-action-id="story-08"]');
  await waitFor(window, '[data-mission-id="story-08"][data-mission-status="active"]');
  await click(window, '[data-action="launch-service-net"]');
  await waitFor(window, '[data-testid="service-net-screen"][data-service-net-phase="BRIEFING"]');
  await capture(window, outputDir, shot("service-briefing"));
  await click(window, '[data-action="service-net-begin"]');
  await waitFor(window, '[data-service-net-phase="CHECK_IN"]');
  await submitQaTextInput(window, '.service-net-message input', '[data-action="service-net-submit"]', "WRONG CHECK IN K");
  await waitFor(window, '.service-net-error');
  await capture(window, outputDir, shot("service-check-in-error"));
  const playerCallsign = await window.webContents.executeJavaScript(
    'JSON.parse(localStorage.getItem("game-morse-adventurer.saves.v1"))[0].callsign', true,
  );
  await submitQaTextInput(window, '.service-net-message input', '[data-action="service-net-submit"]', `${playerCallsign} CHECK IN K`);
  await waitFor(window, '[data-service-net-phase="RECEIVE_MESSAGE"]');
  await capture(window, outputDir, shot("service-queue"));
  await click(window, '[data-action="service-net-receive"]');
  await waitFor(window, '[data-service-net-phase="PLAYER_ACK"]');
  await capture(window, outputDir, shot("service-message"));
  await click(window, '[data-action="service-net-agn"]');
  await waitFor(window, '[data-service-net-phase="RECEIVE_MESSAGE"]');
  await capture(window, outputDir, shot("service-agn"));
  await click(window, '[data-action="service-net-receive"]');
  await waitFor(window, '[data-service-net-phase="PLAYER_ACK"]');
  const first = await serviceNetCurrentMessage(window);
  await submitQaTextInput(window, '.service-net-message input', '[data-action="service-net-submit"]', `ACK 999 PRI ${first.priority} K`);
  await waitFor(window, '.service-net-error');
  await capture(window, outputDir, shot("service-ack-error"));
  await submitQaTextInput(window, '.service-net-message input', '[data-action="service-net-submit"]', `ACK ${first.messageId} PRI ${first.priority} K`);
  for (let index = 1; index < 3; index += 1) {
    await waitFor(window, '[data-service-net-phase="RECEIVE_MESSAGE"]');
    await click(window, '[data-action="service-net-receive"]');
    await waitFor(window, '[data-service-net-phase="PLAYER_ACK"]');
    const current = await serviceNetCurrentMessage(window);
    await submitQaTextInput(window, '.service-net-message input', '[data-action="service-net-submit"]', `ACK ${current.messageId} PRI ${current.priority} K`);
  }
  await waitFor(window, '[data-service-net-phase="COMPLETED"]');
  await capture(window, outputDir, shot("service-result"));
  await click(window, '[data-action="service-net-settle"]');
  await waitFor(window, '[data-action="service-net-settle"][disabled]');
  await capture(window, outputDir, shot("service-settled"));
  const beforeDuplicate = await window.webContents.executeJavaScript('localStorage.getItem("game-morse-adventurer.saves.v1")', true);
  await click(window, '[data-action="service-net-settle"]');
  await delay(80);
  const afterDuplicate = await window.webContents.executeJavaScript('localStorage.getItem("game-morse-adventurer.saves.v1")', true);
  await click(window, '.service-net-topbar button');
  await waitFor(window, '.home-screen');
  await claimQaStoryAndReload(window, "story-08");
  await capture(window, outputDir, shot("service-reloaded"));
  const facts = await window.webContents.executeJavaScript(`(() => {
    const save = JSON.parse(localStorage.getItem("game-morse-adventurer.saves.v1"))[0];
    const chapter = save.storyContinuationState.chapter08;
    return {
      messageCount: 3,
      receiptCount: chapter.receipts.filter((receipt) => receipt.runId === chapter.settledRunIds.at(-1)).length,
      eventQsoCount: save.qsoLogs.filter((log) => log.eventKind === "service-net").length,
      missionClaimed: save.missionState.claimedMissionIds.includes("story-08"),
      reloadPersisted: chapter.settledRunIds.length === 1 && chapter.receipts.length === 3,
    };
  })()`, true);
  const evidence = { schemaVersion: 1, qaRunId, activity: "service-net", settled: true,
    duplicateSettlementNoOp: beforeDuplicate === afterDuplicate, ...facts };
  validateServiceNetQaEvidence(evidence, { qaRunId });
  await fs.writeFile(path.join(outputDir, "service-net-qa-result.json"), `${JSON.stringify(evidence, null, 2)}\n`, "utf8");
  return evidence;
}

async function runCoordinateRelayQaScope(window, outputDir, shot, { qaRunId }) {
  await openQaActiveSave(window);
  await click(window, '[data-action="open-missions"]');
  await waitFor(window, '[data-mission-id="story-09"][data-mission-status="available"]');
  await capture(window, outputDir, shot("coordinate-mission-available"));
  await click(window, '[data-action="accept-mission"][data-mission-action-id="story-09"]');
  await waitFor(window, '[data-mission-id="story-09"][data-mission-status="active"]');
  await click(window, '[data-action="launch-coordinate-relay"]');
  await waitFor(window, '[data-testid="coordinate-relay-screen"][data-coordinate-phase="BRIEFING"]');
  await capture(window, outputDir, shot("coordinate-briefing"));
  await click(window, '[data-action="coordinate-begin"]');
  await waitFor(window, '[data-coordinate-phase="RECEIVE_PACKET"]');
  await capture(window, outputDir, shot("coordinate-packet"));
  await click(window, '[data-action="coordinate-receive"]');
  await waitFor(window, '[data-coordinate-phase="PLAYER_READBACK"]');
  await submitQaTextInput(window, '.coordinate-relay-input input', '[data-action="coordinate-submit"]', "MSG 999 GRID PX-9999-9999 TIME 0000Z PEOPLE 99 CHECK 99");
  await waitFor(window, '[data-coordinate-phase="FIELD_CORRECTION"]');
  await capture(window, outputDir, shot("coordinate-readback-error"));
  await click(window, '[data-action="coordinate-receive"]');
  await waitFor(window, '[data-coordinate-phase="PLAYER_READBACK"]');
  await capture(window, outputDir, shot("coordinate-correction"));
  const packetText = await window.webContents.executeJavaScript(
    'document.querySelector(".coordinate-relay-packet code").textContent.trim()', true,
  );
  await submitQaTextInput(window, '.coordinate-relay-input input', '[data-action="coordinate-submit"]', packetText);
  await waitFor(window, '[data-coordinate-phase="RELAY_PACKET"]');
  await capture(window, outputDir, shot("coordinate-relay"));
  await submitQaTextInput(window, '.coordinate-relay-input input', '[data-action="coordinate-submit"]', packetText);
  await waitFor(window, '[data-coordinate-phase="RELAY_CONFIRMATION"]');
  await capture(window, outputDir, shot("coordinate-confirmation"));
  await click(window, '[data-action="coordinate-confirm"]');
  await waitFor(window, '[data-coordinate-phase="COMPLETED"]');
  await capture(window, outputDir, shot("coordinate-result"));
  await click(window, '[data-action="coordinate-settle"]');
  await waitFor(window, '[data-action="coordinate-settle"][disabled]');
  await capture(window, outputDir, shot("coordinate-settled"));
  const beforeDuplicate = await window.webContents.executeJavaScript('localStorage.getItem("game-morse-adventurer.saves.v1")', true);
  await click(window, '[data-action="coordinate-settle"]');
  await delay(80);
  const afterDuplicate = await window.webContents.executeJavaScript('localStorage.getItem("game-morse-adventurer.saves.v1")', true);
  await click(window, '.coordinate-relay-topbar button');
  await waitFor(window, '.home-screen');
  await claimQaStoryAndReload(window, "story-09");
  await capture(window, outputDir, shot("coordinate-reloaded"));
  const facts = await window.webContents.executeJavaScript(`(() => {
    const save = JSON.parse(localStorage.getItem("game-morse-adventurer.saves.v1"))[0];
    const chapter = save.storyContinuationState.chapter09;
    const packet = chapter.packets.at(-1);
    return {
      packetId: packet.packet.packetId,
      grid: packet.packet.grid,
      eventQsoCount: save.qsoLogs.filter((log) => log.eventKind === "coordinate-relay").length,
      missionClaimed: save.missionState.claimedMissionIds.includes("story-09"),
      reloadPersisted: chapter.settledRunIds.includes(packet.runId),
    };
  })()`, true);
  const evidence = { schemaVersion: 1, qaRunId, activity: "coordinate-relay", settled: true,
    duplicateSettlementNoOp: beforeDuplicate === afterDuplicate, ...facts };
  validateCoordinateRelayQaEvidence(evidence, { qaRunId });
  await fs.writeFile(path.join(outputDir, "coordinate-relay-qa-result.json"), `${JSON.stringify(evidence, null, 2)}\n`, "utf8");
  return evidence;
}

async function submitContestAutomatic(window, text, expectedPhase) {
  await sendAutomaticContestText(window, text, 18);
  await waitFor(window, '[data-action="contest-submit"]:not([disabled])');
  await click(window, '[data-action="contest-submit"]');
  if (expectedPhase) await waitFor(window, `[data-contest-phase="${expectedPhase}"]`, 15000);
}

async function contestCandidate(window) {
  return window.webContents.executeJavaScript(`(() => {
    const save = JSON.parse(localStorage.getItem("game-morse-adventurer.saves.v1"))[0];
    const contacts = save.storyContinuationState.chapter10.activeRun.contacts;
    const usedPeople = new Set(contacts.map(({ personId }) => personId));
    const usedRegions = new Set(contacts.map(({ regionCode }) => regionCode));
    const rendered = Array.from(document.querySelectorAll("[data-contest-candidate]"), (node) => ({
      callsign: node.dataset.contestCandidate,
      regionCode: node.querySelector("span")?.textContent.trim() ?? "",
    }));
    return rendered.find((candidate) => !usedRegions.has(candidate.regionCode))
      ?? rendered.find((candidate) => !usedPeople.has(candidate.personId))
      ?? rendered[0] ?? null;
  })()`, true);
}

async function completeContestContact(window, mode, { requestRepeat = false } = {}) {
  const phase = await window.webContents.executeJavaScript('document.querySelector(".contest-screen").dataset.contestPhase', true);
  if (phase === "MODE_SELECT") {
    await click(window, `[data-action="contest-mode-${mode.toLowerCase()}"]`);
    await waitFor(window, `[data-contest-phase="${mode === "RUN" ? "RUN_PILEUP" : "SP_POOL"}"]`);
  }
  const candidate = await contestCandidate(window);
  if (!candidate?.callsign) throw new Error(`Contest QA has no ${mode} candidate`);
  await submitContestAutomatic(window, candidate.callsign, "EXCHANGE");
  if (requestRepeat) {
    const repeatsBefore = await window.webContents.executeJavaScript(`JSON.parse(localStorage.getItem("game-morse-adventurer.saves.v1"))[0].storyContinuationState.chapter10.activeRun.repeatRequests`, true);
    await click(window, '[data-action="contest-agn"]');
    await window.webContents.executeJavaScript(`new Promise((resolve, reject) => {
      const started = Date.now();
      const timer = setInterval(() => {
        const run = JSON.parse(localStorage.getItem("game-morse-adventurer.saves.v1"))[0].storyContinuationState.chapter10.activeRun;
        if (run.repeatRequests > ${repeatsBefore}) { clearInterval(timer); resolve(true); }
        else if (Date.now() - started > 10000) { clearInterval(timer); reject(new Error("Contest AGN did not persist")); }
      }, 40);
    })`, true);
  }
  const exchange = await window.webContents.executeJavaScript('document.querySelector(".contest-exchange code").textContent.trim()', true);
  await submitContestAutomatic(window, exchange, "MODE_SELECT");
  return candidate;
}

async function runContestQaScope(window, outputDir, shot, { qaRunId }) {
  await openQaActiveSave(window);
  await click(window, '[data-action="open-missions"]');
  await waitFor(window, '[data-mission-id="story-10"][data-mission-status="available"]');
  await capture(window, outputDir, shot("contest-mission-available"));
  await click(window, '[data-action="accept-mission"][data-mission-action-id="story-10"]');
  await waitFor(window, '[data-mission-id="story-10"][data-mission-status="active"]');
  await click(window, '[data-action="launch-contest"]');
  await waitFor(window, '[data-testid="contest-screen"][data-contest-phase="BRIEFING"]');
  await capture(window, outputDir, shot("contest-briefing"));
  await click(window, '[data-action="contest-mode-run"]');
  await waitFor(window, '[data-contest-phase="RUN_PILEUP"]');
  await capture(window, outputDir, shot("contest-run-pileup"));
  await submitContestAutomatic(window, "RST", "RUN_PILEUP");
  await waitFor(window, '.contest-error');
  await capture(window, outputDir, shot("contest-interruption"));
  await completeContestContact(window, "RUN");
  await capture(window, outputDir, shot("contest-run-contact"));
  await completeContestContact(window, "RUN");
  await completeContestContact(window, "RUN");
  await click(window, '[data-action="contest-mode-sp"]');
  await waitFor(window, '[data-contest-phase="SP_POOL"]');
  await capture(window, outputDir, shot("contest-sp-pool"));
  await submitContestAutomatic(window, "ZZ9ZZ", "SP_POOL");
  await waitFor(window, '.contest-error');
  await capture(window, outputDir, shot("contest-busted-call"));
  await completeContestContact(window, "SP", { requestRepeat: true });
  await capture(window, outputDir, shot("contest-agn"));
  await completeContestContact(window, "SP");
  await completeContestContact(window, "SP");
  await waitFor(window, '[data-contest-phase="MODE_SELECT"] [data-action="contest-finish"]');
  await capture(window, outputDir, shot("contest-score-ready"));
  await click(window, '[data-action="contest-finish"]');
  await waitFor(window, '[data-contest-phase="COMPLETED"]');
  await capture(window, outputDir, shot("contest-result"));
  await click(window, '[data-action="contest-settle"]');
  await waitFor(window, '[data-action="contest-settle"][disabled]', 15000);
  await capture(window, outputDir, shot("contest-settled"));
  const beforeDuplicate = await window.webContents.executeJavaScript('localStorage.getItem("game-morse-adventurer.saves.v1")', true);
  await click(window, '[data-action="contest-settle"]');
  await delay(80);
  const afterDuplicate = await window.webContents.executeJavaScript('localStorage.getItem("game-morse-adventurer.saves.v1")', true);
  await click(window, '.contest-topbar button');
  await waitFor(window, '.home-screen');
  await claimQaStoryAndReload(window, "story-10");
  await capture(window, outputDir, shot("contest-reloaded"));
  const facts = await window.webContents.executeJavaScript(`(() => {
    const save = JSON.parse(localStorage.getItem("game-morse-adventurer.saves.v1"))[0];
    const chapter = save.storyContinuationState.chapter10;
    const record = chapter.records.at(-1);
    return {
      validContacts: record.validContacts, runContacts: record.runContacts, spContacts: record.spContacts,
      uniqueRegions: record.uniqueRegions, grade: record.grade,
      eventQsoCount: save.qsoLogs.filter((log) => log.eventKind === "contest" && log.eventRunId === record.runId).length,
      missionClaimed: save.missionState.claimedMissionIds.includes("story-10"),
      reloadPersisted: chapter.settledRunIds.includes(record.runId) && chapter.taskTreeUnlocked === true,
    };
  })()`, true);
  const evidence = { schemaVersion: 1, qaRunId, activity: "contest", settled: true,
    duplicateSettlementNoOp: beforeDuplicate === afterDuplicate, ...facts };
  validateContestQaEvidence(evidence, { qaRunId });
  await fs.writeFile(path.join(outputDir, "contest-qa-result.json"), `${JSON.stringify(evidence, null, 2)}\n`, "utf8");
  return evidence;
}

async function runQaCapture(window) {
  const outputDir = process.env.CWGAME_QA_OUTPUT || path.join(process.cwd(), "qa-artifacts");
  const qaRunId = process.env.CWGAME_QA_RUN_ID;
  validateQaRunId(qaRunId);
  const [captureWidth, captureHeight] = window.getContentSize();
  const suffix = process.env.CWGAME_QA_SUFFIX || `${captureWidth}x${captureHeight}`;
  const scope = process.env.CWGAME_QA_SCOPE || "full";
  if (scope === "station-entry") return runStationEntryProbe(window);
  if (!QA_SUPPORTED_SCOPES.includes(scope)) {
    throw new Error(`Unsupported packaged QA scope: ${scope}`);
  }
  const shot = (stem) => `${stem}-${suffix}.png`;
  const manualCaptures = [];
  const languageCaptures = [];
  await fs.mkdir(outputDir, { recursive: true });
  await fs.rm(path.join(outputDir, "qa-failure.txt"), { force: true });
  const consoleErrors = [];
  const onConsoleMessage = (_event, levelOrDetails, message) => {
    const details = typeof levelOrDetails === "object" ? levelOrDetails : { level: levelOrDetails, message };
    if (details.level === 2 || details.level === 3 || details.level === "warning" || details.level === "error") {
      consoleErrors.push({ level: details.level, message: details.message || message || "" });
    }
  };
  window.webContents.on("console-message", onConsoleMessage);
  const finishScope = (facts = {}) => writeQaSegmentResult(window, {
    outputDir,
    stateOutFile: process.env.CWGAME_QA_STATE_OUT || path.join(outputDir, "qa-state-out.json"),
    qaRunId,
    scope,
    suffix,
    consoleErrors,
    facts,
  });
  let wrongPracticeTarget = null;
  try {
    if (scope !== "full" && scope !== "bootstrap") {
      const stateInFile = process.env.CWGAME_QA_STATE_IN;
      if (!stateInFile) throw new Error(`${scope} requires CWGAME_QA_STATE_IN`);
      const stateIn = JSON.parse(await fs.readFile(stateInFile, "utf8"));
      await importQaStateIntoRenderer(window, stateIn, { consumerScope: scope, qaRunId });
      wrongPracticeTarget = stateIn.facts?.practiceWrongTarget ?? null;
      await waitFor(window, ".start-screen");
    }

    if (scope === "full" || scope === "bootstrap") {
      await window.webContents.session.clearStorageData();
      await window.reload();
      await waitFor(window, ".start-screen");
      await capture(window, outputDir, shot("start"));
  const buildTag = await window.webContents.executeJavaScript(
    'document.querySelector(".build-tag")?.textContent.trim() ?? ""',
    true,
  );
  if (!buildTag.includes("v0.40.0")) throw new Error(`Unexpected title build tag: ${buildTag}`);

  const supportedLanguageIds = ["zh-CN", "zh-TW", "ja", "en", "es", "de", "ru"];
  const languageStorageKey = "game-morse-adventurer.language.v1";
  async function openStartLanguageMenu() {
    const open = await window.webContents.executeJavaScript('Boolean(document.querySelector(".start-language .language-menu"))', true);
    if (!open) await click(window, ".start-language .language-globe");
    await waitFor(window, ".start-language .language-menu");
  }
  async function readStartLanguageState() {
    return window.webContents.executeJavaScript(`(() => ({
      language: document.documentElement.lang,
      subtitle: document.querySelector(".title-lockup p")?.textContent.trim() ?? "",
      actions: Array.from(document.querySelectorAll(".start-actions button"), (button) => button.textContent.trim()),
      disclaimer: document.querySelector(".callsign-disclaimer")?.textContent.trim() ?? "",
      languageLabel: document.querySelector(".start-language .language-globe")?.getAttribute("aria-label")?.trim() ?? "",
      storedLanguage: localStorage.getItem(${JSON.stringify(languageStorageKey)}),
    }))()`, true);
  }
  async function selectStartLanguage(languageId) {
    await openStartLanguageMenu();
    await click(window, `.start-language [data-language-id="${languageId}"]`);
    await waitForMissing(window, ".start-language .language-menu");
    await delay(80);
    const state = await readStartLanguageState();
    if (state.language !== languageId || state.storedLanguage !== languageId) throw new Error(`Start language ${languageId} did not apply and persist: ${JSON.stringify(state)}`);
    const criticalText = [state.subtitle, ...state.actions, state.disclaimer, state.languageLabel];
    if (state.actions.length !== 4 || criticalText.some((value) => !value || /undefined|null|\ufffd/i.test(value))) throw new Error(`Start language ${languageId} has missing critical copy: ${JSON.stringify(state)}`);
    return state;
  }
  await openStartLanguageMenu();
  const startLanguageIds = await window.webContents.executeJavaScript('Array.from(document.querySelectorAll(".start-language [data-language-id]"), (button) => button.dataset.languageId)', true);
  if (JSON.stringify(startLanguageIds) !== JSON.stringify(supportedLanguageIds)) throw new Error(`Start menu languages are incomplete or out of order: ${JSON.stringify(startLanguageIds)}`);
  await capture(window, outputDir, shot("language-start-seven"));
  languageCaptures.push(shot("language-start-seven"));
  const startCopyByLanguage = {};
  for (const languageId of supportedLanguageIds) startCopyByLanguage[languageId] = await selectStartLanguage(languageId);
  for (const languageId of ["es", "de", "ru"]) {
    if (startCopyByLanguage[languageId].actions[0] === startCopyByLanguage.en.actions[0] || startCopyByLanguage[languageId].disclaimer === startCopyByLanguage.en.disclaimer) throw new Error(`Start language ${languageId} silently fell back to English: ${JSON.stringify(startCopyByLanguage[languageId])}`);
  }
  await selectStartLanguage("en");
  async function applySettingsLanguage(languageId) {
    await click(window, ".start-actions button:nth-child(3)");
    await waitFor(window, ".settings-modal");
    const settingsLanguageIds = await window.webContents.executeJavaScript('Array.from(document.querySelectorAll(".settings-modal [data-language-id]"), (button) => button.dataset.languageId)', true);
    if (JSON.stringify(settingsLanguageIds) !== JSON.stringify(supportedLanguageIds)) throw new Error(`Settings menu languages are incomplete or out of order: ${JSON.stringify(settingsLanguageIds)}`);
    await click(window, `.settings-modal [data-language-id="${languageId}"]`);
    const draftState = await window.webContents.executeJavaScript(`(() => ({
      selected: document.querySelector(${JSON.stringify(`.settings-modal [data-language-id="${languageId}"]`)})?.classList.contains("selected") ?? false,
      applyText: document.querySelector(".settings-modal footer .primary-button")?.textContent.trim() ?? "",
      modalText: document.querySelector(".settings-modal")?.textContent.trim() ?? "",
    }))()`, true);
    if (!draftState.selected || !draftState.applyText || !draftState.modalText || /undefined|null|\ufffd/i.test(draftState.modalText)) throw new Error(`Settings language ${languageId} has incomplete draft copy: ${JSON.stringify(draftState)}`);
    await click(window, ".settings-modal footer .primary-button");
    await waitForMissing(window, ".settings-modal");
    const appliedState = await readStartLanguageState();
    if (appliedState.language !== languageId || appliedState.storedLanguage !== languageId) throw new Error(`Settings language ${languageId} did not apply and persist: ${JSON.stringify(appliedState)}`);
    return appliedState;
  }
  await applySettingsLanguage("ru");
  await click(window, ".start-actions button:nth-child(3)");
  await waitFor(window, ".settings-modal");
  await capture(window, outputDir, shot("language-settings-russian"));
  languageCaptures.push(shot("language-settings-russian"));
  await click(window, '.settings-modal [data-language-id="de"]');
  await click(window, ".settings-modal footer .primary-button");
  await waitForMissing(window, ".settings-modal");
  const germanState = await readStartLanguageState();
  if (germanState.language !== "de" || germanState.storedLanguage !== "de") throw new Error(`Settings language de did not apply and persist: ${JSON.stringify(germanState)}`);
  const spanishState = await applySettingsLanguage("es");
  await window.reload();
  await waitFor(window, ".start-screen");
  const reloadedLanguageState = await readStartLanguageState();
  if (reloadedLanguageState.language !== "es" || reloadedLanguageState.storedLanguage !== "es" || JSON.stringify(reloadedLanguageState.actions) !== JSON.stringify(spanishState.actions) || reloadedLanguageState.disclaimer !== spanishState.disclaimer) throw new Error(`Spanish language preference did not survive reload: ${JSON.stringify({ spanishState, reloadedLanguageState })}`);
  await capture(window, outputDir, shot("language-reload-spanish"));
  languageCaptures.push(shot("language-reload-spanish"));
  const restoredEnglishState = await selectStartLanguage("en");
  if (restoredEnglishState.storedLanguage !== "en") throw new Error(`English QA reset did not persist: ${JSON.stringify(restoredEnglishState)}`);

  async function readManualState(label) {
    const state = await window.webContents.executeJavaScript(`(() => {
      const modal = document.querySelector('[data-testid="station-manual-modal"]');
      return {
        label: ${JSON.stringify(label)},
        text: modal?.textContent.trim() ?? "",
        page: Number(modal?.dataset.manualPageNumber),
        total: Number(modal?.dataset.manualPageTotal),
        chapters: modal?.querySelectorAll("[data-manual-chapter]").length ?? 0,
        pageTitle: modal?.querySelector(".station-manual-page h3")?.textContent.trim() ?? "",
      };
    })()`, true);
    if (!state.text || !state.pageTitle || state.page !== 1 || state.total !== 4 || state.chapters !== 4) {
      throw new Error(`Station Manual ${label} state is incomplete: ${JSON.stringify(state)}`);
    }
    return state;
  }

  await click(window, ".start-actions button:nth-child(4)");
  await waitFor(window, '[data-testid="station-manual-modal"]');
  const firstManualState = await readManualState("initial open");
  await capture(window, outputDir, shot("station-manual-page-1"));
  manualCaptures.push(shot("station-manual-page-1"));

  const languageUpdateState = await window.webContents.executeJavaScript(`(async () => {
    const beforeLanguage = document.documentElement.lang;
    const beforeText = document.querySelector('[data-testid="station-manual-modal"]')?.textContent.trim() ?? "";
    document.querySelector(".start-language .language-globe")?.click();
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    const menuItems = Array.from(document.querySelectorAll(".start-language .language-menu button"));
    const targetIndex = beforeLanguage === "en" ? 2 : 3;
    menuItems[targetIndex]?.click();
    return new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve({
      beforeLanguage,
      afterLanguage: document.documentElement.lang,
      beforeText,
      afterText: document.querySelector('[data-testid="station-manual-modal"]')?.textContent.trim() ?? "",
    }))));
  })()`, true);
  if (languageUpdateState.beforeLanguage === languageUpdateState.afterLanguage
    || languageUpdateState.beforeText === languageUpdateState.afterText) {
    throw new Error(`Open Station Manual did not update with language: ${JSON.stringify(languageUpdateState)}`);
  }
  await capture(window, outputDir, shot("station-manual-language-updated"));
  manualCaptures.push(shot("station-manual-language-updated"));

  await window.webContents.executeJavaScript(`window.dispatchEvent(new KeyboardEvent("keydown", {
    key: "ArrowRight", code: "ArrowRight", bubbles: true, cancelable: true,
  }))`, true);
  await delay(80);
  let keyboardPage = await window.webContents.executeJavaScript(
    'Number(document.querySelector(\'[data-testid="station-manual-modal"]\')?.dataset.manualPageNumber)',
    true,
  );
  if (keyboardPage !== 2) throw new Error(`ArrowRight navigation landed on page ${keyboardPage}`);
  await window.webContents.executeJavaScript(`window.dispatchEvent(new KeyboardEvent("keydown", {
    key: "ArrowLeft", code: "ArrowLeft", bubbles: true, cancelable: true,
  }))`, true);
  await delay(80);
  keyboardPage = await window.webContents.executeJavaScript(
    'Number(document.querySelector(\'[data-testid="station-manual-modal"]\')?.dataset.manualPageNumber)',
    true,
  );
  if (keyboardPage !== 1) throw new Error(`ArrowLeft navigation landed on page ${keyboardPage}`);

  let manualPage = 1;
  let previousManualText = languageUpdateState.afterText;
  for (; manualPage < 8; manualPage += 1) {
    const navigation = await window.webContents.executeJavaScript(`(() => {
      const modal = document.querySelector('[data-testid="station-manual-modal"]');
      const next = modal?.querySelector('[data-action="manual-next"]');
      if (!next || next.disabled) return { advanced: false };
      next.click();
      return new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve({
        advanced: true,
        text: document.querySelector('[data-testid="station-manual-modal"]')?.textContent.trim() ?? "",
      }))));
    })()`, true);
    if (!navigation.advanced) break;
    if (!navigation.text || navigation.text === previousManualText) {
      throw new Error(`Station Manual page ${manualPage + 1} did not change content`);
    }
    previousManualText = navigation.text;
    const captureName = shot(`station-manual-page-${manualPage + 1}`);
    await capture(window, outputDir, captureName);
    manualCaptures.push(captureName);
  }
  if (manualPage !== firstManualState.total) {
    throw new Error(`Station Manual exposed ${manualPage} of ${firstManualState.total} pages`);
  }
  await click(window, '[data-testid="station-manual-modal"] [data-action="manual-prev"]');
  const previousPageNumber = await window.webContents.executeJavaScript(
    'Number(document.querySelector(\'[data-testid="station-manual-modal"]\')?.dataset.manualPageNumber)',
    true,
  );
  if (previousPageNumber !== firstManualState.total - 1) {
    throw new Error(`Station Manual previous navigation landed on page ${previousPageNumber}`);
  }
  await window.webContents.executeJavaScript(`window.dispatchEvent(new KeyboardEvent("keydown", {
    key: "Escape", code: "Escape", bubbles: true, cancelable: true,
  }))`, true);
  await waitForMissing(window, '[data-testid="station-manual-modal"]');

  await click(window, ".start-actions button:nth-child(4)");
  await waitFor(window, '[data-testid="station-manual-modal"]');
  await readManualState("backdrop-close open");
  await window.webContents.executeJavaScript(`(() => {
    const backdrop = document.querySelector('[data-testid="station-manual-backdrop"]');
    if (!backdrop) throw new Error("Missing Station Manual backdrop");
    backdrop.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true, view: window }));
  })()`, true);
  await waitForMissing(window, '[data-testid="station-manual-modal"]');

  await click(window, ".start-actions button:nth-child(4)");
  await waitFor(window, '[data-testid="station-manual-modal"]');
  await readManualState("close-button open");
  await click(window, '[data-testid="station-manual-modal"] [data-action="close-station-manual"]');
  await waitForMissing(window, '[data-testid="station-manual-modal"]');

  await click(window, ".start-actions button:nth-child(2)");
  await waitFor(window, ".practice-screen");
  await waitFor(window, '.practice-screen[data-practice-recording="session"][data-practice-difficulty="guided"][data-practice-lesson="1"][data-practice-lessons-completed="0"]');
  const sessionOnlyPracticeState = await window.webContents.executeJavaScript(`(() => ({
    recording: document.querySelector(".practice-screen")?.dataset.practiceRecording ?? null,
    difficulty: document.querySelector(".practice-screen")?.dataset.practiceDifficulty ?? null,
    lesson: Number(document.querySelector(".practice-screen")?.dataset.practiceLesson),
    completedLessons: Number(document.querySelector(".practice-screen")?.dataset.practiceLessonsCompleted),
    statusClass: document.querySelector(".practice-recording-status")?.className ?? "",
    statusText: document.querySelector(".practice-recording-status")?.textContent.trim() ?? "",
    saveCount: JSON.parse(localStorage.getItem("game-morse-adventurer.saves.v1") || "[]").length,
  }))()`, true);
  if (sessionOnlyPracticeState.recording !== "session"
    || sessionOnlyPracticeState.difficulty !== "guided"
    || sessionOnlyPracticeState.lesson !== 1
    || sessionOnlyPracticeState.completedLessons !== 0
    || !sessionOnlyPracticeState.statusClass.includes("session-only")
    || !sessionOnlyPracticeState.statusText
    || sessionOnlyPracticeState.saveCount !== 0) {
    throw new Error(`No-save practice was not explicitly session-only: ${JSON.stringify(sessionOnlyPracticeState)}`);
  }
  await click(window, '[data-practice-mode-option="callsign-rx"]');
  await click(window, '[data-callsign-region-option="japan"]');
  await waitFor(window, '.practice-screen[data-practice-recording="session"][data-practice-callsign-region="japan"]');
  await click(window, '[data-practice-mode-option="character-rx"]');
  await click(window, '[data-practice-mode-option="callsign-rx"]');
  const sessionOnlyRegionState = await window.webContents.executeJavaScript(`(() => ({
    region: document.querySelector(".practice-screen")?.dataset.practiceCallsignRegion ?? null,
    lessonPool: document.querySelector(".practice-screen")?.dataset.practiceLessonPool ?? "",
    saveCount: JSON.parse(localStorage.getItem("game-morse-adventurer.saves.v1") || "[]").length,
    checked: document.querySelector('[data-callsign-region-option="japan"]')?.getAttribute("aria-checked") ?? null,
  }))()`, true);
  if (sessionOnlyRegionState.region !== "japan"
    || sessionOnlyRegionState.lessonPool !== "SIM1JA,SIM2TK"
    || sessionOnlyRegionState.saveCount !== 0
    || sessionOnlyRegionState.checked !== "true") {
    throw new Error(`No-save callsign region preference was not session-only: ${JSON.stringify(sessionOnlyRegionState)}`);
  }
  await capture(window, outputDir, shot("practice-session-only"));
  await click(window, ".practice-sidebar nav button:nth-of-type(4)");
  await assertHeldAutomaticKey(window, { code: "KeyZ", key: "z", holdMs: 520, minimumPulses: 3 });
  await assertHeldAutomaticKey(window, { code: "KeyX", key: "x", holdMs: 620, minimumPulses: 2 });
  await click(window, ".practice-topbar .top-actions button:first-child");
  await waitFor(window, ".start-screen");

  await click(window, ".menu-primary");
  await waitFor(window, ".save-select-screen");
  await window.webContents.executeJavaScript(`(() => {
    const input = document.querySelector(".callsign-field input");
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
    setter.call(input, "bh-1abcxyz");
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
    document.querySelectorAll(".location-picker button")[1].click();
  })()`, true);
  await capture(window, outputDir, shot("save-create"));

  await click(window, ".save-primary-action");
  await waitFor(window, ".home-screen");
  await capture(window, outputDir, shot("home"));
  await window.webContents.executeJavaScript(`window.dispatchEvent(new KeyboardEvent("keydown", {
    key: "Escape", code: "Escape", bubbles: true, cancelable: true,
  }))`, true);
  await waitFor(window, ".settings-modal");
  const escapeMenuState = await window.webContents.executeJavaScript(`(() => ({
    modalCount: document.querySelectorAll('[role="dialog"][aria-modal="true"]').length,
    title: document.querySelector("#settings-title")?.textContent.trim() ?? "",
  }))()`, true);
  if (escapeMenuState.modalCount !== 1 || !escapeMenuState.title) throw new Error(`Escape did not open one game menu: ${JSON.stringify(escapeMenuState)}`);
  await capture(window, outputDir, shot("home-escape-menu"));
  await window.webContents.executeJavaScript(`window.dispatchEvent(new KeyboardEvent("keydown", {
    key: "Escape", code: "Escape", bubbles: true, cancelable: true,
  }))`, true);
  await waitForMissing(window, ".settings-modal");
  await capture(window, outputDir, shot("home-motion-a"));
  await new Promise((resolve) => setTimeout(resolve, 1400));
  await capture(window, outputDir, shot("home-motion-b"));
  await clearHover(window);
  await click(window, '[data-action="open-missions"]');
  await waitFor(window, '[data-testid="mission-center-modal"]');
  const initialMissionState = await window.webContents.executeJavaScript(`(() => ({
    storyCount: document.querySelectorAll('.mission-card[data-mission-id^="story-"]').length,
    available: document.querySelector('[data-mission-id="story-01"]')?.dataset.missionStatus ?? null,
    locked: Array.from(document.querySelectorAll('.mission-card[data-mission-status="locked"]'), (node) => node.dataset.missionId),
    chapterFourNarrative: document.querySelector('[data-mission-id="story-04"] [data-mission-narrative]')?.dataset.missionNarrative ?? null,
    chapterFourClues: Array.from(document.querySelectorAll('[data-mission-id="story-04"] [data-contract-clue]'), (node) => node.dataset.contractClue),
    chapterFourRelationshipStats: document.querySelectorAll('[data-mission-id="story-04"] [data-relationship-stat]').length,
  }))()`, true);
  if (initialMissionState.storyCount !== QA_INITIAL_STORY_MISSION_IDS.length || initialMissionState.available !== "available"
    || JSON.stringify(initialMissionState.locked) !== JSON.stringify(QA_INITIAL_STORY_MISSION_IDS.slice(1))
    || initialMissionState.chapterFourNarrative !== "brief"
    || JSON.stringify(initialMissionState.chapterFourClues) !== JSON.stringify(["propagation", "topics", "recovery"])
    || initialMissionState.chapterFourRelationshipStats !== 2) {
    throw new Error(`Unexpected initial mission board: ${JSON.stringify(initialMissionState)}`);
  }
  await capture(window, outputDir, shot("mission-story-initial"));
  await click(window, '[data-action="accept-mission"][data-mission-action-id="story-01"]');
  await waitFor(window, '[data-mission-id="story-01"][data-mission-status="active"]');
  const acceptedMissionState = await window.webContents.executeJavaScript(`(() => {
    const save = JSON.parse(localStorage.getItem("game-morse-adventurer.saves.v1"))[0];
    return {
      version: save.missionStateVersion,
      active: save.missionState?.activeMissions?.map(({ id }) => id) ?? [],
      claimed: save.missionState?.claimedMissionIds ?? [],
    };
  })()`, true);
  if (acceptedMissionState.version !== 2
    || JSON.stringify(acceptedMissionState.active) !== JSON.stringify(["story-01"])
    || acceptedMissionState.claimed.length !== 0) {
    throw new Error(`Mission acceptance did not persist atomically: ${JSON.stringify(acceptedMissionState)}`);
  }
  await capture(window, outputDir, shot("mission-story-active"));
  await click(window, '[data-mission-tab="daily"]');
  await waitFor(window, '.mission-card[data-mission-id^="daily:"]');
  const dailyMissionCount = await window.webContents.executeJavaScript('document.querySelectorAll(\'.mission-card[data-mission-id^="daily:"]\').length', true);
  if (dailyMissionCount !== 3) throw new Error(`Expected three deterministic daily missions, received ${dailyMissionCount}`);
  await capture(window, outputDir, shot("mission-daily"));
  await click(window, '[data-action="close-missions-footer"]');
  await waitForMissing(window, '[data-testid="mission-center-modal"]');
  await assertHoverTint(window, ".hotspot-store");
  await capture(window, outputDir, shot("home-hover-store"));
  await click(window, ".hotspot-store");
  await waitFor(window, '[data-testid="store-modal"]');
  await capture(window, outputDir, shot("store-antenna"));
  await click(window, '[data-store-category="radio"]');
  await capture(window, outputDir, shot("store-radio"));
  await click(window, '[data-store-category="accessories"]');
  await waitFor(window, '[data-store-item-id="cw-filter-500"][data-store-item-state="research"]');
  await capture(window, outputDir, shot("store-accessory-research"));
      await click(window, '[data-action="close-store"]');
      await waitFor(window, ".home-screen");
      await clearHover(window);
    }
    if (scope === "bootstrap") return finishScope();

    if (scope === "inventory") {
      await click(window, ".menu-primary");
      await waitFor(window, ".save-select-screen");
      await click(window, ".save-primary-action");
      await waitFor(window, ".home-screen");
    }
    if (scope === "full" || scope === "inventory") {
  await hover(window, ".hotspot-warehouse");
  await capture(window, outputDir, shot("home-hover-warehouse"));
  await click(window, ".hotspot-warehouse");
  await waitFor(window, ".warehouse-screen");
  await click(window, '[data-action="open-technology-tree"]');
  await waitFor(window, '[data-testid="technology-tree"]');
  const initialTechnologyState = await window.webContents.executeJavaScript(`(() => ({
    points: document.querySelector(".technology-point-balance strong")?.textContent.trim(),
    projects: document.querySelectorAll(".research-project-list li").length,
    nodes: document.querySelectorAll(".technology-node").length,
  }))()`, true);
  if (initialTechnologyState.points !== "0" || initialTechnologyState.projects !== 14 || initialTechnologyState.nodes !== 28) {
    throw new Error(`Unexpected initial technology tree: ${JSON.stringify(initialTechnologyState)}`);
  }
  await capture(window, outputDir, shot("technology-tree-initial"));
  await click(window, ".technology-tree-footer button");
  await waitFor(window, ".warehouse-screen");
  await click(window, ".warehouse-category-rail button:nth-of-type(2)");
  await click(window, ".warehouse-category-rail button:nth-of-type(1)");
  // The hidden QA window can return the previous compositor frame on its first capture.
  await capture(window, outputDir, shot("warehouse-radio-warmup"));
  await capture(window, outputDir, shot("warehouse-radio"));
  await click(window, ".warehouse-category-rail button:nth-of-type(3)");
  await capture(window, outputDir, shot("warehouse-accessories"));
  await click(window, ".warehouse-category-rail button:nth-of-type(2)");
  await click(window, '[data-antenna-id="none"]');
  await capture(window, outputDir, shot("warehouse-antenna-selected"));
  await click(window, ".rack-equip-button");
  await capture(window, outputDir, shot("warehouse-antenna-equipped"));
  // Restore the starter dipole so the later RF/QSO smoke flow remains operable.
  await click(window, '[data-antenna-id="dipole"]');
  await click(window, ".rack-equip-button");
  await click(window, ".warehouse-return");
  await waitFor(window, ".home-screen");
  await clearHover(window);
  await hover(window, ".hotspot-achievements");
  await capture(window, outputDir, shot("home-hover-achievements"));
  await click(window, ".hotspot-achievements");
  await waitFor(window, '[data-testid="achievements-modal"]');
  const emptyAchievementState = await window.webContents.executeJavaScript(`(() => ({
    total: document.querySelectorAll(".achievement-card").length,
    unlocked: document.querySelectorAll('.achievement-card[data-achievement-state="unlocked"]').length,
    callsign: document.querySelector(".achievements-summary strong")?.textContent.trim() ?? null,
    savedCallsign: JSON.parse(localStorage.getItem("game-morse-adventurer.saves.v1"))[0].callsign,
  }))()`, true);
  if (emptyAchievementState.total !== 16 || emptyAchievementState.unlocked !== 0
    || emptyAchievementState.callsign !== emptyAchievementState.savedCallsign) {
    throw new Error(`Unexpected empty achievement state: ${JSON.stringify(emptyAchievementState)}`);
  }
  await capture(window, outputDir, shot("achievements-empty"));
  await click(window, '[data-action="close-achievements-footer"]');
  await waitForMissing(window, '[data-testid="achievements-modal"]');
  await click(window, ".hotspot-log");
  await waitFor(window, ".qso-log-modal");
  await capture(window, outputDir, shot("home-log-empty-warmup"));
  await capture(window, outputDir, shot("home-log-empty"));
  await click(window, ".qso-log-return");
  await window.webContents.executeJavaScript(`(() => {
    const key = "game-morse-adventurer.saves.v1";
    const saves = JSON.parse(localStorage.getItem(key) || "[]");
    const save = saves[0];
    save.keyType = "automatic";
    save.money = 2000;
    save.technologyPoints = 0;
    save.unlockedTechnologies = ["station-basics", "rf-circuits", "frequency-synthesis", "multiband-qrp", "feedline-matching", "vertical-aerials", "directional-arrays", "receiver-audio", "narrowband-filtering"];
    // Keep every pre-QSO reward claimed except qso-5 so this smoke run can
    // verify one deterministic paid unlock without earlier store rewards.
    save.claimedAchievementRewards = [
      "first-qso", "qso-10", "dx-5000", "weak-signal", "regions-3", "independent-watch", "radio-upgrade", "antenna-upgrade", "first-accessory", "first-name",
    ];
    save.completedResearchProjects = ["first-contact", "reliable-operator"];
    const activeStory = save.missionState?.activeMissions?.find(({ id }) => id === "story-01");
    if (activeStory) activeStory.acceptedAt = "2026-07-14T00:00:00.000Z";
    save.qsoLogs = [
      { version: 1, id: "SIM9AK-qa-2", startedAt: "2026-07-15T03:06:00.000Z", completedAt: "2026-07-15T03:12:00.000Z", playerCallsign: save.callsign, callsign: "SIM9AK", frequencyMhz: 21.06, mode: "CW", sent: "559", received: "579", location: "EU-W", npcLatitude: 51.51, npcLongitude: -0.13, distanceKm: 9568.2, basePropagationLevel: 2, finalPropagationLevel: 3, propagationSource: "OFFLINE_DEFAULT", equipmentId: "squid-01", antennaId: save.antennaId, playerLocationId: save.locationId, wpm: 19, copyAccuracy: 94, keyingScore: 91, credits: 100, isFictional: true },
      { version: 1, id: "SIM6JP-qa-1", startedAt: "2026-07-14T22:00:00.000Z", completedAt: "2026-07-14T22:05:00.000Z", playerCallsign: save.callsign, callsign: "SIM6JP", frequencyMhz: 21.06, mode: "CW", sent: "579", received: "599", location: "AS-JA", npcLatitude: 35.68, npcLongitude: 139.76, distanceKm: 162.4, basePropagationLevel: 3, finalPropagationLevel: 4, propagationSource: "OFFLINE_DEFAULT", equipmentId: "squid-01", antennaId: "dipole", playerLocationId: save.locationId, wpm: 18, copyAccuracy: 98, keyingScore: 96, credits: 100, isFictional: true }
    ];
    save.qsoRecords = {
      total: 4,
      longestDistanceKm: 9568.2,
      longestQsoId: "SIM9AK-qa-2",
      contactedRegions: ["AS-JA", "EU-W"],
      weakSignalQsos: 0,
      settledQsoIds: ["SIM6JP-qa-1", "SIM9AK-qa-2"],
    };
    localStorage.setItem(key, JSON.stringify(saves));
  })()`, true);
  await window.reload();
  await waitFor(window, ".start-screen");
  await click(window, ".menu-primary");
  await waitFor(window, ".qsl-slot.occupied");
      await capture(window, outputDir, shot("save-loaded"));
    }
    if (scope === "inventory") return finishScope();

    if (scope === "equipment") {
      await click(window, ".menu-primary");
      await waitFor(window, ".save-select-screen");
    }
    if (scope === "full" || scope === "equipment") {
  await click(window, ".save-primary-action");
  await waitFor(window, ".home-screen");
  await click(window, '[data-action="open-missions"]');
  await waitFor(window, '[data-mission-id="story-01"][data-mission-status="ready"]');
  await waitFor(window, '[data-mission-id="story-01"] [data-mission-narrative="debrief"]');
  await capture(window, outputDir, shot("mission-story-ready"));
  await click(window, '[data-action="close-missions-footer"]');
  await waitForMissing(window, '[data-testid="mission-center-modal"]');

  await click(window, ".hotspot-store");
  await waitFor(window, '[data-testid="store-modal"]');
  await click(window, '[data-store-category="accessories"]');
  await waitFor(window, '[data-store-item-id="cw-filter-500"][data-store-item-state="available"]');
  await click(window, '[data-action="purchase"][data-purchase-item-id="cw-filter-500"]');
  await waitFor(window, '[data-store-item-id="cw-filter-500"][data-store-item-state="owned"]');
  const accessoryPurchaseState = await window.webContents.executeJavaScript(`(() => {
    const save = JSON.parse(localStorage.getItem("game-morse-adventurer.saves.v1"))[0];
    return { money: save.money, accessories: save.accessories, accessoryId: save.accessoryId };
  })()`, true);
  if (accessoryPurchaseState.money !== 1700
    || !accessoryPurchaseState.accessories.includes("cw-filter-500")
    || accessoryPurchaseState.accessoryId !== "none") {
    throw new Error(`Accessory purchase was not atomic: ${JSON.stringify(accessoryPurchaseState)}`);
  }
  await capture(window, outputDir, shot("store-accessory-owned"));
  await click(window, '[data-store-category="radio"]');
  await waitFor(window, '[data-store-item-id="usdr-8"][data-store-item-state="available"]');
  await click(window, '[data-store-item-id="usdr-8"]');
  await capture(window, outputDir, shot("store-radio-available-warmup"));
  await capture(window, outputDir, shot("store-radio-available"));
  await click(window, '[data-action="purchase"][data-purchase-item-id="usdr-8"]');
  await waitFor(window, '[data-store-item-id="usdr-8"][data-store-item-state="owned"]');
  const radioPurchaseState = await window.webContents.executeJavaScript(`(() => {
    const save = JSON.parse(localStorage.getItem("game-morse-adventurer.saves.v1"))[0];
    return { money: save.money, ownedEquipment: save.ownedEquipment, equipmentId: save.equipmentId };
  })()`, true);
  if (radioPurchaseState.money !== 900
    || !radioPurchaseState.ownedEquipment.includes("usdr-8")
    || radioPurchaseState.equipmentId !== "squid-01") {
    throw new Error(`Radio purchase was not atomic: ${JSON.stringify(radioPurchaseState)}`);
  }
  await capture(window, outputDir, shot("store-radio-owned-warmup"));
  await capture(window, outputDir, shot("store-radio-owned"));
  await click(window, '[data-action="close-store"]');
  await waitFor(window, ".home-screen");
  await click(window, ".hotspot-warehouse");
  await waitFor(window, ".warehouse-screen");
  await click(window, ".warehouse-category-rail button:nth-of-type(3)");
  await click(window, '[data-accessory-id="cw-filter-500"]');
  await capture(window, outputDir, shot("warehouse-accessory-selected"));
  await click(window, '[data-action="equip-item"][data-equipped-item-id="cw-filter-500"]');
  const equippedAccessoryId = await window.webContents.executeJavaScript(
    'JSON.parse(localStorage.getItem("game-morse-adventurer.saves.v1"))[0].accessoryId',
    true,
  );
  if (equippedAccessoryId !== "cw-filter-500") throw new Error(`Accessory did not persist after equip: ${equippedAccessoryId}`);
  await capture(window, outputDir, shot("warehouse-accessory-equipped"));
  await click(window, '[data-warehouse-category="radio"]');
  await click(window, '[data-radio-id="usdr-8"]');
  await capture(window, outputDir, shot("warehouse-radio-selected"));
  await click(window, '[data-action="equip-item"][data-equipped-item-id="usdr-8"]');
  const equippedRadioState = await window.webContents.executeJavaScript(`(() => ({
    saved: JSON.parse(localStorage.getItem("game-morse-adventurer.saves.v1"))[0].equipmentId,
    shown: document.querySelector('[data-testid="current-radio-loadout"]')?.dataset.equipmentId ?? null,
  }))()`, true);
  if (equippedRadioState.saved !== "usdr-8" || equippedRadioState.shown !== "usdr-8") {
    throw new Error(`Radio did not persist after equip: ${JSON.stringify(equippedRadioState)}`);
  }
  await capture(window, outputDir, shot("warehouse-radio-equipped"));
  await click(window, ".warehouse-return");
  await waitFor(window, ".home-screen");
  await click(window, ".hotspot-achievements");
  await waitFor(window, '[data-testid="achievements-modal"]');
  const populatedAchievementState = await window.webContents.executeJavaScript(`(() => ({
    unlocked: Array.from(document.querySelectorAll('.achievement-card[data-achievement-state="unlocked"]'))
      .map((node) => node.dataset.achievementId).sort(),
    locked: Array.from(document.querySelectorAll('.achievement-card[data-achievement-state="locked"]'))
      .map((node) => node.dataset.achievementId),
    callsign: document.querySelector(".achievements-summary strong")?.textContent.trim() ?? null,
    savedCallsign: JSON.parse(localStorage.getItem("game-morse-adventurer.saves.v1"))[0].callsign,
  }))()`, true);
  const expectedUnlockedAchievements = ["dx-5000", "first-accessory", "first-qso", "radio-upgrade"];
  if (JSON.stringify(populatedAchievementState.unlocked) !== JSON.stringify(expectedUnlockedAchievements)
    || populatedAchievementState.callsign !== populatedAchievementState.savedCallsign) {
    throw new Error(`Unexpected populated achievement state: ${JSON.stringify(populatedAchievementState)}`);
  }
  await capture(window, outputDir, shot("achievements-populated"));
  await click(window, '[data-action="close-achievements-footer"]');
  await waitForMissing(window, '[data-testid="achievements-modal"]');
  await click(window, ".hotspot-log");
  await waitFor(window, ".qso-log-modal");
  await capture(window, outputDir, shot("home-log-populated-warmup"));
  await capture(window, outputDir, shot("home-log-populated"));
  await click(window, ".qso-log-records button:nth-of-type(2)");
  await capture(window, outputDir, shot("home-log-detail-second"));
  await click(window, ".qso-log-return");
  await waitForMissing(window, ".qso-log-modal");
  await delay(400);
    }
    if (scope === "equipment") return finishScope();

    if (scope === "practice") {
      await click(window, ".menu-primary");
      await waitFor(window, ".save-select-screen");
      await click(window, ".save-primary-action");
      await waitFor(window, ".home-screen");
    }
    if (scope === "full" || scope === "practice") {
  // The Home book stack is the save-aware curriculum entrance. Its hover tint,
  // route, return route, promotion gate and persistence are all smoke-tested.
  await clearHover(window);
  await waitFor(window, '[data-testid="home-practice-progress"][data-practice-completed="0"][data-practice-total="19"][data-practice-percent="0"]');
  const initialHomePracticeProgress = await window.webContents.executeJavaScript(`(() => {
    const hotspot = document.querySelector('[data-testid="home-practice-hotspot"]');
    const progress = document.querySelector('[data-testid="home-practice-progress"]');
    return {
      hotspotCompleted: Number(hotspot?.dataset.practiceCompleted),
      hotspotTotal: Number(hotspot?.dataset.practiceTotal),
      hotspotPercent: Number(hotspot?.dataset.practicePercent),
      completed: Number(progress?.dataset.practiceCompleted),
      total: Number(progress?.dataset.practiceTotal),
      percent: Number(progress?.dataset.practicePercent),
    };
  })()`, true);
  if (initialHomePracticeProgress.hotspotCompleted !== 0
    || initialHomePracticeProgress.hotspotTotal !== 19
    || initialHomePracticeProgress.hotspotPercent !== 0
    || initialHomePracticeProgress.completed !== 0
    || initialHomePracticeProgress.total !== 19
    || initialHomePracticeProgress.percent !== 0) {
    throw new Error(`Initial Home practice progress is not 0/19: ${JSON.stringify(initialHomePracticeProgress)}`);
  }
  await assertHoverTint(window, '[data-testid="home-practice-hotspot"]');
  await capture(window, outputDir, shot("home-hover-practice"));
  await click(window, '[data-testid="home-practice-hotspot"]');
  await waitFor(window, '.practice-screen[data-practice-recording="save"][data-practice-difficulty="guided"][data-practice-lesson="1"][data-practice-lessons-completed="0"]');
  await waitFor(window, '[data-testid="practice-lesson-content"]');
  await waitFor(window, '[data-testid="practice-mastery-feedback"][data-mastery-status="not-started"][data-mastery-completed-lessons="0"][data-mastery-block-attempts="0"][data-mastery-block-correct="0"][data-mastery-attempts-remaining="5"][data-mastery-correct-needed="4"][data-mastery-can-pass="true"]');
  await waitFor(window, '[data-testid="practice-mode-option-character-rx"][data-practice-mode-completed="0"][data-practice-mode-total="5"][data-practice-mode-percent="0"]');
  await waitFor(window, '[data-testid="practice-mode-option-callsign-rx"][data-practice-mode-completed="0"][data-practice-mode-total="4"][data-practice-mode-percent="0"]');
  await waitFor(window, '[data-testid="practice-mode-option-manual-tx"][data-practice-mode-completed="0"][data-practice-mode-total="5"][data-practice-mode-percent="0"]');
  await waitFor(window, '[data-testid="practice-mode-option-paddle-tx"][data-practice-mode-completed="0"][data-practice-mode-total="5"][data-practice-mode-percent="0"]');
  const initialPracticeOverview = await window.webContents.executeJavaScript(`(() => ({
    modes: Object.fromEntries(["character-rx", "callsign-rx", "manual-tx", "paddle-tx"].map((mode) => {
      const node = document.querySelector('[data-testid="practice-mode-option-' + mode + '"]');
      return [mode, {
        completed: Number(node?.dataset.practiceModeCompleted),
        total: Number(node?.dataset.practiceModeTotal),
        percent: Number(node?.dataset.practiceModePercent),
      }];
    })),
    weakReviewAvailable: document.querySelector('[data-testid="practice-weak-review"]')?.dataset.weakReviewAvailable ?? null,
    weakReviewTargets: document.querySelector('[data-testid="practice-weak-review"]')?.dataset.weakReviewTargets ?? null,
  }))()`, true);
  const expectedInitialPracticeOverview = {
    "character-rx": { completed: 0, total: 5, percent: 0 },
    "callsign-rx": { completed: 0, total: 4, percent: 0 },
    "manual-tx": { completed: 0, total: 5, percent: 0 },
    "paddle-tx": { completed: 0, total: 5, percent: 0 },
  };
  if (JSON.stringify(initialPracticeOverview.modes) !== JSON.stringify(expectedInitialPracticeOverview)
    || initialPracticeOverview.weakReviewAvailable !== "false"
    || initialPracticeOverview.weakReviewTargets !== "") {
    throw new Error(`Initial four-mode curriculum overview is incomplete: ${JSON.stringify(initialPracticeOverview)}`);
  }
  await capture(window, outputDir, shot("practice-overview-initial"));
  const persistentPracticeIdentity = await window.webContents.executeJavaScript(`(() => ({
    recording: document.querySelector(".practice-screen")?.dataset.practiceRecording ?? null,
    difficulty: document.querySelector(".practice-screen")?.dataset.practiceDifficulty ?? null,
    lesson: Number(document.querySelector(".practice-screen")?.dataset.practiceLesson),
    completedLessons: Number(document.querySelector(".practice-screen")?.dataset.practiceLessonsCompleted),
    lessonNew: document.querySelector(".practice-screen")?.dataset.practiceLessonNew ?? "",
    lessonPool: document.querySelector(".practice-screen")?.dataset.practiceLessonPool ?? "",
    masteryAttempts: Number(document.querySelector(".practice-screen")?.dataset.practiceMasteryAttempts),
    masteryCorrect: Number(document.querySelector(".practice-screen")?.dataset.practiceMasteryCorrect),
    masteryRemaining: Number(document.querySelector(".practice-screen")?.dataset.practiceMasteryRemaining),
    masteryCanPass: document.querySelector(".practice-screen")?.dataset.practiceMasteryCanPass ?? null,
    statusText: document.querySelector(".practice-recording-status")?.textContent.trim() ?? "",
    callsign: JSON.parse(localStorage.getItem("game-morse-adventurer.saves.v1"))[0].callsign,
  }))()`, true);
  if (persistentPracticeIdentity.recording !== "save"
    || persistentPracticeIdentity.difficulty !== "guided"
    || persistentPracticeIdentity.lesson !== 1
    || persistentPracticeIdentity.completedLessons !== 0
    || persistentPracticeIdentity.lessonNew !== "A,N,T,E"
    || persistentPracticeIdentity.lessonPool !== "A,N,T,E"
    || persistentPracticeIdentity.masteryAttempts !== 0
    || persistentPracticeIdentity.masteryCorrect !== 0
    || persistentPracticeIdentity.masteryRemaining !== 5
    || persistentPracticeIdentity.masteryCanPass !== "true"
    || !persistentPracticeIdentity.statusText.includes(persistentPracticeIdentity.callsign)) {
    throw new Error(`Active-save practice did not identify its record destination: ${JSON.stringify(persistentPracticeIdentity)}`);
  }
  await click(window, '[data-action="practice-visual-aid"]');
  await waitFor(window, ".practice-prompt code");
  await capture(window, outputDir, shot("practice-lesson-guidance"));

  const practiceTargets = [];
  wrongPracticeTarget = null;
  for (let index = 0; index < 5; index += 1) {
    const question = await window.webContents.executeJavaScript(`(() => ({
      id: document.querySelector(".practice-screen")?.dataset.practiceQuestionId ?? "",
      target: document.querySelector(".practice-screen")?.dataset.practiceTarget ?? "",
      attempts: Number(document.querySelector(".practice-screen")?.dataset.practiceAttempts),
      lifetimeAttempts: Number(document.querySelector(".practice-screen")?.dataset.practiceLifetimeAttempts),
    }))()`, true);
    if (!question.id || !question.target || question.attempts !== index || question.lifetimeAttempts !== index) {
      throw new Error(`Practice question ${index + 1} did not start cleanly: ${JSON.stringify(question)}`);
    }
    practiceTargets.push(question.target);
    const intentionallyWrong = index === 4;
    const answer = intentionallyWrong ? (question.target === "E" ? "T" : "E") : question.target;
    if (intentionallyWrong) wrongPracticeTarget = question.target;
    await setInputValue(window, '[data-testid="practice-answer"]', answer);

    if (index === 0) {
      await window.webContents.executeJavaScript(`(() => {
        const submit = document.querySelector('[data-action="practice-submit"]');
        if (!submit) throw new Error("Missing practice submit button");
        submit.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, view: window }));
        submit.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, view: window }));
      })()`, true);
    } else {
      await click(window, '[data-action="practice-submit"]');
    }
    await waitFor(window, `.practice-screen[data-practice-attempts="${index + 1}"][data-practice-lifetime-attempts="${index + 1}"]`);
    await waitFor(window, intentionallyWrong
      ? '.practice-screen[data-practice-result="wrong"]'
      : '.practice-screen[data-practice-result="correct"]');
    const settlement = await window.webContents.executeJavaScript(`(() => {
      const save = JSON.parse(localStorage.getItem("game-morse-adventurer.saves.v1"))[0];
      const record = save.practiceRecords?.["character-rx"];
      return {
        sessionAttempts: Number(document.querySelector(".practice-screen")?.dataset.practiceAttempts),
        lifetimeAttempts: Number(document.querySelector(".practice-screen")?.dataset.practiceLifetimeAttempts),
        storedAttempts: Number(record?.attempts),
        storedCorrect: Number(record?.correct),
        submitDisabled: Boolean(document.querySelector('[data-action="practice-submit"]')?.disabled),
      };
    })()`, true);
    if (settlement.sessionAttempts !== index + 1 || settlement.lifetimeAttempts !== index + 1
      || settlement.storedAttempts !== index + 1 || settlement.storedCorrect !== (intentionallyWrong ? 4 : index + 1)
      || !settlement.submitDisabled) {
      throw new Error(`Practice settlement ${index + 1} was duplicated or lost: ${JSON.stringify(settlement)}`);
    }
    if (index < 4) {
      await click(window, '[data-action="practice-next"]');
      await waitFor(window, '.practice-screen[data-practice-result="waiting"]');
    }
  }

  const guidedLessonOneTargets = new Set(["A", "N", "T", "E"]);
  if (practiceTargets.some((target) => !guidedLessonOneTargets.has(target))
    || new Set(practiceTargets.slice(0, 4)).size !== 4) {
    throw new Error(`Guided lesson one leaked a locked target or duplicated its first bag: ${JSON.stringify(practiceTargets)}`);
  }
  await waitFor(window, '[data-testid="practice-summary-modal"][data-summary-attempts="5"][data-summary-lesson="1"][data-summary-lesson-passed="true"][data-summary-next-lesson="2"]');
  const completedPracticeState = await window.webContents.executeJavaScript(`(() => {
    const save = JSON.parse(localStorage.getItem("game-morse-adventurer.saves.v1"))[0];
    const record = save.practiceRecords?.["character-rx"];
    const modal = document.querySelector('[data-testid="practice-summary-modal"]');
    return {
      attempts: Number(record?.attempts),
      correct: Number(record?.correct),
      difficulty: record?.difficulty ?? null,
      lesson: Number(record?.lesson),
      completedLessons: Number(record?.completedLessons),
      lessonAttempts: Number(record?.lessonAttempts),
      weaknesses: record?.weaknesses ?? {},
      recentTargets: record?.recentTargets ?? [],
      summaryAttempts: Number(modal?.dataset.summaryAttempts),
      summaryCorrect: Number(modal?.dataset.summaryCorrect),
    };
  })()`, true);
  const expectedRecentTargets = practiceTargets.slice(-4);
  if (completedPracticeState.attempts !== 5 || completedPracticeState.correct !== 4
    || completedPracticeState.difficulty !== "guided"
    || completedPracticeState.lesson !== 2 || completedPracticeState.completedLessons !== 1
    || completedPracticeState.lessonAttempts !== 0
    || completedPracticeState.summaryAttempts !== 5 || completedPracticeState.summaryCorrect !== 4
    || Number(completedPracticeState.weaknesses[wrongPracticeTarget]) < 1
    || JSON.stringify(completedPracticeState.recentTargets) !== JSON.stringify(expectedRecentTargets)
    || !completedPracticeState.recentTargets.includes(wrongPracticeTarget)) {
    throw new Error(`Practice summary or durable weak/recent record is incomplete: ${JSON.stringify({ practiceTargets, wrongPracticeTarget, completedPracticeState })}`);
  }
  await capture(window, outputDir, shot("practice-session-summary"));

  await click(window, '[data-action="practice-summary-continue"]');
  await waitFor(window, '.practice-screen[data-practice-result="waiting"][data-practice-difficulty="guided"][data-practice-lesson="2"][data-practice-lessons-completed="1"][data-practice-lesson-new="I,M,S,O"]');
  await waitFor(window, '[data-testid="practice-mastery-feedback"][data-mastery-status="not-started"][data-mastery-completed-lessons="1"][data-mastery-attempts-remaining="5"][data-mastery-correct-needed="4"][data-mastery-can-pass="true"]');
  await waitFor(window, '[data-testid="practice-mode-option-character-rx"][data-practice-mode-completed="1"][data-practice-mode-total="5"][data-practice-mode-percent="20"]');
  await waitFor(window, `[data-testid="practice-weak-review"][data-weak-review-available="true"][data-weak-review-active="false"][data-weak-review-targets="${wrongPracticeTarget}"]`);
  const completedOverviewState = await window.webContents.executeJavaScript(`(() => {
    const character = document.querySelector('[data-testid="practice-mode-option-character-rx"]');
    const otherModes = ["callsign-rx", "manual-tx", "paddle-tx"].map((mode) => {
      const node = document.querySelector('[data-testid="practice-mode-option-' + mode + '"]');
      return {
        mode,
        completed: Number(node?.dataset.practiceModeCompleted),
        total: Number(node?.dataset.practiceModeTotal),
        percent: Number(node?.dataset.practiceModePercent),
      };
    });
    const save = JSON.parse(localStorage.getItem("game-morse-adventurer.saves.v1"))[0];
    const records = save.practiceRecords ?? {};
    return {
      character: {
        completed: Number(character?.dataset.practiceModeCompleted),
        total: Number(character?.dataset.practiceModeTotal),
        percent: Number(character?.dataset.practiceModePercent),
      },
      otherModes,
      aggregateCompleted: Object.values(records).reduce((sum, record) => sum + Number(record?.completedLessons || 0), 0),
    };
  })()`, true);
  if (JSON.stringify(completedOverviewState.character) !== JSON.stringify({ completed: 1, total: 5, percent: 20 })
    || completedOverviewState.otherModes.some(({ completed, percent }) => completed !== 0 || percent !== 0)
    || completedOverviewState.aggregateCompleted !== 1) {
    throw new Error(`Completed lesson did not update the four-mode overview to 1/5 and aggregate 1/19: ${JSON.stringify(completedOverviewState)}`);
  }
  await capture(window, outputDir, shot("practice-overview-after-lesson"));

  // The single miss above exposes one durable weak target. The review locks
  // that pool for five questions and must never mutate the formal lesson block.
  await click(window, '[data-testid="practice-weak-review"]');
  await waitFor(window, `.practice-screen[data-practice-session-type="weakness-review"][data-practice-review-targets="${wrongPracticeTarget}"][data-practice-weak-review-available="true"][data-practice-review-recovered="0"][data-practice-review-remaining="1"][data-practice-attempts="0"][data-practice-lifetime-attempts="5"][data-practice-lifetime-correct="4"]`);
  await waitFor(window, `[data-testid="practice-weak-review"][data-weak-review-active="true"][data-weak-review-targets="${wrongPracticeTarget}"][data-weak-review-recovered="0"][data-weak-review-remaining="1"]`);
  const lockedWeakReviewControls = await window.webContents.executeJavaScript(`(() => ({
    modeButtons: Array.from(document.querySelectorAll("[data-practice-mode-option]"))
      .map((node) => ({ mode: node.dataset.practiceModeOption, disabled: Boolean(node.disabled) })),
    endDisabled: Boolean(document.querySelector('[data-action="practice-end"]')?.disabled),
  }))()`, true);
  if (lockedWeakReviewControls.modeButtons.length !== 4
    || lockedWeakReviewControls.modeButtons.some(({ disabled }) => !disabled)
    || !lockedWeakReviewControls.endDisabled) {
    throw new Error(`Weakness review did not lock mode switching and early completion: ${JSON.stringify(lockedWeakReviewControls)}`);
  }
  await capture(window, outputDir, shot("practice-weak-recovery-review"));

  const weakReviewTargets = [];
  for (let index = 0; index < 5; index += 1) {
    const question = await window.webContents.executeJavaScript(`(() => ({
      id: document.querySelector(".practice-screen")?.dataset.practiceQuestionId ?? "",
      target: document.querySelector(".practice-screen")?.dataset.practiceTarget ?? "",
      sessionType: document.querySelector(".practice-screen")?.dataset.practiceSessionType ?? null,
      reviewTargets: document.querySelector(".practice-screen")?.dataset.practiceReviewTargets ?? "",
      attempts: Number(document.querySelector(".practice-screen")?.dataset.practiceAttempts),
      lifetimeAttempts: Number(document.querySelector(".practice-screen")?.dataset.practiceLifetimeAttempts),
      lifetimeCorrect: Number(document.querySelector(".practice-screen")?.dataset.practiceLifetimeCorrect),
      recovered: Number(document.querySelector(".practice-screen")?.dataset.practiceReviewRecovered),
      remaining: Number(document.querySelector(".practice-screen")?.dataset.practiceReviewRemaining),
    }))()`, true);
    if (!question.id || question.target !== wrongPracticeTarget
      || question.sessionType !== "weakness-review" || question.reviewTargets !== wrongPracticeTarget
      || question.attempts !== index || question.lifetimeAttempts !== 5 + index
      || question.lifetimeCorrect !== 4 + index
      || question.recovered !== Math.min(index, 1)
      || question.remaining !== Math.max(1 - index, 0)) {
      throw new Error(`Weakness-review question ${index + 1} escaped its fixed pool or lost lifetime state: ${JSON.stringify(question)}`);
    }
    weakReviewTargets.push(question.target);
    await setInputValue(window, '[data-testid="practice-answer"]', question.target);
    await click(window, '[data-action="practice-submit"]');
    await waitFor(window, `.practice-screen[data-practice-session-type="weakness-review"][data-practice-review-recovered="1"][data-practice-review-remaining="0"][data-practice-attempts="${index + 1}"][data-practice-lifetime-attempts="${6 + index}"][data-practice-lifetime-correct="${5 + index}"]`);
    await waitFor(window, '[data-testid="practice-weak-review"][data-weak-review-recovered="1"][data-weak-review-remaining="0"]');
    await waitFor(window, '.practice-screen[data-practice-result="correct"]');
    const settlement = await window.webContents.executeJavaScript(`(() => {
      const record = JSON.parse(localStorage.getItem("game-morse-adventurer.saves.v1"))[0].practiceRecords?.["character-rx"];
      return {
        attempts: Number(record?.attempts),
        correct: Number(record?.correct),
        lesson: Number(record?.lesson),
        completedLessons: Number(record?.completedLessons),
        lessonAttempts: Number(record?.lessonAttempts),
        lessonCorrect: Number(record?.lessonCorrect),
      };
    })()`, true);
    if (settlement.attempts !== 6 + index || settlement.correct !== 5 + index
      || settlement.lesson !== 2 || settlement.completedLessons !== 1
      || settlement.lessonAttempts !== 0 || settlement.lessonCorrect !== 0) {
      throw new Error(`Weakness review mutated formal progress or lost a lifetime result: ${JSON.stringify(settlement)}`);
    }
    if (index < 4) {
      await click(window, '[data-action="practice-next"]');
      await waitFor(window, '.practice-screen[data-practice-session-type="weakness-review"][data-practice-result="waiting"]');
    }
  }
  if (weakReviewTargets.some((target) => target !== wrongPracticeTarget)) {
    throw new Error(`Weakness review did not keep its single-target fixed pool: ${JSON.stringify(weakReviewTargets)}`);
  }
  await waitFor(window, '[data-testid="practice-summary-modal"][data-summary-session-type="weakness-review"][data-summary-progression-eligible="false"][data-summary-attempts="5"][data-summary-correct="5"][data-summary-recovered="1"][data-summary-remaining-weakness="0"][data-summary-review-mastered="true"]');
  const completedWeakReviewState = await window.webContents.executeJavaScript(`(() => {
    const save = JSON.parse(localStorage.getItem("game-morse-adventurer.saves.v1"))[0];
    const record = save.practiceRecords?.["character-rx"];
    const modal = document.querySelector('[data-testid="practice-summary-modal"]');
    return {
      attempts: Number(record?.attempts),
      correct: Number(record?.correct),
      lesson: Number(record?.lesson),
      completedLessons: Number(record?.completedLessons),
      lessonAttempts: Number(record?.lessonAttempts),
      lessonCorrect: Number(record?.lessonCorrect),
      weakness: Number(record?.weaknesses?.[${JSON.stringify(wrongPracticeTarget)}] ?? 0),
      summarySessionType: modal?.dataset.summarySessionType ?? null,
      progressionEligible: modal?.dataset.summaryProgressionEligible ?? null,
      summaryAttempts: Number(modal?.dataset.summaryAttempts),
      summaryCorrect: Number(modal?.dataset.summaryCorrect),
      summaryRecovered: Number(modal?.dataset.summaryRecovered),
      summaryRemainingWeakness: Number(modal?.dataset.summaryRemainingWeakness),
      summaryReviewMastered: modal?.dataset.summaryReviewMastered ?? null,
    };
  })()`, true);
  if (completedWeakReviewState.attempts !== 10 || completedWeakReviewState.correct !== 9
    || completedWeakReviewState.lesson !== 2 || completedWeakReviewState.completedLessons !== 1
    || completedWeakReviewState.lessonAttempts !== 0 || completedWeakReviewState.lessonCorrect !== 0
    || completedWeakReviewState.weakness !== 0
    || completedWeakReviewState.summarySessionType !== "weakness-review"
    || completedWeakReviewState.progressionEligible !== "false"
    || completedWeakReviewState.summaryAttempts !== 5 || completedWeakReviewState.summaryCorrect !== 5
    || completedWeakReviewState.summaryRecovered !== 1
    || completedWeakReviewState.summaryRemainingWeakness !== 0
    || completedWeakReviewState.summaryReviewMastered !== "true") {
    throw new Error(`Weakness-review summary or formal-progress isolation failed: ${JSON.stringify(completedWeakReviewState)}`);
  }
  await capture(window, outputDir, shot("practice-weak-summary-recovered"));

  await click(window, '[data-action="practice-summary-continue"]');
  await waitFor(window, '.practice-screen[data-practice-session-type="lesson"][data-practice-result="waiting"][data-practice-lifetime-attempts="10"][data-practice-lifetime-correct="9"][data-practice-lesson="2"][data-practice-lessons-completed="1"][data-practice-lesson-attempts="0"][data-practice-weak-review-available="false"][data-practice-review-targets=""][data-practice-review-recovered="0"][data-practice-review-remaining="0"]');
  await waitFor(window, '[data-testid="practice-mode-option-character-rx"][data-practice-mode-completed="1"][data-practice-mode-total="5"][data-practice-mode-percent="20"]');
  await waitFor(window, '[data-testid="practice-weak-review"][data-weak-review-available="false"][data-weak-review-active="false"][data-weak-review-targets=""][data-weak-review-recovered="0"][data-weak-review-remaining="0"]');
  await capture(window, outputDir, shot("practice-weak-cleared"));
  await click(window, '[data-action="practice-back"]');
  await waitFor(window, ".home-screen");
  await waitFor(window, '[data-testid="home-practice-progress"][data-practice-completed="1"][data-practice-total="19"][data-practice-percent="5"]');
  await capture(window, outputDir, shot("home-after-practice"));

  await window.reload();
  await waitFor(window, ".start-screen");
  await delay(250);
  const practiceReloadState = await window.webContents.executeJavaScript(`(() => {
    const save = JSON.parse(localStorage.getItem("game-morse-adventurer.saves.v1"))[0];
    return {
      attempts: Number(save.practiceRecords?.["character-rx"]?.attempts),
      correct: Number(save.practiceRecords?.["character-rx"]?.correct),
      difficulty: save.practiceRecords?.["character-rx"]?.difficulty ?? null,
      lesson: Number(save.practiceRecords?.["character-rx"]?.lesson),
      completedLessons: Number(save.practiceRecords?.["character-rx"]?.completedLessons),
      lessonAttempts: Number(save.practiceRecords?.["character-rx"]?.lessonAttempts),
      lessonCorrect: Number(save.practiceRecords?.["character-rx"]?.lessonCorrect),
      weakness: Number(save.practiceRecords?.["character-rx"]?.weaknesses?.[${JSON.stringify(wrongPracticeTarget)}] ?? 0),
      notificationCount: document.querySelectorAll('[data-testid="achievement-notification"]').length,
    };
  })()`, true);
  if (practiceReloadState.attempts !== 10 || practiceReloadState.correct !== 9
    || practiceReloadState.difficulty !== "guided"
    || practiceReloadState.lesson !== 2 || practiceReloadState.completedLessons !== 1
    || practiceReloadState.lessonAttempts !== 0 || practiceReloadState.lessonCorrect !== 0
    || practiceReloadState.weakness !== 0
    || practiceReloadState.notificationCount !== 0) {
    throw new Error(`Practice lifetime record or reload notification policy failed: ${JSON.stringify(practiceReloadState)}`);
  }
  await click(window, ".start-actions button:nth-child(2)");
  await waitFor(window, '.practice-screen[data-practice-recording="save"][data-practice-session-type="lesson"][data-practice-lifetime-attempts="10"][data-practice-lifetime-correct="9"][data-practice-difficulty="guided"][data-practice-lesson="2"][data-practice-lessons-completed="1"][data-practice-lesson-attempts="0"][data-practice-weak-review-available="false"][data-practice-review-targets=""][data-practice-review-remaining="0"]');
  await waitFor(window, '[data-testid="practice-mode-option-character-rx"][data-practice-mode-completed="1"][data-practice-mode-total="5"][data-practice-mode-percent="20"]');
  await waitFor(window, '[data-testid="practice-weak-review"][data-weak-review-available="false"][data-weak-review-active="false"][data-weak-review-targets=""][data-weak-review-remaining="0"]');
  await capture(window, outputDir, shot("practice-weak-cleared-reloaded"));

  await click(window, '[data-testid="practice-mode-option-callsign-rx"]');
  await waitFor(window, '.practice-screen[data-practice-mode="callsign-rx"][data-practice-callsign-region="all"][data-practice-session-type="lesson"][data-practice-lesson="1"][data-practice-lessons-completed="0"][data-practice-attempts="0"][data-practice-lifetime-attempts="0"]');
  await waitFor(window, '[data-testid="practice-callsign-region"][data-callsign-region="all"]');
  await waitFor(window, '[data-callsign-region-option="all"][aria-checked="true"]');
  await click(window, '[data-callsign-region-option="japan"]');
  await waitFor(window, '.practice-screen[data-practice-mode="callsign-rx"][data-practice-callsign-region="japan"][data-practice-lesson-new="SIM1JA,SIM2TK"][data-practice-lesson-pool="SIM1JA,SIM2TK"][data-practice-attempts="0"][data-practice-lifetime-attempts="0"]');
  await waitFor(window, '[data-testid="practice-callsign-region"][data-callsign-region="japan"]');
  await waitFor(window, '[data-callsign-region-option="japan"][aria-checked="true"]');
  const selectedCallsignRegion = await window.webContents.executeJavaScript(`(() => {
    const save = JSON.parse(localStorage.getItem("game-morse-adventurer.saves.v1"))[0];
    const callsign = save.practiceRecords?.["callsign-rx"];
    const character = save.practiceRecords?.["character-rx"];
    return {
      recordsVersion: Number(save.practiceRecordsVersion),
      region: callsign?.callsignRegion ?? null,
      attempts: Number(callsign?.attempts),
      correct: Number(callsign?.correct),
      lesson: Number(callsign?.lesson),
      completedLessons: Number(callsign?.completedLessons),
      recentTargets: callsign?.recentTargets ?? [],
      characterAttempts: Number(character?.attempts),
      characterCorrect: Number(character?.correct),
      characterLesson: Number(character?.lesson),
      characterCompletedLessons: Number(character?.completedLessons),
    };
  })()`, true);
  if (selectedCallsignRegion.recordsVersion !== 3
    || selectedCallsignRegion.region !== "japan"
    || selectedCallsignRegion.attempts !== 0 || selectedCallsignRegion.correct !== 0
    || selectedCallsignRegion.lesson !== 1 || selectedCallsignRegion.completedLessons !== 0
    || selectedCallsignRegion.recentTargets.length !== 0
    || selectedCallsignRegion.characterAttempts !== 10 || selectedCallsignRegion.characterCorrect !== 9
    || selectedCallsignRegion.characterLesson !== 2 || selectedCallsignRegion.characterCompletedLessons !== 1) {
    throw new Error(`Selecting a callsign region mutated progress or failed to persist: ${JSON.stringify(selectedCallsignRegion)}`);
  }
  await capture(window, outputDir, shot("practice-callsign-region-selected"));

  const regionalQuestion = await window.webContents.executeJavaScript(`(() => ({
    target: document.querySelector(".practice-screen")?.dataset.practiceTarget ?? "",
    pool: document.querySelector(".practice-screen")?.dataset.practiceLessonPool ?? "",
  }))()`, true);
  if (!["SIM1JA", "SIM2TK"].includes(regionalQuestion.target)
    || regionalQuestion.pool !== "SIM1JA,SIM2TK") {
    throw new Error(`Japan callsign lesson leaked a regional target: ${JSON.stringify(regionalQuestion)}`);
  }
  await setInputValue(window, '[data-testid="practice-answer"]', regionalQuestion.target);
  await click(window, '[data-action="practice-submit"]');
  await waitFor(window, '.practice-screen[data-practice-mode="callsign-rx"][data-practice-callsign-region="japan"][data-practice-result="correct"][data-practice-attempts="1"][data-practice-lifetime-attempts="1"][data-practice-lifetime-correct="1"]');
  const lockedRegionState = await window.webContents.executeJavaScript(`(() => {
    const save = JSON.parse(localStorage.getItem("game-morse-adventurer.saves.v1"))[0];
    const record = save.practiceRecords?.["callsign-rx"];
    return {
      region: record?.callsignRegion ?? null,
      attempts: Number(record?.attempts),
      correct: Number(record?.correct),
      lesson: Number(record?.lesson),
      completedLessons: Number(record?.completedLessons),
      lessonAttempts: Number(record?.lessonAttempts),
      lessonCorrect: Number(record?.lessonCorrect),
      recentTargets: record?.recentTargets ?? [],
      regionButtons: Array.from(document.querySelectorAll("[data-callsign-region-option]"))
        .map((node) => ({ id: node.dataset.callsignRegionOption, disabled: Boolean(node.disabled), checked: node.getAttribute("aria-checked") })),
    };
  })()`, true);
  if (lockedRegionState.region !== "japan"
    || lockedRegionState.attempts !== 1 || lockedRegionState.correct !== 1
    || lockedRegionState.lesson !== 1 || lockedRegionState.completedLessons !== 0
    || lockedRegionState.lessonAttempts !== 1 || lockedRegionState.lessonCorrect !== 1
    || JSON.stringify(lockedRegionState.recentTargets) !== JSON.stringify([regionalQuestion.target])
    || lockedRegionState.regionButtons.length !== 5
    || lockedRegionState.regionButtons.some(({ disabled }) => !disabled)
    || lockedRegionState.regionButtons.find(({ id }) => id === "japan")?.checked !== "true") {
    throw new Error(`Regional callsign settlement or selector locking failed: ${JSON.stringify(lockedRegionState)}`);
  }
  await capture(window, outputDir, shot("practice-callsign-region-locked"));
  await click(window, '[data-action="practice-end"]');
  await waitFor(window, '[data-testid="practice-summary-modal"][data-summary-mode="callsign-rx"][data-summary-attempts="1"][data-summary-correct="1"]');
  await click(window, '[data-action="practice-summary-back"]');
  await waitFor(window, ".start-screen");

  await window.reload();
  await waitFor(window, ".start-screen");
  await delay(250);
  await click(window, ".start-actions button:nth-child(2)");
  await waitFor(window, '.practice-screen[data-practice-recording="save"]');
  await click(window, '[data-testid="practice-mode-option-callsign-rx"]');
  await waitFor(window, '.practice-screen[data-practice-mode="callsign-rx"][data-practice-callsign-region="japan"][data-practice-lesson="1"][data-practice-lessons-completed="0"][data-practice-lesson-attempts="1"][data-practice-lifetime-attempts="1"][data-practice-lifetime-correct="1"][data-practice-lesson-pool="SIM1JA,SIM2TK"]');
  await waitFor(window, '[data-testid="practice-callsign-region"][data-callsign-region="japan"]');
  await waitFor(window, '[data-callsign-region-option="japan"][aria-checked="true"]');
  const reloadedCallsignRegion = await window.webContents.executeJavaScript(`(() => {
    const save = JSON.parse(localStorage.getItem("game-morse-adventurer.saves.v1"))[0];
    const record = save.practiceRecords?.["callsign-rx"];
    return {
      region: record?.callsignRegion ?? null,
      attempts: Number(record?.attempts),
      correct: Number(record?.correct),
      lessonAttempts: Number(record?.lessonAttempts),
      lessonCorrect: Number(record?.lessonCorrect),
      recentTargets: record?.recentTargets ?? [],
    };
  })()`, true);
  if (reloadedCallsignRegion.region !== "japan"
    || reloadedCallsignRegion.attempts !== 1 || reloadedCallsignRegion.correct !== 1
    || reloadedCallsignRegion.lessonAttempts !== 1 || reloadedCallsignRegion.lessonCorrect !== 1
    || JSON.stringify(reloadedCallsignRegion.recentTargets) !== JSON.stringify([regionalQuestion.target])) {
    throw new Error(`Callsign region did not survive reload: ${JSON.stringify(reloadedCallsignRegion)}`);
  }
  await capture(window, outputDir, shot("practice-callsign-region-reloaded"));
    }
    if (scope === "practice") return finishScope({ practiceWrongTarget: wrongPracticeTarget });

    if (scope === "qso") {
      await click(window, ".start-actions button:nth-child(2)");
      await waitFor(window, '.practice-screen[data-practice-recording="save"]');
      await click(window, '[data-testid="practice-mode-option-callsign-rx"]');
      await waitFor(window, '.practice-screen[data-practice-mode="callsign-rx"][data-practice-callsign-region="japan"]');
    }
    if (scope === "full" || scope === "qso") {
  await click(window, '[data-action="practice-back"]');
  await waitFor(window, ".start-screen");
  await click(window, ".menu-primary");
  await waitFor(window, ".save-select-screen");
  await click(window, ".save-primary-action");
  await waitFor(window, ".home-screen");
  await waitFor(window, '[data-testid="home-practice-progress"][data-practice-completed="1"][data-practice-total="19"][data-practice-percent="5"]');
  await window.webContents.executeJavaScript(`(() => {
    window.__qaAchievementEvents = [];
    window.__qaAchievementLast = null;
    window.__qaAchievementObserver?.disconnect();
    const inspect = () => {
      const id = document.querySelector('[data-testid="achievement-notification"]')?.dataset.achievementId ?? null;
      if (id && id !== window.__qaAchievementLast) window.__qaAchievementEvents.push(id);
      window.__qaAchievementLast = id;
    };
    window.__qaAchievementObserver = new MutationObserver(inspect);
    window.__qaAchievementObserver.observe(document.body, { childList: true, subtree: true, attributes: true });
    inspect();
  })()`, true);
  await click(window, ".hotspot-station");
  await waitFor(window, ".station-screen");
  await assertNoNpcPortraitRuntime(window, "station-entry");
  await waitFor(window, '[data-testid="qso-briefing-modal"]');
  await capture(window, outputDir, shot("qso-duty-briefing"));
  await startGuidedQaWatch(window);
  const initialReceiverState = await window.webContents.executeJavaScript(`(() => ({
    phase: document.querySelector(".station-screen")?.dataset.qsoPhase ?? null,
    receiverActive: document.querySelector(".station-screen")?.dataset.receiverActive ?? null,
    hasManualReceiveButton: Boolean(document.querySelector('[data-action="play-npc"]')),
    hiddenContact: document.querySelector(".contact-card h2")?.textContent.trim() ?? null,
  }))()`, true);
  if (initialReceiverState.phase !== "PLAYER_CQ" || initialReceiverState.receiverActive !== "true"
    || initialReceiverState.hasManualReceiveButton || initialReceiverState.hiddenContact !== "---") {
    throw new Error(`Station did not enter automatic receive state: ${JSON.stringify(initialReceiverState)}`);
  }
  await click(window, '.station-topbar .top-actions [data-action="back-home"]');
  await waitFor(window, ".home-screen");
  if (await window.webContents.executeJavaScript('Boolean(document.querySelector("[data-testid=qso-leave-dialog]"))', true)) {
    throw new Error("A pristine PLAYER_CQ incorrectly opened the leave guard.");
  }
  await click(window, ".hotspot-station");
  await waitForFocusedQsoState(
    window,
    '[data-qso-phase="PLAYER_CQ"][data-qso-exit-risk="none"][data-receiver-active="true"]',
    { context: "after re-entering the station receiver" },
  );
  const accessoryReceiverState = await window.webContents.executeJavaScript(`(() => {
    const station = document.querySelector(".station-screen");
    return {
      accessoryId: station?.dataset.accessoryId ?? null,
      equipmentId: station?.dataset.equipmentId ?? null,
      equipmentPropagationBonus: Number(station?.dataset.equipmentPropagationBonus),
      equipmentNoiseGainMultiplier: Number(station?.dataset.equipmentNoiseGainMultiplier),
      equipmentQsbDepthMultiplier: Number(station?.dataset.equipmentQsbDepthMultiplier),
      playerEquipmentBonus: Number(station?.dataset.playerEquipmentBonus),
      noiseGain: Number(station?.dataset.channelNoiseGain),
      qsbDepth: Number(station?.dataset.channelQsbDepth),
      qsbDepthMultiplier: Number(station?.dataset.channelQsbDepthMultiplier),
      radioArt: document.querySelector('[data-testid="station-radio-art"]')?.getAttribute("src") ?? null,
    };
  })()`, true);
  if (accessoryReceiverState.accessoryId !== "cw-filter-500" || accessoryReceiverState.equipmentId !== "usdr-8"
    || accessoryReceiverState.equipmentPropagationBonus !== 0 || accessoryReceiverState.playerEquipmentBonus !== 0
    || Math.abs(accessoryReceiverState.equipmentNoiseGainMultiplier - 0.8) > 0.000001
    || Math.abs(accessoryReceiverState.equipmentQsbDepthMultiplier - 0.85) > 0.000001
    || Math.abs(accessoryReceiverState.noiseGain - 0.0338) > 0.000001
    || Math.abs(accessoryReceiverState.qsbDepthMultiplier - 0.85) > 0.000001
    || !(accessoryReceiverState.qsbDepth >= 0 && accessoryReceiverState.qsbDepth <= 0.765)
    || !accessoryReceiverState.radioArt?.includes("usdr-8-off.png")) {
    throw new Error(`Radio/accessory modifiers did not affect the open receiver: ${JSON.stringify(accessoryReceiverState)}`);
  }
  await capture(window, outputDir, shot("station-listening-warmup"));
  await capture(window, outputDir, shot("station-listening"));
  await focusQaWindow(window, "before station TX artwork keying probe");
  await window.webContents.executeJavaScript(`window.dispatchEvent(new KeyboardEvent("keydown", { code: "KeyX", key: "x", bubbles: true, cancelable: true }))`, true);
  await waitFor(window, '[data-testid="station-radio-art"][data-radio-art-state="tx"]');
  const txRadioArt = await window.webContents.executeJavaScript(
    'document.querySelector(\'[data-testid="station-radio-art"]\')?.getAttribute("src") ?? null',
    true,
  );
  if (!txRadioArt?.includes("usdr-8-on.png")) throw new Error(`Radio TX artwork did not switch: ${txRadioArt}`);
  await capture(window, outputDir, shot("station-radio-tx"));
  await window.webContents.executeJavaScript(`window.dispatchEvent(new KeyboardEvent("keyup", { code: "KeyX", key: "x", bubbles: true, cancelable: true }))`, true);
  await delay(300);
  await click(window, '[data-action="clear-input"]');
  await sendAutomaticText(window, "E");
  const draftBeforeResetGuard = await window.webContents.executeJavaScript(`(() => ({
    phase: document.querySelector(".station-screen")?.dataset.qsoPhase,
    pulseCount: Number(document.querySelector(".station-screen")?.dataset.pulseCount),
    npc: document.querySelector(".station-screen")?.dataset.qaNpcCallsign,
  }))()`, true);
  await click(window, '[data-action="new-qso"]');
  await waitFor(window, '[data-testid="qso-leave-dialog"][data-leave-reason="active"][data-leave-destination="new-qso"]');
  const activeGuardFocus = await window.webContents.executeJavaScript('document.activeElement?.dataset.action ?? null', true);
  if (activeGuardFocus !== "cancel-qso-leave") throw new Error(`Leave guard did not focus its safe action: ${activeGuardFocus}`);
  await capture(window, outputDir, shot("qso-leave-active"));
  await window.webContents.executeJavaScript('window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", code: "Escape", bubbles: true, cancelable: true }))', true);
  await waitForMissing(window, '[data-testid="qso-leave-dialog"]');
  const stackedSettingsAfterEscape = await window.webContents.executeJavaScript(
    'Boolean(document.querySelector(".settings-modal"))',
    true,
  );
  if (stackedSettingsAfterEscape) throw new Error("Escape stacked Settings behind the QSO leave alertdialog");
  const draftAfterCancel = await window.webContents.executeJavaScript(`(() => ({
    phase: document.querySelector(".station-screen")?.dataset.qsoPhase,
    pulseCount: Number(document.querySelector(".station-screen")?.dataset.pulseCount),
    npc: document.querySelector(".station-screen")?.dataset.qaNpcCallsign,
  }))()`, true);
  if (JSON.stringify(draftAfterCancel) !== JSON.stringify(draftBeforeResetGuard)) {
    throw new Error(`Cancelling the new-QSO guard changed the draft: ${JSON.stringify({ draftBeforeResetGuard, draftAfterCancel })}`);
  }
  await click(window, '[data-action="new-qso"]');
  await waitFor(window, '[data-testid="qso-leave-dialog"][data-leave-destination="new-qso"]');
  await click(window, '[data-action="confirm-qso-leave"]');
  await waitFor(window, '[data-qso-phase="PLAYER_CQ"][data-qso-exit-risk="none"][data-pulse-count="0"]');
  // Let StationScreen reattach its key listeners after the confirmed QSO reset.
  await delay(120);
  await sendAutomaticText(window, "E");
  const beforeClearInput = await window.webContents.executeJavaScript(`(() => {
    const save = JSON.parse(localStorage.getItem("game-morse-adventurer.saves.v1"))[0];
    return {
      pulseCount: Number(document.querySelector(".station-screen")?.dataset.pulseCount),
      decoded: document.querySelector(".station-screen")?.dataset.decoded ?? "",
      logIds: (save.qsoLogs ?? []).map((entry) => entry.id),
    };
  })()`, true);
  if (beforeClearInput.pulseCount < 1 || !beforeClearInput.decoded) {
    throw new Error(`Could not prepare clear-input QA state: ${JSON.stringify(beforeClearInput)}`);
  }
  await click(window, '[data-action="clear-input"]');
  await delay(100);
  const afterClearInput = await window.webContents.executeJavaScript(`(() => {
    const save = JSON.parse(localStorage.getItem("game-morse-adventurer.saves.v1"))[0];
    return {
      pulseCount: Number(document.querySelector(".station-screen")?.dataset.pulseCount),
      decoded: document.querySelector(".station-screen")?.dataset.decoded ?? "",
      logIds: (save.qsoLogs ?? []).map((entry) => entry.id),
    };
  })()`, true);
  if (afterClearInput.pulseCount !== 0 || afterClearInput.decoded
    || JSON.stringify(afterClearInput.logIds) !== JSON.stringify(beforeClearInput.logIds)) {
    throw new Error(`Clear input mutated logs or retained input: ${JSON.stringify({ beforeClearInput, afterClearInput })}`);
  }
  await capture(window, outputDir, shot("station-input-cleared"));

  await sendAutomaticRun(window, ".", 7, { expectClear: true });
  const dotClearState = await window.webContents.executeJavaScript(`(() => ({
    pulseCount: Number(document.querySelector(".station-screen")?.dataset.pulseCount || 0),
    decoded: document.querySelector(".station-screen")?.dataset.decoded ?? "",
  }))()`, true);
  if (dotClearState.pulseCount !== 0 || dotClearState.decoded) {
    throw new Error(`Seven-dot clear gesture failed: ${JSON.stringify(dotClearState)}`);
  }

  await sendAutomaticRun(window, "-", 7, { expectClear: true });
  const dashClearState = await window.webContents.executeJavaScript(`(() => ({
    pulseCount: Number(document.querySelector(".station-screen")?.dataset.pulseCount || 0),
    decoded: document.querySelector(".station-screen")?.dataset.decoded ?? "",
  }))()`, true);
  if (dashClearState.pulseCount !== 0 || dashClearState.decoded) {
    throw new Error(`Seven-dash clear gesture failed: ${JSON.stringify(dashClearState)}`);
  }
  const markStep = (step) => fs.writeFile(path.join(outputDir, "qa-step.txt"), `${step}\n`, "utf8");
  await markStep("station-listening");

  const playerIdentity = await window.webContents.executeJavaScript(`(() => ({
    player: JSON.parse(localStorage.getItem("game-morse-adventurer.saves.v1"))[0].callsign,
  }))()`, true);
  const partialCall = playerIdentity.player.slice(0, Math.max(2, playerIdentity.player.length - 3));
  await sendAutomaticText(window, `CQ DE ${partialCall} K`);
  await waitFor(window, '[data-action="submit-reply"]:not([disabled])', 10000);
  await click(window, '[data-action="submit-reply"]');
  await waitFor(window, '[data-qso-phase="NPC_REPLY"][data-copy-outcome="query"][data-reply-disposition="query"]', 10000);
  await assertNoNpcPortraitRuntime(window, "npc-query");
  const queryState = await window.webContents.executeJavaScript(`(() => ({
    quality: Number(document.querySelector(".station-screen")?.dataset.cqQuality),
    outcome: document.querySelector(".station-screen")?.dataset.copyOutcome ?? null,
    profile: document.querySelector(".station-screen")?.dataset.operatorProfile ?? null,
    hasContact: document.querySelector(".station-screen")?.dataset.qaHasContact ?? null,
  }))()`, true);
  if (!(queryState.quality > 0 && queryState.quality < 100)
    || queryState.outcome !== "query" || !queryState.profile || queryState.hasContact !== "false") {
    throw new Error(`Imperfect CQ did not produce a safe operator query: ${JSON.stringify(queryState)}`);
  }
  await capture(window, outputDir, shot("qso-npc-query"));
  await waitForFocusedQsoState(
    window,
    '[data-qso-phase="PLAYER_CQ"][data-channel-notice="npcQuery"]',
    { context: "after capturing the NPC CQ query" },
  );

  const cqMessage = `CQCQDE${playerIdentity.player}${playerIdentity.player}PSEK`;
  await sendAutomaticText(window, cqMessage);
  await markStep("cq-keyed");
  await waitFor(window, '[data-action="submit-reply"]:not([disabled])', 10000);
  const cqDebug = await window.webContents.executeJavaScript(`(() => ({
    expected: ${JSON.stringify(cqMessage)},
    consoleText: document.querySelector(".qso-console small")?.textContent ?? "",
    displayText: document.querySelector(".morse-display")?.textContent ?? "",
  }))()`, true);
  await fs.writeFile(path.join(outputDir, "qso-cq-debug.json"), `${JSON.stringify(cqDebug, null, 2)}\n`, "utf8");
  await window.webContents.executeJavaScript(`(() => {
    document.querySelector('[data-action="submit-reply"]')?.click();
    document.querySelector('.station-topbar [data-action="back-home"]')?.click();
  })()`, true);
  await waitFor(window, '[data-testid="qso-leave-dialog"][data-leave-reason="active"][data-leave-destination="home"]');
  await waitFor(window, '[data-qso-phase="WAITING_RESPONSE"][data-receiver-active="false"]');
  const frozenOnAirState = await window.webContents.executeJavaScript(`(() => ({
    phase: document.querySelector(".station-screen")?.dataset.qsoPhase,
    pulses: Number(document.querySelector(".station-screen")?.dataset.pulseCount),
    attempts: Number(document.querySelector(".station-screen")?.dataset.attemptCount),
    logs: JSON.parse(localStorage.getItem("game-morse-adventurer.saves.v1"))[0].qsoLogs.length,
  }))()`, true);
  await delay(220);
  await window.webContents.executeJavaScript(`(() => {
    for (const code of ["KeyZ", "KeyX", "F2", "F3"]) {
      window.dispatchEvent(new KeyboardEvent("keydown", { code, bubbles: true, cancelable: true }));
      window.dispatchEvent(new KeyboardEvent("keyup", { code, bubbles: true, cancelable: true }));
    }
  })()`, true);
  const frozenOnAirAfterDelay = await window.webContents.executeJavaScript(`(() => ({
    phase: document.querySelector(".station-screen")?.dataset.qsoPhase,
    pulses: Number(document.querySelector(".station-screen")?.dataset.pulseCount),
    attempts: Number(document.querySelector(".station-screen")?.dataset.attemptCount),
    logs: JSON.parse(localStorage.getItem("game-morse-adventurer.saves.v1"))[0].qsoLogs.length,
  }))()`, true);
  if (JSON.stringify(frozenOnAirAfterDelay) !== JSON.stringify(frozenOnAirState)) {
    throw new Error(`QSO advanced behind the leave guard: ${JSON.stringify({ frozenOnAirState, frozenOnAirAfterDelay })}`);
  }
  await click(window, '[data-action="cancel-qso-leave"]');
  await waitForMissing(window, '[data-testid="qso-leave-dialog"]');
  await waitForFocusedQsoState(
    window,
    '[data-qso-phase="PLAYER_RST_AND_73"]',
    { context: "after cancelling the active QSO leave guard" },
  );
  await assertNoNpcPortraitRuntime(window, "player-report");
  const firstRecoveryState = await window.webContents.executeJavaScript(`(() => ({
    failures: window.cwgameSystem?.getQaIncomingFailureCount?.() ?? 0,
    recovering: document.querySelector(".station-screen")?.dataset.npcPlaybackRecovering ?? null,
  }))()`, true);
  if (firstRecoveryState.failures !== 1 || firstRecoveryState.recovering !== "false") {
    throw new Error(`First incoming phase did not recover cleanly: ${JSON.stringify(firstRecoveryState)}`);
  }
  const stationIdentity = await window.webContents.executeJavaScript(`(() => ({
    npc: document.querySelector(".station-screen")?.dataset.qaNpcCallsign ?? null,
    player: JSON.parse(localStorage.getItem("game-morse-adventurer.saves.v1"))[0].callsign,
    shownContact: document.querySelector(".contact-card h2")?.textContent.trim() ?? null,
    activeAreaLeaksCallsign: [".contact-card", ".qso-duty-coach", ".morse-display", ".signal-note"]
      .map((selector) => document.querySelector(selector)?.textContent ?? "")
      .join(" ")
      .includes(document.querySelector(".station-screen")?.dataset.qaNpcCallsign ?? "__NO_CALL__"),
  }))()`, true);
  if (!stationIdentity.npc || stationIdentity.shownContact !== "REMOTE" || stationIdentity.activeAreaLeaksCallsign) {
    throw new Error(`Blind-copy screen leaked the remote identity: ${JSON.stringify(stationIdentity)}`);
  }
  await capture(window, outputDir, shot("qso-blind-copy"));
  await markStep(`auto-response-${stationIdentity.npc}-${stationIdentity.player}`);

  await sendAutomaticText(window, "E");
  await waitFor(window, '[data-action="submit-reply"]:not([disabled])', 10000);
  await click(window, '[data-action="submit-reply"]');
  await waitFor(window, '[data-action="clear-and-retry"]', 10000);
  const retainedInvalidReply = await window.webContents.executeJavaScript(`(() => ({
    phase: document.querySelector(".station-screen")?.dataset.qsoPhase ?? null,
    decoded: document.querySelector(".station-screen")?.dataset.decoded ?? "",
    contact: document.querySelector(".contact-card h2")?.textContent.trim() ?? null,
  }))()`, true);
  if (retainedInvalidReply.phase !== "PLAYER_RST_AND_73" || retainedInvalidReply.decoded !== "E" || retainedInvalidReply.contact !== "REMOTE") {
    throw new Error(`Invalid reply was not retained safely: ${JSON.stringify(retainedInvalidReply)}`);
  }
  await capture(window, outputDir, shot("qso-specific-error"));
  await window.webContents.executeJavaScript(`(() => {
    const sample = (label) => {
      const station = document.querySelector(".station-screen");
      const submit = document.querySelector('[data-action="submit-reply"]');
      return {
        label,
        at: performance.now(),
        phase: station?.dataset.qsoPhase ?? null,
        decoded: station?.dataset.decoded ?? null,
        accuracy: document.querySelector(".qso-console small")?.textContent ?? null,
        repeatRequests: station?.dataset.repeatRequests ?? null,
        pulseCount: station?.dataset.pulseCount ?? null,
        submitDisabled: submit?.disabled ?? null,
        clearAndRetry: Boolean(document.querySelector('[data-action="clear-and-retry"]')),
      };
    };
    window.__qaAgnTrace = [sample("before-clear-click")];
    window.__qaAgnLast = JSON.stringify(window.__qaAgnTrace[0]);
    window.__qaAgnSample = sample;
    window.__qaAgnObserver?.disconnect();
    window.__qaAgnObserver = new MutationObserver(() => {
      const next = sample("mutation");
      const signature = JSON.stringify({ ...next, label: undefined, at: undefined });
      if (signature !== window.__qaAgnLast) {
        window.__qaAgnTrace.push(next);
        window.__qaAgnLast = signature;
      }
    });
    window.__qaAgnObserver.observe(document.body, { attributes: true, childList: true, subtree: true });
  })()`, true);
  await click(window, '[data-action="clear-and-retry"]');
  await window.webContents.executeJavaScript('window.__qaAgnTrace.push(window.__qaAgnSample("after-clear-click"))', true);

  await sendAutomaticText(window, "AGN K");
  await waitFor(window, '[data-action="submit-reply"]:not([disabled])', 10000);
  const agnBeforeSubmit = await window.webContents.executeJavaScript(`(async () => ({
    ...window.__qaAgnSample("before-submit"),
    semanticStatus: await window.cwgameSystem?.getSemanticStatus?.(),
  }))()`, true);
  await click(window, '[data-action="submit-reply"]');
  let agnWaitError = null;
  try {
    await waitForFocusedQsoState(
      window,
      '[data-qso-phase="PLAYER_RST_AND_73"][data-repeat-requests="1"]',
      { context: "after requesting an NPC report repeat" },
    );
  } catch (error) {
    agnWaitError = error;
  }
  const agnAfterSubmit = await window.webContents.executeJavaScript(`(async () => {
    window.__qaAgnObserver?.disconnect();
    return {
      current: window.__qaAgnSample("after-submit-wait"),
      trace: window.__qaAgnTrace,
      semanticStatus: await window.cwgameSystem?.getSemanticStatus?.(),
    };
  })()`, true);
  await fs.writeFile(path.join(outputDir, "qso-agn-debug.json"), `${JSON.stringify({
    expected: "AGN K", beforeSubmit: agnBeforeSubmit, afterSubmit: agnAfterSubmit,
  }, null, 2)}\n`, "utf8");
  if (agnWaitError) throw agnWaitError;
  const repeatedIncoming = await window.webContents.executeJavaScript(`(() => ({
    npc: document.querySelector(".station-screen")?.dataset.qaNpcCallsign ?? null,
    repeatRequests: Number(document.querySelector(".station-screen")?.dataset.repeatRequests),
    contact: document.querySelector(".contact-card h2")?.textContent.trim() ?? null,
  }))()`, true);
  if (repeatedIncoming.npc !== stationIdentity.npc || repeatedIncoming.repeatRequests !== 1 || repeatedIncoming.contact !== "REMOTE") {
    throw new Error(`AGN K did not replay the same hidden station: ${JSON.stringify(repeatedIncoming)}`);
  }
  await capture(window, outputDir, shot("qso-agn-repeat"));
  await sendAutomaticText(window, `${stationIdentity.npc} DE ${stationIdentity.player} RST 559 73 K`);
  await waitFor(window, '[data-action="submit-reply"]:not([disabled])', 10000);
  const secondReplyDebug = await window.webContents.executeJavaScript(`(() => ({
    expected: ${JSON.stringify(`${stationIdentity.npc} DE ${stationIdentity.player} RST 559 73 K`)},
    consoleText: document.querySelector(".qso-console small")?.textContent ?? "",
    displayText: document.querySelector(".morse-display")?.textContent ?? "",
  }))()`, true);
  await fs.writeFile(path.join(outputDir, "qso-second-reply-debug.json"), `${JSON.stringify(secondReplyDebug, null, 2)}\n`, "utf8");
  await click(window, '[data-action="submit-reply"]');
  const secondReplyPhase = await waitForQsoSubmitDecision(window);
  if (secondReplyPhase === "PLAYER_RST_AND_73") {
    await click(window, '[data-action="clear-input"]');
    await sendAutomaticText(window, `${stationIdentity.npc} DE ${stationIdentity.player} RST 559 73 K`);
    await waitFor(window, '[data-action="submit-reply"]:not([disabled])', 10000);
    await click(window, '[data-action="submit-reply"]');
  }
  await waitForFocusedQsoState(
    window,
    '[data-qso-phase="PLAYER_OPTIONAL_ANSWER"], .qso-result-modal.success',
    { context: "while receiving the optional NPC question", timeout: 30_000 },
  );
  await assertNoNpcPortraitRuntime(window, "optional-exchange");
  const optionalExchangeQa = await window.webContents.executeJavaScript(`(() => {
    const station = document.querySelector(".station-screen");
    return {
      phase: station?.dataset.qsoPhase ?? null,
      question: station?.dataset.optionalExchangeQuestion ?? null,
      outcome: station?.dataset.optionalExchangeOutcome ?? null,
      repeats: Number(station?.dataset.optionalExchangeRepeats),
      replyWpm: Number(station?.dataset.replyWpm),
    };
  })()`, true);
  if (optionalExchangeQa.phase !== "PLAYER_OPTIONAL_ANSWER"
    || !["power", "location", "weather", "name", "age"].includes(optionalExchangeQa.question)
    || optionalExchangeQa.outcome !== "pending" || optionalExchangeQa.repeats !== 0) {
    throw new Error(`QA responder did not enter a valid optional exchange: ${JSON.stringify(optionalExchangeQa)}`);
  }
  await capture(window, outputDir, shot("qso-optional-query"));
  await sendAutomaticText(window, "QRS K");
  await waitFor(window, '[data-action="submit-reply"]:not([disabled])', 10000);
  await click(window, '[data-action="submit-reply"]');
  await waitForFocusedQsoState(
    window,
    '[data-qso-phase="PLAYER_OPTIONAL_ANSWER"][data-optional-exchange-repeats="1"]',
    { context: "after requesting the optional question more slowly", timeout: 30_000 },
  );
  await assertNoNpcPortraitRuntime(window, "optional-qrs-replay");
  const replayedOptionalQuestion = await window.webContents.executeJavaScript(`(() => {
    const station = document.querySelector(".station-screen");
    return {
      question: station?.dataset.optionalExchangeQuestion ?? null,
      replyWpm: Number(station?.dataset.replyWpm),
    };
  })()`, true);
  const expectedSlowerWpm = optionalExchangeQa.replyWpm > 5
    ? replayedOptionalQuestion.replyWpm < optionalExchangeQa.replyWpm
    : replayedOptionalQuestion.replyWpm === 5;
  if (replayedOptionalQuestion.question !== optionalExchangeQa.question || !expectedSlowerWpm) {
    throw new Error(`Optional QRS K did not preserve and slow the question: ${JSON.stringify({ optionalExchangeQa, replayedOptionalQuestion })}`);
  }
  const optionalAnswerText = ({
    power: "PWR 4321 W K",
    location: "QTH PRIVATE RIDGE K",
    weather: "WX PRIVATE K",
    name: "NAME PRIVATE K",
    age: "AGE 117 K",
  })[optionalExchangeQa.question];
  await sendAutomaticText(window, optionalAnswerText);
  await waitFor(window, '[data-action="submit-reply"]:not([disabled])', 10000);
  await click(window, '[data-action="submit-reply"]');
  await waitForFocusedQsoState(
    window,
    ".qso-result-modal.success",
    { context: "while receiving the closing 73 and SK", timeout: 30_000 },
  );
  await assertNoNpcPortraitRuntime(window, "qso-complete");
  await waitFor(window, ".qso-operation-review");
  await waitFor(window, ".qso-attempt-history > li.accepted");
  await waitFor(window, ".qso-attempt-history > li.transmitted");
  await waitFor(window, ".qso-attempt-history > li.error");
  await waitFor(window, ".qso-attempt-history > li.repeat");
  const recoveredIncomingState = await window.webContents.executeJavaScript(`(() => ({
    failures: window.cwgameSystem?.getQaIncomingFailureCount?.() ?? 0,
    recovering: document.querySelector(".station-screen")?.dataset.npcPlaybackRecovering ?? null,
    phase: document.querySelector(".station-screen")?.dataset.qsoPhase ?? null,
  }))()`, true);
  if (recoveredIncomingState.failures !== 3 || recoveredIncomingState.recovering !== "false"
    || recoveredIncomingState.phase !== "QSO_COMPLETE") {
    throw new Error(`Expected both incoming phases to recover cleanly: ${JSON.stringify(recoveredIncomingState)}`);
  }
  await fs.writeFile(path.join(outputDir, "incoming-recovery-debug.json"), `${JSON.stringify({ firstRecoveryState, recoveredIncomingState }, null, 2)}\n`, "utf8");
  await capture(window, outputDir, shot("qso-result-unsaved-warmup"));
  await capture(window, outputDir, shot("qso-result-unsaved"));
  await click(window, '[data-action="leave-unsaved-qso"]');
  await waitFor(window, '[data-testid="qso-leave-dialog"][data-leave-reason="unsaved"][data-leave-destination="home"]');
  await capture(window, outputDir, shot("qso-leave-unsaved"));
  await click(window, '[data-action="cancel-qso-leave"]');
  await waitForMissing(window, '[data-testid="qso-leave-dialog"]');
  const resultReviewState = await window.webContents.executeJavaScript(`(() => ({
    accepted: document.querySelectorAll(".qso-attempt-history > li.accepted").length,
    transmitted: document.querySelectorAll(".qso-attempt-history > li.transmitted").length,
    errors: document.querySelectorAll(".qso-attempt-history > li.error").length,
    repeats: document.querySelectorAll(".qso-attempt-history > li.repeat").length,
    reward: document.querySelector(".qso-result-rewards strong")?.textContent.replace(/\\s+/g, " ").trim() ?? "",
    rewardVersion: document.querySelector(".qso-result-rewards .qso-reward-breakdown")?.dataset.rewardVersion ?? null,
    rewards: Object.fromEntries([...document.querySelectorAll(".qso-result-rewards [data-reward]")].map((row) => [
      row.dataset.reward,
      Number((row.querySelector("dd")?.textContent ?? "").replace(/[^0-9.-]/g, "")),
    ])),
  }))()`, true);
  const previewRewardParts = ["base", "independentWatch", "weakSignal", "newRegion", "newDistanceRecord"]
    .reduce((total, key) => total + Number(resultReviewState.rewards[key] ?? 0), 0);
  if (resultReviewState.accepted < 2 || resultReviewState.transmitted < 1 || resultReviewState.errors < 1 || resultReviewState.repeats < 1
    || resultReviewState.rewardVersion !== "1" || resultReviewState.rewards.base !== 100
    || resultReviewState.rewards.independentWatch !== undefined
    || previewRewardParts !== resultReviewState.rewards.total
    || !resultReviewState.reward.includes(`+${resultReviewState.rewards.total}`)) {
    throw new Error(`Full-guidance operation review or reward is incomplete: ${JSON.stringify(resultReviewState)}`);
  }
  await capture(window, outputDir, shot("qso-operation-review"));
  await click(window, ".qso-result-primary");
  await waitFor(window, ".qso-result-modal.success header .icon-button", 10000);
  await waitFor(window, '[data-testid="achievement-notification"][data-achievement-id="qso-5"]', 10000);
  const achievementNotificationState = await window.webContents.executeJavaScript(`(() => ({
    visible: document.querySelectorAll('[data-testid="achievement-notification"]').length,
    id: document.querySelector('[data-testid="achievement-notification"]')?.dataset.achievementId ?? null,
    queueSize: Number(document.querySelector('[data-testid="achievement-notification"]')?.dataset.achievementQueueSize),
    appearances: (window.__qaAchievementEvents ?? []).filter((id) => id === "qso-5").length,
    totalQsos: Number(JSON.parse(localStorage.getItem("game-morse-adventurer.saves.v1"))[0].qsoRecords?.total),
  }))()`, true);
  if (achievementNotificationState.visible !== 1 || achievementNotificationState.id !== "qso-5"
    || achievementNotificationState.queueSize < 1 || achievementNotificationState.appearances !== 1
    || achievementNotificationState.totalQsos !== 5) {
    throw new Error(`The qso-5 unlock notification was not queued exactly once: ${JSON.stringify(achievementNotificationState)}`);
  }
  await capture(window, outputDir, shot("achievement-qso-5-unlocked"));
  await click(window, '[data-action="dismiss-achievement-notification"]');
  await waitForMissing(window, '[data-testid="achievement-notification"][data-achievement-id="qso-5"]');
  for (let index = 0; index < 6; index += 1) {
    const hasQueuedNotification = await window.webContents.executeJavaScript(
      'Boolean(document.querySelector(\'[data-testid="achievement-notification"]\'))',
      true,
    );
    if (!hasQueuedNotification) break;
    await click(window, '[data-action="dismiss-achievement-notification"]');
    await delay(80);
  }
  await waitForMissing(window, '[data-testid="achievement-notification"]');
  await delay(250);
  const dismissedAchievementState = await window.webContents.executeJavaScript(`(() => ({
    visible: document.querySelectorAll('[data-testid="achievement-notification"]').length,
    appearances: (window.__qaAchievementEvents ?? []).filter((id) => id === "qso-5").length,
  }))()`, true);
  if (dismissedAchievementState.visible !== 0 || dismissedAchievementState.appearances !== 1) {
    throw new Error(`Dismissed qso-5 notification reappeared: ${JSON.stringify(dismissedAchievementState)}`);
  }
  const saveBeforeRepeatedF3 = await window.webContents.executeJavaScript(
    'localStorage.getItem("game-morse-adventurer.saves.v1")',
    true,
  );
  await window.webContents.executeJavaScript(`window.dispatchEvent(new KeyboardEvent("keydown", {
    code: "F3", key: "F3", bubbles: true, cancelable: true,
  }))`, true);
  await delay(120);
  const saveAfterRepeatedF3 = await window.webContents.executeJavaScript(
    'localStorage.getItem("game-morse-adventurer.saves.v1")',
    true,
  );
  if (saveAfterRepeatedF3 !== saveBeforeRepeatedF3) {
    throw new Error("Repeated F3 changed the save after the completed QSO was already settled.");
  }
  const savedEquipmentSnapshot = await window.webContents.executeJavaScript(
    `(() => {
      const save = JSON.parse(localStorage.getItem("game-morse-adventurer.saves.v1"))[0];
      const entry = save.qsoLogs[0];
      return {
        id: entry.id,
        version: entry.version,
        accessoryId: entry.accessoryId,
        equipmentId: entry.equipmentId,
        repeatRequests: entry.repeatRequests,
        copyQueries: entry.copyQueries,
        cqQuality: entry.cqQuality,
        copyScore: entry.copyScore,
        copyOutcome: entry.copyOutcome,
        operatorProfileId: entry.operatorProfileId,
        operatorProfileRevision: entry.operatorProfileRevision,
        remoteWpm: entry.remoteWpm,
        optionalExchangeQuestion: entry.optionalExchangeQuestion,
        optionalExchangeOutcome: entry.optionalExchangeOutcome,
        optionalExchangeRepeatRequests: entry.optionalExchangeRepeatRequests,
        attemptMessages: (entry.attemptHistory ?? []).map((attempt) => attempt.message),
        transmitAccuracy: entry.transmitAccuracy,
        guidanceLevel: entry.guidanceLevel,
        visualAssistUsed: entry.visualAssistUsed,
        independentWatch: entry.independentWatch,
        moneyAwarded: entry.credits,
        rewardBreakdown: entry.rewardBreakdown,
        location: entry.location,
        distanceKm: entry.distanceKm,
        finalPropagationLevel: entry.finalPropagationLevel,
        saveMoney: save.money,
        attemptResults: (entry.attemptHistory ?? []).map((attempt) => attempt.result),
        attemptMetricsComplete: (entry.attemptHistory ?? []).every((attempt) =>
          Number.isFinite(attempt.wpm) && Number.isFinite(attempt.accuracy) && Number.isFinite(attempt.rhythm)),
        firstWatchCompleted: save.firstWatchCompleted,
        totalQsos: save.qsoRecords?.total,
        relationship: save.operatorRelationships?.find(({ callsign }) => callsign === entry.callsign) ?? null,
      };
    })()`,
    true,
  );
  const savedAttemptResults = new Set(savedEquipmentSnapshot.attemptResults);
  const savedAttemptMessages = savedEquipmentSnapshot.attemptMessages ?? [];
  const optionalPrivacyValid = savedEquipmentSnapshot.optionalExchangeQuestion === optionalExchangeQa.question
    && savedEquipmentSnapshot.optionalExchangeOutcome === "answered"
    && savedEquipmentSnapshot.optionalExchangeRepeatRequests === 1
    && savedAttemptMessages.includes("OPTIONAL RESPONSE REDACTED")
    && !savedAttemptMessages.some((message) => String(message).includes(optionalAnswerText));
  const savedReward = savedEquipmentSnapshot.rewardBreakdown ?? {};
  const savedRewardTotal = ["base", "independentWatch", "weakSignal", "newRegion", "newDistanceRecord"]
    .reduce((total, key) => total + Number(savedReward[key] ?? 0), 0);
  const expectedWeakSignalReward = Number(savedEquipmentSnapshot.finalPropagationLevel) <= 2 ? 75 : 0;
  const expectedNewRegionReward = ["AS-JA", "EU-W"].includes(savedEquipmentSnapshot.location) ? 0 : 20;
  const expectedDistanceReward = Number(savedEquipmentSnapshot.distanceKm) > 9568.2 ? 25 : 0;
  if (savedEquipmentSnapshot.version !== QA_QSO_LOG_VERSION
    || savedEquipmentSnapshot.accessoryId !== "cw-filter-500" || savedEquipmentSnapshot.equipmentId !== "usdr-8"
    || savedEquipmentSnapshot.repeatRequests !== 2 || savedEquipmentSnapshot.copyQueries !== 1
    || !optionalPrivacyValid
    || !Number.isFinite(savedEquipmentSnapshot.cqQuality) || !Number.isFinite(savedEquipmentSnapshot.copyScore)
    || savedEquipmentSnapshot.copyOutcome !== "copied" || !savedEquipmentSnapshot.operatorProfileId
    || savedEquipmentSnapshot.operatorProfileRevision !== 4 || !Number.isFinite(savedEquipmentSnapshot.remoteWpm)
    || !Number.isFinite(savedEquipmentSnapshot.transmitAccuracy)
    || savedEquipmentSnapshot.guidanceLevel !== "full" || savedEquipmentSnapshot.visualAssistUsed !== true
    || savedEquipmentSnapshot.independentWatch !== false || savedReward.version !== 1
    || savedReward.base !== 100 || savedReward.independentWatch !== 0
    || savedReward.weakSignal !== expectedWeakSignalReward
    || savedReward.newRegion !== expectedNewRegionReward
    || savedReward.newDistanceRecord !== expectedDistanceReward
    || savedRewardTotal !== savedReward.total || savedEquipmentSnapshot.moneyAwarded !== savedReward.total
    || savedEquipmentSnapshot.saveMoney !== 900 + savedReward.total + 250
    || !savedAttemptResults.has("accepted") || !savedAttemptResults.has("transmitted")
    || !savedAttemptResults.has("rejected") || !savedAttemptResults.has("repeat")
    || !savedEquipmentSnapshot.attemptMetricsComplete
    || savedEquipmentSnapshot.firstWatchCompleted !== true || savedEquipmentSnapshot.totalQsos !== 5) {
    throw new Error(`QSO log v${QA_QSO_LOG_VERSION} lost its review, operator, copy, reward, or equipment snapshot: ${JSON.stringify(savedEquipmentSnapshot)}`);
  }
  if (savedEquipmentSnapshot.relationship?.lastQsoId !== savedEquipmentSnapshot.id
    || savedEquipmentSnapshot.relationship?.completedQsos < 1 || savedEquipmentSnapshot.relationship?.encounterCount < 1) {
    throw new Error(`QSO relationship was not settled with the log: ${JSON.stringify(savedEquipmentSnapshot.relationship)}`);
  }
  await capture(window, outputDir, shot("qso-result-saved"));
  await click(window, ".qso-result-modal.success header .icon-button");

  await click(window, '.station-topbar .top-actions [data-action="back-home"]');
  await waitFor(window, ".home-screen");
  await click(window, ".hotspot-log");
  await waitFor(window, ".qso-log-modal");
  await waitFor(window, ".qso-log-records button:nth-of-type(3)", 10000);
  await waitFor(window, ".qso-log-review");
  await waitFor(window, ".qso-log-review li.accepted");
  await waitFor(window, ".qso-log-review li.transmitted");
  await waitFor(window, ".qso-log-review li.error");
  await waitFor(window, ".qso-log-review li.repeat");
  await waitFor(window, '.qso-log-detail .qso-reward-breakdown[data-reward-version="1"]');
  await capture(window, outputDir, shot("home-log-after-qso-warmup"));
  await capture(window, outputDir, shot("home-log-after-qso"));
  const homeReviewState = await window.webContents.executeJavaScript(`(() => ({
    accepted: document.querySelectorAll(".qso-log-review li.accepted").length,
    transmitted: document.querySelectorAll(".qso-log-review li.transmitted").length,
    errors: document.querySelectorAll(".qso-log-review li.error").length,
    repeats: document.querySelectorAll(".qso-log-review li.repeat").length,
    rewardTotal: Number((document.querySelector('.qso-log-detail [data-reward="total"] dd')?.textContent ?? "").replace(/[^0-9.-]/g, "")),
    loggedCredits: Number((document.querySelector(".qso-log-credit-fact dd")?.textContent ?? "").replace(/[^0-9.-]/g, "")),
  }))()`, true);
  if (homeReviewState.accepted < 2 || homeReviewState.transmitted < 1 || homeReviewState.errors < 1 || homeReviewState.repeats < 1
    || homeReviewState.rewardTotal !== homeReviewState.loggedCredits
    || homeReviewState.rewardTotal !== savedReward.total) {
    throw new Error(`Home log operation review is incomplete: ${JSON.stringify(homeReviewState)}`);
  }
  await capture(window, outputDir, shot("home-log-operation-review"));
  await click(window, ".qso-log-return");
  await waitForMissing(window, ".qso-log-modal");
  await waitFor(window, ".home-screen");
  await clickAt(window, ".hotspot-station");
  await waitForStationAfterLog(window);

  await click(window, ".map-preview");
  await waitFor(window, ".map-modal");
  await capture(window, outputDir, shot("propagation-map"));
  await click(window, ".map-mode-buttons button:first-child");
  await waitFor(window, '[data-map-mode="world"]');
  await capture(window, outputDir, shot("world-map"));

  await click(window, ".map-modal header .icon-button");
  await waitForMissing(window, ".map-modal");
  await click(window, '.station-topbar .top-actions [data-action="back-home"]');
  await waitFor(window, ".home-screen");
  const moneyBeforeMissionClaim = await window.webContents.executeJavaScript(
    'JSON.parse(localStorage.getItem("game-morse-adventurer.saves.v1"))[0].money',
    true,
  );
  await click(window, '[data-action="open-missions"]');
  await waitFor(window, '[data-mission-id="story-01"][data-mission-status="ready"]');
  await waitFor(window, '[data-mission-id="story-01"] [data-mission-narrative="debrief"]');
  await click(window, '[data-action="claim-mission"][data-mission-action-id="story-01"]');
  await waitFor(window, '[data-mission-id="story-01"][data-mission-status="claimed"]');
  const claimedMissionState = await window.webContents.executeJavaScript(`(() => {
    const save = JSON.parse(localStorage.getItem("game-morse-adventurer.saves.v1"))[0];
    return {
      money: save.money,
      active: save.missionState?.activeMissions?.map(({ id }) => id) ?? [],
      claimed: save.missionState?.claimedMissionIds ?? [],
      history: save.missionState?.history ?? [],
    };
  })()`, true);
  if (claimedMissionState.money !== moneyBeforeMissionClaim + 150
    || claimedMissionState.active.includes("story-01")
    || !claimedMissionState.claimed.includes("story-01")
    || claimedMissionState.history.filter(({ id }) => id === "story-01").length !== 1) {
    throw new Error(`Mission reward was not atomic: ${JSON.stringify({ moneyBeforeMissionClaim, claimedMissionState })}`);
  }
  await capture(window, outputDir, shot("mission-story-claimed"));
  await click(window, '[data-action="close-missions-footer"]');
  await waitForMissing(window, '[data-testid="mission-center-modal"]');

  await window.reload();
  await waitFor(window, ".start-screen");
  await delay(350);
  const finalReloadState = await window.webContents.executeJavaScript(`(() => {
    const save = JSON.parse(localStorage.getItem("game-morse-adventurer.saves.v1"))[0];
    return {
      totalQsos: Number(save.qsoRecords?.total),
      practiceAttempts: Number(save.practiceRecords?.["character-rx"]?.attempts),
      practiceCorrect: Number(save.practiceRecords?.["character-rx"]?.correct),
      practiceDifficulty: save.practiceRecords?.["character-rx"]?.difficulty ?? null,
      practiceLesson: Number(save.practiceRecords?.["character-rx"]?.lesson),
      practiceLessonsCompleted: Number(save.practiceRecords?.["character-rx"]?.completedLessons),
      practiceLessonAttempts: Number(save.practiceRecords?.["character-rx"]?.lessonAttempts),
      practiceLessonCorrect: Number(save.practiceRecords?.["character-rx"]?.lessonCorrect),
      practiceWeakness: Number(save.practiceRecords?.["character-rx"]?.weaknesses?.[${JSON.stringify(wrongPracticeTarget)}] ?? 0),
      callsignRegion: save.practiceRecords?.["callsign-rx"]?.callsignRegion ?? null,
      callsignAttempts: Number(save.practiceRecords?.["callsign-rx"]?.attempts),
      callsignCorrect: Number(save.practiceRecords?.["callsign-rx"]?.correct),
      callsignLesson: Number(save.practiceRecords?.["callsign-rx"]?.lesson),
      callsignLessonsCompleted: Number(save.practiceRecords?.["callsign-rx"]?.completedLessons),
      callsignLessonAttempts: Number(save.practiceRecords?.["callsign-rx"]?.lessonAttempts),
      callsignLessonCorrect: Number(save.practiceRecords?.["callsign-rx"]?.lessonCorrect),
      notificationCount: document.querySelectorAll('[data-testid="achievement-notification"]').length,
      liveRegionCount: document.querySelectorAll('.achievement-notification-region[role="status"][aria-live="polite"]').length,
      missionClaimed: save.missionState?.claimedMissionIds?.includes("story-01") === true,
      missionActive: save.missionState?.activeMissions?.some(({ id }) => id === "story-01") === true,
      missionHistoryCount: save.missionState?.history?.filter(({ id }) => id === "story-01").length ?? 0,
    };
  })()`, true);
  if (finalReloadState.totalQsos !== 5 || finalReloadState.practiceAttempts !== 10
    || finalReloadState.practiceCorrect !== 9
    || finalReloadState.practiceDifficulty !== "guided"
    || finalReloadState.practiceLesson !== 2 || finalReloadState.practiceLessonsCompleted !== 1
    || finalReloadState.practiceLessonAttempts !== 0 || finalReloadState.practiceLessonCorrect !== 0
    || finalReloadState.practiceWeakness !== 0
    || finalReloadState.callsignRegion !== "japan"
    || finalReloadState.callsignAttempts !== 1 || finalReloadState.callsignCorrect !== 1
    || finalReloadState.callsignLesson !== 1 || finalReloadState.callsignLessonsCompleted !== 0
    || finalReloadState.callsignLessonAttempts !== 1 || finalReloadState.callsignLessonCorrect !== 1
    || finalReloadState.notificationCount !== 0 || finalReloadState.liveRegionCount !== 1
    || !finalReloadState.missionClaimed || finalReloadState.missionActive || finalReloadState.missionHistoryCount !== 1) {
    throw new Error(`Reload repeated an unlock or lost durable records: ${JSON.stringify(finalReloadState)}`);
  }
  await capture(window, outputDir, shot("reload-without-achievement-repeat"));
    }
    if (scope === "qso") return finishScope({ practiceWrongTarget: wrongPracticeTarget });

    if (scope === "expedition") {
      async function leaveExpeditionToHome() {
        await click(window, '[data-action="expedition-back"]');
        const destination = await window.webContents.executeJavaScript(`new Promise((resolve, reject) => {
          const started = Date.now();
          const timer = setInterval(() => {
            if (document.querySelector(".home-screen")) { clearInterval(timer); resolve("home"); }
            else if (document.querySelector('[data-action="expedition-confirm-leave"]')) { clearInterval(timer); resolve("confirm"); }
            else if (Date.now() - started > 10000) { clearInterval(timer); reject(new Error("Expedition leave did not expose Home or confirmation")); }
          }, 20);
        })`, true);
        if (destination === "confirm") await click(window, '[data-action="expedition-confirm-leave"]');
        await waitFor(window, ".home-screen");
      }

      await window.webContents.executeJavaScript(`(() => {
        const key = "game-morse-adventurer.saves.v1";
        const saves = JSON.parse(localStorage.getItem(key) || "[]");
        const activeId = localStorage.getItem("game-morse-adventurer.active-save.v1");
        const save = saves.find((candidate) => candidate.id === activeId);
        if (!save) throw new Error("Missing active expedition QA save");
        save.missionState = save.missionState || {};
        save.missionState.claimedMissionIds = ["story-01", "story-02", "story-03", "story-04", "story-05"];
        save.missionState.activeMissions = [];
        save.expeditionState = {
          version: 1, activeRun: null, settledRunIds: [], completedRuns: [],
          settledQsoProofs: [], expeditionTreeUnlocked: false,
        };
        save.qslRecordsVersion = 1;
        save.qslRecords = [];
        localStorage.setItem(key, JSON.stringify(saves));
      })()`, true);
      await window.reload();
      await waitFor(window, ".start-screen");
      await click(window, ".menu-primary");
      await waitFor(window, ".save-select-screen");
      await click(window, ".save-primary-action");
      await waitFor(window, ".home-screen");
      await click(window, '[data-action="open-missions"]');
      await waitFor(window, '[data-mission-id="story-06"][data-mission-status="available"]');
      await click(window, '[data-action="accept-mission"][data-mission-action-id="story-06"]');
      await waitFor(window, '[data-mission-id="story-06"][data-mission-status="active"]');
      await capture(window, outputDir, shot("expedition-mission-available"));
      await click(window, '[data-action="launch-expedition-story"]');
      await waitFor(window, '[data-testid="expedition-screen"][data-expedition-phase="site-selection"]');
      await capture(window, outputDir, shot("expedition-site"));

      await click(window, '[data-action="expedition-select-site"][data-site-id="sunward-hill"]');
      await waitFor(window, '[data-testid="expedition-screen"][data-expedition-phase="setup"]');
      const setupRunFixture = await window.webContents.executeJavaScript(
        'JSON.parse(JSON.stringify(JSON.parse(localStorage.getItem("game-morse-adventurer.saves.v1"))[0].expeditionState.activeRun))', true,
      );
      await click(window, '[data-action="expedition-setup-wrong"]');
      await waitFor(window, '[data-testid="expedition-screen"][data-expedition-phase="setup"]');
      const penalty = await window.webContents.executeJavaScript(`(() => {
        const save = JSON.parse(localStorage.getItem("game-morse-adventurer.saves.v1"))[0];
        const run = save.expeditionState.activeRun;
        return { mistakes: run.setupMistakes, elapsedMilliseconds: run.elapsedMilliseconds, remainingWh: run.power.remainingWh };
      })()`, true);
      if (penalty.mistakes !== 1 || penalty.elapsedMilliseconds < 30000 || penalty.remainingWh >= 12) {
        throw new Error(`Expedition setup penalty was not durable: ${JSON.stringify(penalty)}`);
      }
      await capture(window, outputDir, shot("expedition-setup-penalty"));
      await click(window, '[data-action="expedition-setup-antenna"]');
      await click(window, '[data-action="expedition-setup-power"]');
      await waitFor(window, '[data-testid="expedition-screen"][data-expedition-phase="ready"]');
      await capture(window, outputDir, shot("expedition-ready"));

      await pressKey(window, { key: "Escape", code: "Escape" });
      await waitFor(window, ".settings-modal");
      await waitFor(window, '[data-testid="expedition-screen"][data-expedition-paused="true"]');
      const pausedElapsed = await window.webContents.executeJavaScript(
        'Number(document.querySelector("[data-testid=expedition-screen]")?.dataset.expeditionElapsedMs)', true,
      );
      await delay(1000);
      const elapsedDuringPause = await window.webContents.executeJavaScript(
        'Number(document.querySelector("[data-testid=expedition-screen]")?.dataset.expeditionElapsedMs)', true,
      );
      await pressKey(window, { key: "Escape", code: "Escape" });
      await waitForMissing(window, ".settings-modal");
      await focusQaWindow(window, "after closing expedition settings");
      await waitFor(window, '[data-testid="expedition-screen"][data-expedition-window-active="true"][data-expedition-paused="false"]');
      const resumedElapsed = await window.webContents.executeJavaScript(`new Promise((resolve, reject) => {
        const baseline = ${JSON.stringify(pausedElapsed)};
        const started = Date.now();
        const timer = setInterval(() => {
          const elapsed = Number(document.querySelector("[data-testid=expedition-screen]")?.dataset.expeditionElapsedMs);
          if (elapsed > baseline) { clearInterval(timer); resolve(elapsed); }
          else if (Date.now() - started > 3000) { clearInterval(timer); reject(new Error("Expedition timer did not resume")); }
        }, 20);
      })`, true);
      const resumedDelta = resumedElapsed - pausedElapsed;
      const timerPausedWithoutCatchUp = Number.isFinite(pausedElapsed)
        && elapsedDuringPause === pausedElapsed && resumedDelta > 0 && resumedDelta < 750;
      if (!timerPausedWithoutCatchUp) {
        throw new Error(`Expedition pause/resume charged hidden time: ${JSON.stringify({ pausedElapsed, elapsedDuringPause, resumedElapsed, resumedDelta })}`);
      }

      const readyRunFixture = await window.webContents.executeJavaScript(
        'JSON.parse(JSON.stringify(JSON.parse(localStorage.getItem("game-morse-adventurer.saves.v1"))[0].expeditionState.activeRun))', true,
      );
      await leaveExpeditionToHome();
      async function reopenExpeditionWithRun(fixture) {
        await window.webContents.executeJavaScript(`(() => {
          const key = "game-morse-adventurer.saves.v1";
          const saves = JSON.parse(localStorage.getItem(key));
          const activeId = localStorage.getItem("game-morse-adventurer.active-save.v1");
          const save = saves.find((candidate) => candidate.id === activeId);
          if (!save) throw new Error("Missing active expedition fixture save");
          save.expeditionState.activeRun = ${JSON.stringify(fixture)};
          localStorage.setItem(key, JSON.stringify(saves));
        })()`, true);
        await window.reload();
        await waitFor(window, ".start-screen");
        await click(window, ".menu-primary");
        await waitFor(window, ".save-select-screen");
        await click(window, ".save-primary-action");
        await waitFor(window, ".home-screen");
        await click(window, '[data-action="open-missions"]');
        await waitFor(window, '[data-mission-id="story-06"][data-mission-status="active"]');
        await click(window, '[data-action="launch-expedition-story"]');
        await waitFor(window, '[data-testid="expedition-screen"]');
        await focusQaWindow(window, "before expedition timer evidence");
        await waitFor(window, '[data-testid="expedition-screen"][data-expedition-window-active="true"][data-expedition-paused="false"]');
      }

      const timeoutFixture = JSON.parse(JSON.stringify(readyRunFixture));
      timeoutFixture.elapsedMilliseconds = 899500;
      timeoutFixture.elapsedSeconds = 899;
      await reopenExpeditionWithRun(timeoutFixture);
      await waitFor(window, '[data-testid="expedition-screen"][data-expedition-phase="failed"][data-expedition-failure-reason="TIMED_OUT"]');
      const timeoutReachable = await window.webContents.executeJavaScript(
        'document.querySelector("[data-testid=expedition-screen]")?.dataset.expeditionFailureReason === "TIMED_OUT"', true,
      );
      if (!timeoutReachable) throw new Error("Expedition real UI timer did not reach TIMED_OUT");
      await leaveExpeditionToHome();

      await reopenExpeditionWithRun(setupRunFixture);
      await waitFor(window, '[data-testid="expedition-screen"][data-expedition-phase="setup"]');
      await click(window, '[data-action="expedition-setup-antenna"]');
      for (let mistake = 0; mistake < 3; mistake += 1) {
        await click(window, '[data-action="expedition-setup-wrong"]');
        if (mistake < 2) {
          await waitFor(window, `[data-testid="expedition-screen"][data-expedition-phase="setup"][data-expedition-setup-mistakes="${mistake + 1}"]`);
        }
      }
      await waitFor(window, '[data-testid="expedition-screen"][data-expedition-phase="failed"][data-expedition-failure-reason="POWER_DEPLETED"]');
      const powerDepletedReachable = await window.webContents.executeJavaScript(
        'document.querySelector("[data-testid=expedition-screen]")?.dataset.expeditionFailureReason === "POWER_DEPLETED"', true,
      );
      if (!powerDepletedReachable) throw new Error("Expedition legal power-setup path did not reach POWER_DEPLETED");
      await leaveExpeditionToHome();

      await reopenExpeditionWithRun(readyRunFixture);
      await waitFor(window, '[data-testid="expedition-screen"][data-expedition-phase="ready"]');
      await click(window, '[data-action="expedition-call-cq"]');
      await waitFor(window, '[data-testid="expedition-screen"][data-expedition-phase="calling"]');
      await capture(window, outputDir, shot("expedition-calling"));
      await click(window, '[data-action="expedition-receive-reply"]');
      await waitFor(window, '[data-testid="expedition-screen"][data-expedition-phase="exchange"]');
      await setInputValue(window, ".expedition-exchange input", "QTH WRONG PWR 5W ANT WIRE");
      await click(window, '[data-action="expedition-send-exchange"]');
      await waitFor(window, '[data-testid="expedition-screen"][data-expedition-phase="recovering"]');
      await capture(window, outputDir, shot("expedition-recovering"));
      await click(window, '[data-action="expedition-agn"]');
      await waitFor(window, '[data-testid="expedition-screen"][data-expedition-phase="exchange"]');
      await setInputValue(window, ".expedition-exchange input", "PSE QTH SUNWARD PWR 5W ANT WIRE K");
      await click(window, '[data-action="expedition-send-exchange"]');
      await waitFor(window, '[data-testid="expedition-screen"][data-expedition-phase="completed"]');
      await capture(window, outputDir, shot("expedition-result"));
      await click(window, '[data-action="expedition-settle"]');
      const settledState = await window.webContents.executeJavaScript(`new Promise((resolve, reject) => {
        const started = Date.now();
        const timer = setInterval(() => {
          const save = JSON.parse(localStorage.getItem("game-morse-adventurer.saves.v1"))[0];
          const qsl = save.qslRecords?.[0];
          const relationship = save.operatorRelationships?.find((item) => item.personId === "person:sora");
          if (save.expeditionState?.settledRunIds?.length === 1 && qsl && relationship) {
            clearInterval(timer); resolve({
              qsl, relationship, completedRuns: save.expeditionState.completedRuns,
              activeRun: save.expeditionState.activeRun,
            });
          } else if (Date.now() - started > 10000) {
            clearInterval(timer); reject(new Error("Expedition settlement did not persist"));
          }
        }, 50);
      })`, true);
      if (settledState.activeRun !== null || settledState.completedRuns.length !== 1
        || settledState.qsl.personId !== "person:sora" || settledState.relationship.personId !== "person:sora") {
        throw new Error(`Expedition settlement linkage is incomplete: ${JSON.stringify(settledState)}`);
      }
      await capture(window, outputDir, shot("expedition-settled"));
      await leaveExpeditionToHome();

      await click(window, '[data-action="open-missions"]');
      await waitFor(window, '[data-mission-id="story-06"][data-mission-status="ready"]');
      await click(window, '[data-action="claim-mission"][data-mission-action-id="story-06"]');
      await waitFor(window, '[data-mission-id="story-06"][data-mission-status="claimed"]');
      await waitFor(window, '[data-action="launch-expedition-replay"]');
      const claimedExpeditionState = await window.webContents.executeJavaScript(`(() => {
        const save = JSON.parse(localStorage.getItem("game-morse-adventurer.saves.v1"))[0];
        return {
          money: save.money,
          technologyPoints: save.technologyPoints,
          claimed: save.missionState?.claimedMissionIds ?? [],
          history: save.missionState?.history ?? [],
          treeUnlocked: save.expeditionState?.expeditionTreeUnlocked === true,
        };
      })()`, true);
      if (!claimedExpeditionState.treeUnlocked
        || claimedExpeditionState.claimed.filter((id) => id === "story-06").length !== 1
        || claimedExpeditionState.history.filter(({ id }) => id === "story-06").length !== 1) {
        throw new Error(`Chapter 6 claim did not unlock one durable replay entry: ${JSON.stringify(claimedExpeditionState)}`);
      }
      await click(window, '[data-action="close-missions-footer"]');
      await waitForMissing(window, '[data-testid="mission-center-modal"]');
      await waitFor(window, '[data-action="enter-expedition-home"]');

      await window.reload();
      await waitFor(window, ".start-screen");
      await click(window, ".menu-primary");
      await waitFor(window, ".save-select-screen");
      await click(window, ".save-primary-action");
      await waitFor(window, ".home-screen");
      await waitFor(window, '[data-action="enter-expedition-home"]');
      await click(window, '[data-action="open-missions"]');
      await waitFor(window, '[data-mission-id="story-06"][data-mission-status="claimed"]');
      await waitFor(window, '[data-action="launch-expedition-replay"]');
      const replayReloadState = await window.webContents.executeJavaScript(`(() => {
        const save = JSON.parse(localStorage.getItem("game-morse-adventurer.saves.v1"))[0];
        return {
          money: save.money,
          technologyPoints: save.technologyPoints,
          claimed: save.missionState?.claimedMissionIds ?? [],
          history: save.missionState?.history ?? [],
          homeEntry: Boolean(document.querySelector('[data-action="enter-expedition-home"]')),
          missionEntry: Boolean(document.querySelector('[data-action="launch-expedition-replay"]')),
        };
      })()`, true);
      const replayEntryPersisted = replayReloadState.homeEntry && replayReloadState.missionEntry;
      if (!replayEntryPersisted) throw new Error(`Expedition replay entry did not persist: ${JSON.stringify(replayReloadState)}`);
      await click(window, '[data-action="launch-expedition-replay"]');
      await waitFor(window, '[data-testid="expedition-screen"][data-expedition-phase="site-selection"]');
      await leaveExpeditionToHome();
      const replayAfterLaunchState = await window.webContents.executeJavaScript(`(() => {
        const save = JSON.parse(localStorage.getItem("game-morse-adventurer.saves.v1"))[0];
        return {
          money: save.money,
          technologyPoints: save.technologyPoints,
          claimed: save.missionState?.claimedMissionIds ?? [],
          history: save.missionState?.history ?? [],
        };
      })()`, true);
      const replayRewardNoOp = replayAfterLaunchState.money === claimedExpeditionState.money
        && replayAfterLaunchState.technologyPoints === claimedExpeditionState.technologyPoints
        && JSON.stringify(replayAfterLaunchState.claimed) === JSON.stringify(claimedExpeditionState.claimed)
        && JSON.stringify(replayAfterLaunchState.history) === JSON.stringify(claimedExpeditionState.history);
      if (!replayRewardNoOp) {
        throw new Error(`Expedition replay repeated the story reward: ${JSON.stringify({ claimedExpeditionState, replayAfterLaunchState })}`);
      }
      await click(window, '[data-action="open-people-qsl"]');
      await waitFor(window, '[data-testid="people-qsl-modal"] [data-qsl-choice="believe"]');
      await capture(window, outputDir, shot("expedition-reloaded-qsl"));
      const beforeChoice = await window.webContents.executeJavaScript(
        'JSON.parse(localStorage.getItem("game-morse-adventurer.saves.v1"))[0].qslRecords[0]', true,
      );
      await click(window, '[data-qsl-choice="believe"]');
      await waitFor(window, '[data-testid="people-qsl-modal"] [data-qsl-id] b');
      const afterFirst = await window.webContents.executeJavaScript(
        'JSON.parse(localStorage.getItem("game-morse-adventurer.saves.v1"))[0].qslRecords', true,
      );
      await window.webContents.executeJavaScript(
        'document.querySelector(\'[data-action="qa-confirm-qsl-duplicate"]\').click()', true,
      );
      const afterDuplicate = await window.webContents.executeJavaScript(
        'JSON.parse(localStorage.getItem("game-morse-adventurer.saves.v1"))[0].qslRecords', true,
      );
      const duplicateChoiceNoOp = afterDuplicate.length === 1 && afterFirst.length === 1
        && afterDuplicate[0].choice === afterFirst[0].choice
        && afterDuplicate[0].confirmedAt === afterFirst[0].confirmedAt
        && JSON.stringify(afterDuplicate) === JSON.stringify(afterFirst);
      if (beforeChoice.choice !== null || afterFirst.length !== 1 || afterFirst[0].choice !== "believe"
        || !afterFirst[0].confirmedAt || !duplicateChoiceNoOp) {
        throw new Error(`QSL choice was not one-time: ${JSON.stringify({ afterFirst, afterDuplicate })}`);
      }
      await capture(window, outputDir, shot("expedition-choice-confirmed"));

      await window.reload();
      await waitFor(window, ".start-screen");
      await click(window, ".menu-primary");
      await waitFor(window, ".save-select-screen");
      await click(window, ".save-primary-action");
      await waitFor(window, ".home-screen");
      await click(window, '[data-action="open-people-qsl"]');
      await waitFor(window, '[data-testid="people-qsl-modal"] [data-qsl-id] b');
      const reloaded = await window.webContents.executeJavaScript(`(() => {
        const save = JSON.parse(localStorage.getItem("game-morse-adventurer.saves.v1"))[0];
        return {
          qsl: save.qslRecords[0],
          relationship: save.operatorRelationships.find((item) => item.personId === "person:sora"),
          choiceButtons: document.querySelectorAll("[data-qsl-choice]").length,
        };
      })()`, true);
      if (reloaded.qsl.choice !== "believe" || !reloaded.qsl.confirmedAt || reloaded.choiceButtons !== 0
        || reloaded.relationship.personId !== reloaded.qsl.personId) {
        throw new Error(`Reload lost QSL/person memory: ${JSON.stringify(reloaded)}`);
      }
      await capture(window, outputDir, shot("expedition-choice-reloaded"));
      const expeditionEvidence = {
        schemaVersion: 1,
        qaRunId,
        activity: "hill-expedition",
        failurePenaltyApplied: true,
        recoveryAction: "AGN",
        result: "success",
        settled: true,
        relationshipPersonId: reloaded.relationship.personId,
        qslPersonId: reloaded.qsl.personId,
        qslChoice: reloaded.qsl.choice,
        qslChoicePersistedAfterReload: true,
        duplicateChoiceNoOp: duplicateChoiceNoOp,
        timerPausedWithoutCatchUp,
        timeoutReachable,
        powerDepletedReachable,
        replayEntryPersisted,
        replayRewardNoOp,
      };
      validateExpeditionQaEvidence(expeditionEvidence, { qaRunId });
      await fs.writeFile(path.join(outputDir, "expedition-qa-result.json"), `${JSON.stringify(expeditionEvidence, null, 2)}\n`, "utf8");
      return finishScope({ practiceWrongTarget: wrongPracticeTarget });
    }

    if (scope === "qsl-story") {
      await runQslStoryQaScope(window, outputDir, shot, { qaRunId });
      return finishScope({ practiceWrongTarget: wrongPracticeTarget });
    }
    if (scope === "service-net") {
      await runServiceNetQaScope(window, outputDir, shot, { qaRunId });
      return finishScope({ practiceWrongTarget: wrongPracticeTarget });
    }
    if (scope === "coordinate-relay") {
      await runCoordinateRelayQaScope(window, outputDir, shot, { qaRunId });
      return finishScope({ practiceWrongTarget: wrongPracticeTarget });
    }
    if (scope === "contest") {
      await runContestQaScope(window, outputDir, shot, { qaRunId });
      return finishScope({ practiceWrongTarget: wrongPracticeTarget });
    }

  const lightsQaResult = await runLightsQaCapture(window, outputDir, suffix, { qaRunId });

  return {
    outputDir,
    captures: [...[
      "start", "save-create", "home", "home-escape-menu", "home-motion-a", "home-motion-b",
      "home-hover-store", "store-antenna", "store-radio", "store-accessory-research",
      "home-hover-warehouse", "technology-tree-initial", "warehouse-radio", "warehouse-accessories",
      "warehouse-antenna-selected", "warehouse-antenna-equipped",
      "mission-story-initial", "mission-story-active", "mission-daily", "mission-story-ready",
      "mission-story-claimed",
      "home-hover-achievements", "achievements-empty", "home-log-empty", "practice-session-only", "save-loaded", "store-accessory-owned", "store-radio-available", "store-radio-owned",
      "warehouse-accessory-selected", "warehouse-accessory-equipped", "warehouse-radio-selected", "warehouse-radio-equipped", "achievements-populated", "home-log-populated",
      "home-log-detail-second", "home-hover-practice", "practice-overview-initial", "practice-lesson-guidance", "practice-session-summary", "practice-overview-after-lesson", "practice-weak-recovery-review", "practice-weak-summary-recovered", "practice-weak-cleared", "home-after-practice", "practice-weak-cleared-reloaded", "practice-callsign-region-selected", "practice-callsign-region-locked", "practice-callsign-region-reloaded", "qso-duty-briefing", "station-listening", "station-radio-tx", "qso-leave-active", "station-input-cleared", "qso-npc-query", "qso-blind-copy", "qso-specific-error", "qso-agn-repeat", "qso-optional-query", "qso-result-unsaved", "qso-leave-unsaved", "qso-operation-review", "achievement-qso-5-unlocked", "qso-result-saved", "home-log-after-qso", "home-log-operation-review", "propagation-map", "world-map", "reload-without-achievement-repeat",
    ].map(shot), ...languageCaptures, ...manualCaptures],
    lightsQaResult,
  };
  } finally {
    try {
      await fs.writeFile(
        path.join(outputDir, "runtime-console-errors.json"),
        `${JSON.stringify(consoleErrors, null, 2)}\n`,
        "utf8",
      );
    } catch (error) {
      process.stderr.write(`Unable to write packaged QA console evidence: ${error.stack || error}\n`);
    }
    window.webContents.removeListener("console-message", onConsoleMessage);
  }
}

module.exports = {
  automaticQaGapAfterElement, automaticQaShouldWaitForIdleAfterSymbol,
  buildLightsQaMoneyFlow, buildLightsQaPlan, buildQaSegmentPlan, capture, capturePageWithVizRetry,
  createQaStateEnvelope, exportQaStateFromRenderer, formatLightsWaitFailure, importQaStateIntoRenderer,
  focusQaWindow,
  LIGHTS_QA_WPM, QA_INITIAL_STORY_MISSION_IDS, QA_QSO_LOG_VERSION, QA_STORAGE_KEYS, QA_SUPPORTED_SCOPES,
  runLightsQaCapture, runLightsQaSegment, runQaCapture,
  lightsKeyInputForSymbol, selectLightsCallerFromRuntimeSnapshot, startGuidedQaWatch,
  sendAutomaticStationRun, sendAutomaticStationText,
  sendAutomaticLightsText, validateExpeditionQaEvidence, validateLightsQaEvidence, validateQaStateEnvelope, validateStationEntryProbe,
  validateContestQaEvidence, validateCoordinateRelayQaEvidence, validateQslStoryQaEvidence, validateServiceNetQaEvidence,
  waitForFocusedQsoState, waitForQsoSubmitDecision, waitForRendererImages,
  writeQaSegmentResult,
};
