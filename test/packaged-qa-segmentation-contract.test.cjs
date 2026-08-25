const assert = require("node:assert/strict");
const { EventEmitter } = require("node:events");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const {
  QA_STORAGE_KEYS,
  buildQaSegmentPlan,
  capture,
  createQaStateEnvelope,
  exportQaStateFromRenderer,
  importQaStateIntoRenderer,
  runLightsQaSegment,
  writeQaSegmentResult,
  validateQaStateEnvelope,
} = require("../electron/qa-capture.cjs");
const {
  killWindowsProcessTree,
  runPackagedQa,
  runQaChildProcess,
} = require("../scripts/run-packaged-qa.cjs");

const SUFFIX = "contract";

const expectedCaptures = {
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
  lights: [
    "lights-story-launch", "lights-chase", "lights-control", "lights-failed", "lights-result",
    "lights-reloaded-history",
  ],
};

function filename(stem) {
  return `${stem}-${SUFFIX}.png`;
}

function saveStorage({ recentTargets = ["A", "N", "T", "E"] } = {}) {
  const saves = [{
    id: "save-contract",
    practiceRecords: { "character-rx": { recentTargets } },
  }];
  return {
    "game-morse-adventurer.saves.v1": JSON.stringify(saves),
    "game-morse-adventurer.active-save.v1": "save-contract",
    "game-morse-adventurer.language.v1": "ja",
  };
}

test("segmented packaged QA has an exact non-overlapping 91-image physical manifest", () => {
  const plan = buildQaSegmentPlan({ suffix: SUFFIX });
  assert.deepEqual(plan.segments.map(({ scope }) => scope), [
    "bootstrap", "inventory", "equipment", "practice", "qso", "lights",
  ]);

  const expectedByScope = Object.fromEntries(Object.entries(expectedCaptures)
    .map(([scope, stems]) => [scope, stems.map(filename)]));
  assert.deepEqual(Object.fromEntries(plan.segments.map(({ scope, screenshots }) => [scope, screenshots])), expectedByScope);

  const all = plan.segments.flatMap(({ screenshots }) => screenshots);
  assert.equal(all.length, 91);
  assert.equal(new Set(all).size, 91);
  assert.equal(plan.segments.find(({ scope }) => scope === "lights").timeoutMs, 8 * 60_000);
  assert.equal(plan.segments.find(({ scope }) => scope === "qso").timeoutMs, 8 * 60_000);
  assert.equal(plan.segments.find(({ scope }) => scope === "bootstrap").timeoutMs, 5 * 60_000);
});

test("QA state envelopes preserve only the three raw durable storage keys", () => {
  assert.deepEqual(QA_STORAGE_KEYS, [
    "game-morse-adventurer.saves.v1",
    "game-morse-adventurer.active-save.v1",
    "game-morse-adventurer.language.v1",
  ]);
  const storage = saveStorage();
  const envelope = createQaStateEnvelope({ producerScope: "equipment", storage });
  assert.deepEqual(envelope, {
    schemaVersion: 1,
    producerScope: "equipment",
    storage,
    facts: {},
  });
  assert.deepEqual(validateQaStateEnvelope(envelope, { consumerScope: "practice" }), envelope);
});

test("practice state carries one validated wrong-target fact into qso", () => {
  const storage = saveStorage({ recentTargets: ["A", "N", "T", "E"] });
  const envelope = createQaStateEnvelope({
    producerScope: "practice",
    storage,
    facts: { practiceWrongTarget: "N" },
  });
  assert.deepEqual(validateQaStateEnvelope(envelope, { consumerScope: "qso" }), envelope);

  assert.throws(() => createQaStateEnvelope({
    producerScope: "practice",
    storage,
    facts: { practiceWrongTarget: "Q" },
  }), /practiceWrongTarget.*recentTargets/);
});

test("QA state rejects hostile or non-adjacent segment input", () => {
  const storage = saveStorage();
  const valid = createQaStateEnvelope({ producerScope: "bootstrap", storage });
  const cases = [
    [{ ...valid, schemaVersion: 2 }, { consumerScope: "inventory" }, /schemaVersion/],
    [{ ...valid, producerScope: "equipment" }, { consumerScope: "inventory" }, /predecessor/],
    [{ ...valid, storage: { ...storage, extra: "forbidden" } }, { consumerScope: "inventory" }, /storage key/],
    [{ ...valid, storage: { ...storage, [QA_STORAGE_KEYS[0]]: "{" } }, { consumerScope: "inventory" }, /saves/],
    [{ ...valid, storage: { ...storage, [QA_STORAGE_KEYS[1]]: "missing" } }, { consumerScope: "inventory" }, /active save/],
    [{ ...valid, storage: { ...storage, [QA_STORAGE_KEYS[2]]: "xx" } }, { consumerScope: "inventory" }, /language/],
    [null, { consumerScope: "inventory" }, /state input/],
    [valid, { consumerScope: "bootstrap" }, /bootstrap.*state input/],
  ];
  for (const [candidate, options, pattern] of cases) {
    assert.throws(() => validateQaStateEnvelope(candidate, options), pattern);
  }
});

test("capture publishes start before renderer work and complete only after the PNG is durable", async () => {
  const outputDir = await fs.mkdtemp(path.join(os.tmpdir(), "cwgame-capture-step-"));
  let releaseRenderer;
  const rendererGate = new Promise((resolve) => { releaseRenderer = resolve; });
  const image = { toPNG: () => Buffer.from("png-contract") };
  const qaWindow = {
    webContents: {
      executeJavaScript: () => rendererGate,
      capturePage: async () => image,
    },
  };

  const capturePromise = capture(qaWindow, outputDir, "start-contract.png", { scope: "bootstrap" });
  await new Promise((resolve) => setTimeout(resolve, 20));
  const started = JSON.parse(await fs.readFile(path.join(outputDir, "qa-step.txt"), "utf8"));
  assert.equal(started.scope, "bootstrap");
  assert.equal(started.filename, "start-contract.png");
  assert.equal(started.phase, "capture-start");
  assert.equal(typeof started.at, "string");
  await assert.rejects(fs.access(path.join(outputDir, "start-contract.png")));

  releaseRenderer();
  await capturePromise;
  assert.equal(await fs.readFile(path.join(outputDir, "start-contract.png"), "utf8"), "png-contract");
  const completed = JSON.parse(await fs.readFile(path.join(outputDir, "qa-step.txt"), "utf8"));
  assert.equal(completed.phase, "capture-complete");
  assert.equal(completed.scope, "bootstrap");
  assert.equal(completed.filename, "start-contract.png");
});

async function writeSuccessfulFakeSegment(env, scope) {
  const outputDir = env.CWGAME_QA_OUTPUT;
  const segment = buildQaSegmentPlan({ suffix: env.CWGAME_QA_SUFFIX }).segments
    .find((candidate) => candidate.scope === scope);
  await fs.mkdir(outputDir, { recursive: true });
  for (const screenshot of segment.screenshots) {
    await fs.writeFile(path.join(outputDir, screenshot), "png");
  }
  await fs.writeFile(path.join(outputDir, "runtime-console-errors.json"), "[]\n");
  if (env.CWGAME_QA_STATE_OUT) {
    const state = createQaStateEnvelope({
      producerScope: scope,
      storage: saveStorage(),
      facts: scope === "practice" ? { practiceWrongTarget: "N" } : {},
    });
    await fs.writeFile(env.CWGAME_QA_STATE_OUT, `${JSON.stringify(state)}\n`);
  }
  await fs.writeFile(path.join(outputDir, "qa-segment-result.json"), `${JSON.stringify({
    schemaVersion: 1,
    scope,
    captures: segment.screenshots,
    consoleErrorCount: 0,
    completedAt: "2026-08-26T00:00:00.000Z",
  })}\n`);
}

test("external supervisor launches fresh ordered segment processes and stops at the first child failure", async () => {
  const outputRoot = await fs.mkdtemp(path.join(os.tmpdir(), "cwgame-supervisor-order-"));
  const launches = [];
  const spawnImpl = (_exe, args, options) => {
    const child = new EventEmitter();
    child.pid = 4100 + launches.length;
    const scope = options.env.CWGAME_QA_SCOPE;
    launches.push({ args, env: options.env });
    setImmediate(async () => {
      if (scope === "bootstrap") {
        await writeSuccessfulFakeSegment(options.env, scope);
        child.emit("close", 0, null);
      } else {
        child.emit("close", 7, null);
      }
    });
    return child;
  };

  await assert.rejects(() => runPackagedQa({
    exe: "CWGame-latest.exe",
    outputRoot,
    suffix: SUFFIX,
    spawnImpl,
  }), /inventory.*code 7/);
  assert.deepEqual(launches.map(({ env }) => env.CWGAME_QA_SCOPE), ["bootstrap", "inventory"]);
  assert.ok(launches.every(({ args }) => args.length === 1 && args[0] === "--qa-capture"));
  assert.notEqual(launches[0].env.CWGAME_QA_OUTPUT, launches[1].env.CWGAME_QA_OUTPUT);
  assert.match(launches[0].env.CWGAME_QA_OUTPUT, /segments[\\/]bootstrap$/);
  assert.match(launches[1].env.CWGAME_QA_OUTPUT, /segments[\\/]inventory$/);
  assert.equal(launches[0].env.CWGAME_QA_STATE_IN, undefined);
  assert.equal(launches[1].env.CWGAME_QA_STATE_IN, launches[0].env.CWGAME_QA_STATE_OUT);
});

test("external supervisor rejects a zero exit without complete segment evidence", async () => {
  const failureCases = [
    ["missing sentinel", async (dir, env) => {
      await writeSuccessfulFakeSegment(env, "bootstrap");
      await fs.rm(path.join(dir, "qa-segment-result.json"));
    }, /sentinel/],
    ["qa failure", async (dir, env) => {
      await writeSuccessfulFakeSegment(env, "bootstrap");
      await fs.writeFile(path.join(dir, "qa-failure.txt"), "renderer failed");
    }, /qa-failure/],
    ["console error", async (dir, env) => {
      await writeSuccessfulFakeSegment(env, "bootstrap");
      await fs.writeFile(path.join(dir, "runtime-console-errors.json"), '[{"message":"boom"}]');
      await fs.writeFile(path.join(dir, "qa-segment-result.json"), JSON.stringify({
        schemaVersion: 1, scope: "bootstrap", captures: expectedCaptures.bootstrap.map(filename),
        consoleErrorCount: 1, completedAt: "2026-08-26T00:00:00.000Z",
      }));
    }, /console/],
    ["zero screenshot", async (dir, env) => {
      await writeSuccessfulFakeSegment(env, "bootstrap");
      await fs.writeFile(path.join(dir, expectedCaptures.bootstrap.map(filename)[0]), "");
    }, /missing or empty/],
    ["bad state", async (_dir, env) => {
      await writeSuccessfulFakeSegment(env, "bootstrap");
      await fs.writeFile(env.CWGAME_QA_STATE_OUT, '{"schemaVersion":1}');
    }, /state/],
  ];
  for (const [label, arrange, expected] of failureCases) {
    const outputRoot = await fs.mkdtemp(path.join(os.tmpdir(), `cwgame-supervisor-${label.replace(" ", "-")}-`));
    const spawnImpl = (_exe, _args, options) => {
      const child = new EventEmitter();
      child.pid = 4200;
      setImmediate(async () => {
        await fs.mkdir(options.env.CWGAME_QA_OUTPUT, { recursive: true });
        await arrange(options.env.CWGAME_QA_OUTPUT, options.env);
        child.emit("close", 0, null);
      });
      return child;
    };
    await assert.rejects(() => runPackagedQa({
      exe: "CWGame-latest.exe", outputRoot, suffix: SUFFIX, spawnImpl,
    }), expected, label);
  }
});

test("Windows timeout kills the exact process tree once and records the last capture step", async () => {
  const outputDir = await fs.mkdtemp(path.join(os.tmpdir(), "cwgame-supervisor-timeout-"));
  await fs.writeFile(path.join(outputDir, "qa-step.txt"), JSON.stringify({
    scope: "qso", filename: "qso-npc-query-contract.png", phase: "capture-start", at: "now",
  }));
  const child = new EventEmitter();
  child.pid = 4312;
  const taskkillCalls = [];
  let cleared = 0;
  await assert.rejects(() => runQaChildProcess({
    executable: "CWGame-latest.exe",
    args: ["--qa-capture"],
    env: {},
    outputDir,
    scope: "qso",
    timeoutMs: 1,
    spawnImpl: () => child,
    killTreeImpl: async (pid) => {
      taskkillCalls.push(pid);
      child.emit("close", 1, null);
    },
    clearTimeoutImpl: (timer) => { cleared += 1; clearTimeout(timer); },
  }), /qso.*timed out/);
  child.emit("close", 0, null);
  assert.deepEqual(taskkillCalls, [4312]);
  assert.equal(cleared, 1);
  const marker = JSON.parse(await fs.readFile(path.join(outputDir, "qa-timeout.json"), "utf8"));
  assert.equal(marker.scope, "qso");
  assert.equal(marker.lastStep.filename, "qso-npc-query-contract.png");
});

test("Windows tree killer passes taskkill the required PID/T/F arguments", async () => {
  const calls = [];
  await killWindowsProcessTree(5512, {
    execFileImpl(file, args, callback) {
      calls.push({ file, args });
      callback(null, "", "");
    },
  });
  assert.deepEqual(calls, [{
    file: "taskkill.exe",
    args: ["/PID", "5512", "/T", "/F"],
  }]);
});

function rendererStorageWindow(initial = {}) {
  const values = new Map(Object.entries(initial));
  let reloads = 0;
  const localStorage = {
    getItem: (key) => values.has(key) ? values.get(key) : null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: (key) => values.delete(key),
  };
  return {
    values,
    reloads: () => reloads,
    reload: async () => { reloads += 1; },
    webContents: {
      executeJavaScript: async (source) => vm.runInNewContext(source, { localStorage }),
    },
  };
}

test("consumer state import applies only validated raw keys and reloads the fresh renderer once", async () => {
  const storage = saveStorage();
  const state = createQaStateEnvelope({ producerScope: "bootstrap", storage });
  const qaWindow = rendererStorageWindow({
    "game-morse-adventurer.saves.v1": "stale",
    "unrelated.renderer.key": "fresh-profile-proof",
  });
  await importQaStateIntoRenderer(qaWindow, state, { consumerScope: "inventory" });
  assert.equal(qaWindow.reloads(), 1);
  assert.equal(qaWindow.values.get("unrelated.renderer.key"), "fresh-profile-proof");
  assert.deepEqual(Object.fromEntries(QA_STORAGE_KEYS.map((key) => [key, qaWindow.values.get(key)])), storage);
});

test("renderer state export reads exactly the allowlist and validates practice facts", async () => {
  const storage = saveStorage();
  const qaWindow = rendererStorageWindow({ ...storage, "unrelated.renderer.key": "do-not-export" });
  const envelope = await exportQaStateFromRenderer(qaWindow, {
    producerScope: "practice",
    facts: { practiceWrongTarget: "A" },
  });
  assert.deepEqual(envelope, {
    schemaVersion: 1,
    producerScope: "practice",
    storage,
    facts: { practiceWrongTarget: "A" },
  });
  assert.equal(Object.hasOwn(envelope.storage, "unrelated.renderer.key"), false);
});

test("a completed ordinary scope writes validated state and an exact segment sentinel", async () => {
  const outputDir = await fs.mkdtemp(path.join(os.tmpdir(), "cwgame-segment-sentinel-"));
  const stateOutFile = path.join(outputDir, "qa-state-out.json");
  const qaWindow = rendererStorageWindow(saveStorage());
  const result = await writeQaSegmentResult(qaWindow, {
    outputDir,
    stateOutFile,
    scope: "practice",
    suffix: SUFFIX,
    consoleErrors: [],
    facts: { practiceWrongTarget: "A" },
  });
  assert.deepEqual(result, {
    schemaVersion: 1,
    scope: "practice",
    captures: expectedCaptures.practice.map(filename),
    stateOut: "qa-state-out.json",
    consoleErrorCount: 0,
    completedAt: result.completedAt,
  });
  assert.match(result.completedAt, /^\d{4}-\d\d-\d\dT/);
  assert.deepEqual(
    JSON.parse(await fs.readFile(path.join(outputDir, "qa-segment-result.json"), "utf8")),
    result,
  );
  assert.equal(JSON.parse(await fs.readFile(stateOutFile, "utf8")).producerScope, "practice");
});

test("the independent Lights scope writes its own exact sentinel and cleans up its console listener", async () => {
  const outputDir = await fs.mkdtemp(path.join(os.tmpdir(), "cwgame-lights-segment-"));
  const webContents = new EventEmitter();
  const qaWindow = { webContents };
  const result = await runLightsQaSegment(qaWindow, outputDir, SUFFIX, {
    runCaptureImpl: async () => ({ resultFile: "lights-qa-result.json" }),
  });
  assert.deepEqual(result.captures, expectedCaptures.lights.map(filename));
  assert.equal(result.scope, "lights");
  assert.equal(result.consoleErrorCount, 0);
  assert.equal(webContents.listenerCount("console-message"), 0);
  assert.deepEqual(JSON.parse(await fs.readFile(path.join(outputDir, "runtime-console-errors.json"), "utf8")), []);
  assert.deepEqual(
    JSON.parse(await fs.readFile(path.join(outputDir, "qa-segment-result.json"), "utf8")),
    result,
  );
});
