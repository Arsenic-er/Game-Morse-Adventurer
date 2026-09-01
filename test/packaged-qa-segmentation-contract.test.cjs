const assert = require("node:assert/strict");
const { EventEmitter } = require("node:events");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");
const { MessageChannel: NativeMessageChannel } = require("node:worker_threads");
const { deflateSync } = require("node:zlib");

const {
  QA_STORAGE_KEYS,
  QA_SUPPORTED_SCOPES,
  QA_INITIAL_STORY_MISSION_IDS,
  buildQaSegmentPlan,
  capture,
  configureContestQaWpm,
  createQaStateEnvelope,
  exportQaStateFromRenderer,
  importQaStateIntoRenderer,
  revealQaMissionForCapture,
  runLightsQaSegment,
  sendAutomaticFirstPageText,
  sendAutomaticStationRun,
  sendAutomaticStationText,
  sendAutomaticStructuredText,
  qaMorsePatternForCharacter,
  validateContestQaEvidence,
  validateCoordinateRelayQaEvidence,
  validateExpeditionQaEvidence,
  validateFinalPromiseQaEvidence,
  validateFirstPageQaEvidence,
  validateListeningQaEvidence,
  validateNightOperationsQaEvidence,
  validateQslStoryQaEvidence,
  validateServiceNetQaEvidence,
  validateStormRelayQaEvidence,
  waitForFocusedQsoState,
  waitForQsoSubmitDecision,
  waitForRendererImages,
  writeQaSegmentResult,
  validateQaStateEnvelope,
} = require("../electron/qa-capture.cjs");
const {
  killWindowsProcessTree,
  runPackagedQa,
  runQaChildProcess,
  validatePixelHashGroups,
  validatePngScreenshot,
  validateQaSegmentArtifacts,
} = require("../scripts/run-packaged-qa.cjs");

const SUFFIX = "1439x912";
const QA_RUN_ID = "11111111-2222-4333-8444-555555555555";

test("packaged CW input covers every character supported by the production Morse alphabet", async () => {
  const { MORSE_CODE } = await import("../src/cw/morse.js");
  for (const [character, pattern] of Object.entries(MORSE_CODE)) {
    assert.equal(qaMorsePatternForCharacter(character), pattern, character);
  }
  assert.equal(qaMorsePatternForCharacter("@"), null);
});

test("bootstrap QA expects the complete Chapter 1 through 15 mission board", () => {
  assert.deepEqual(QA_INITIAL_STORY_MISSION_IDS, [
    "story-01", "story-02", "story-03", "story-04", "story-05",
    "story-06", "story-07", "story-08", "story-09", "story-10",
    "story-11", "story-12", "story-13", "story-14", "story-15",
  ]);
});

test("a chapter mission evidence capture reveals the intended available card", async () => {
  const selectors = [];
  const scrollOptions = [];
  const window = {
    webContents: {
      async executeJavaScript(source) {
        return vm.runInNewContext(source, {
          document: {
            querySelector(selector) {
              selectors.push(selector);
              return {
                scrollIntoView(options) {
                  scrollOptions.push({ ...options });
                },
              };
            },
          },
        });
      },
    },
  };

  assert.equal(await revealQaMissionForCapture(window, "story-11"), true);
  assert.deepEqual(selectors, ['[data-mission-id="story-11"][data-mission-status="available"]']);
  assert.deepEqual(scrollOptions, [{ block: "center", inline: "nearest", behavior: "instant" }]);
});

test("every Chapter 7 through 15 availability capture reveals its exact mission card", async () => {
  const source = await fs.readFile(path.join(__dirname, "../electron/qa-capture.cjs"), "utf8");
  for (let chapter = 7; chapter <= 15; chapter += 1) {
    const missionId = `story-${String(chapter).padStart(2, "0")}`;
    const call = `revealQaMissionForCapture(window, "${missionId}");`;
    assert.equal(source.split(call).length - 1, 1, missionId);
  }
});

test("QSO QA waits for a delayed semantic submission to reach a stable DOM decision", async () => {
  let phase = "PLAYER_RST_AND_73";
  const selectors = [];
  const window = {
    webContents: {
      async executeJavaScript() { return phase; },
    },
  };
  const observed = await waitForQsoSubmitDecision(window, {
    focusFn: async () => {},
    async waitForFn(_window, selector, timeout) {
      selectors.push(selector);
      assert.equal(timeout, 10000);
      await new Promise((resolve) => setTimeout(resolve, 180));
      phase = selectors.length === 1 ? "PLAYER_RST_AND_73" : "NPC_OPTIONAL_QUERY";
    },
  });
  assert.equal(observed, "NPC_OPTIONAL_QUERY");
  assert.equal(selectors.length, 2);
  assert.match(selectors[0], /submit-reply\"\]\[disabled\]/);
  assert.match(selectors[1], /submit-reply\"\]:not\(\[disabled\]\)/);
});

test("focus-sensitive QSO waits restore the real renderer before NPC playback can advance", async () => {
  let focused = false;
  let phase = "NPC_REPLY";
  const calls = [];
  const window = {
    isMinimized: () => false,
    show() { calls.push("show"); },
    focus() { calls.push("window-focus"); focused = true; },
    isFocused: () => focused,
    webContents: {
      focus() { calls.push("renderer-focus"); focused = true; },
      async executeJavaScript(source) {
        if (source.trim().startsWith("({ hasFocus:")) {
          return { hasFocus: focused, visibilityState: "visible" };
        }
        if (source.includes("new Promise")) return focused;
        return phase;
      },
    },
  };
  const observed = await waitForFocusedQsoState(
    window,
    '[data-qso-phase="PLAYER_CQ"]',
    {
      context: "after NPC query playback",
      waitForFn: async (_window, selector, timeout) => {
        calls.push(`wait:${selector}:${timeout}`);
        assert.equal(focused, true);
        phase = "PLAYER_CQ";
      },
    },
  );
  assert.equal(observed, "PLAYER_CQ");
  assert.deepEqual(calls, [
    "show", "window-focus", "renderer-focus",
    'wait:[data-qso-phase="PLAYER_CQ"]:10000',
  ]);
});

function pngChunk(type, data = Buffer.alloc(0)) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  return Buffer.concat([length, Buffer.from(type, "ascii"), data, Buffer.alloc(4)]);
}

function crc32ForTest(buffer) {
  let value = 0xffffffff;
  for (const byte of buffer) {
    value ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      value = (value >>> 1) ^ ((value & 1) ? 0xedb88320 : 0);
    }
  }
  return (value ^ 0xffffffff) >>> 0;
}

function pngChunkWithCrc(type, data = Buffer.alloc(0)) {
  const typeBuffer = Buffer.from(type, "ascii");
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32ForTest(Buffer.concat([typeBuffer, data])));
  const chunk = pngChunk(type, data);
  crc.copy(chunk, chunk.length - 4);
  return chunk;
}

function crcValidPngShell(width = 1439, height = 912, {
  bitDepth = 8,
  colorType = 6,
  idat = Buffer.from([0]),
} = {}) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = bitDepth;
  ihdr[9] = colorType;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunkWithCrc("IHDR", ihdr),
    pngChunkWithCrc("IDAT", idat),
    pngChunkWithCrc("IEND"),
  ]);
}

function forgedCrcPng(width = 1439, height = 912) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", Buffer.from([0])),
    pngChunk("IEND"),
  ]);
}

const validCapturePngCache = new Map();

function validCapturePng(width = 1439, height = 912, colorType = 6, variant = 0) {
  const cacheKey = `${width}x${height}:${colorType}:${variant}`;
  if (validCapturePngCache.has(cacheKey)) return validCapturePngCache.get(cacheKey);
  const bytesPerPixel = colorType === 2 ? 3 : 4;
  const raw = Buffer.alloc(((width * bytesPerPixel) + 1) * height);
  const visiblePixels = Math.min(width * height, 128);
  const scanlineBytes = (width * bytesPerPixel) + 1;
  for (let pixel = 0; pixel < visiblePixels; pixel += 1) {
    const row = Math.floor(pixel / width);
    const column = pixel % width;
    const offset = (row * scanlineBytes) + 1 + (column * bytesPerPixel);
    raw[offset] = (pixel * 37 + variant * 17) % 256;
    raw[offset + 1] = (pixel * 67 + variant * 29) % 256;
    raw[offset + 2] = (pixel * 97 + variant * 43) % 256;
    if (colorType === 6) raw[offset + 3] = 0xff;
  }
  const png = crcValidPngShell(width, height, {
    colorType,
    idat: deflateSync(raw),
  });
  validCapturePngCache.set(cacheKey, png);
  return png;
}

function fixtureVariant(value) {
  return [...String(value)].reduce((hash, character) => ((hash * 33) ^ character.charCodeAt(0)) >>> 0, 5381);
}

function corruptChunkCrc(png, targetType) {
  const corrupted = Buffer.from(png);
  let offset = 8;
  while (offset < corrupted.length) {
    const dataLength = corrupted.readUInt32BE(offset);
    const type = corrupted.toString("ascii", offset + 4, offset + 8);
    const crcOffset = offset + 8 + dataLength;
    if (type === targetType) {
      corrupted[crcOffset] ^= 0xff;
      return corrupted;
    }
    offset = crcOffset + 4;
  }
  throw new Error(`PNG fixture is missing ${targetType}`);
}

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
  listening: [
    "listening-mission-available", "listening-briefing", "listening-window-one", "listening-window-three",
    "listening-call", "listening-waiting", "listening-decision", "listening-result", "listening-settled",
    "listening-records", "listening-reloaded",
  ],
  "storm-relay": [
    "storm-mission-available", "storm-briefing", "storm-check-in-error", "storm-conflict",
    "storm-verify-error", "storm-source-verified", "storm-relay-error", "storm-canonical-relay",
    "storm-result", "storm-settled", "storm-archive", "storm-reloaded",
  ],
  "night-operations": [
    "night-mission-available", "night-board", "night-first-window", "night-call-error",
    "night-first-contact", "night-second-window", "night-second-contact", "night-third-window",
    "night-third-contact", "night-result", "night-settled", "night-reloaded",
  ],
  "final-promise": [
    "final-promise-mission-available", "final-promise-review", "final-promise-call-error",
    "final-promise-account", "final-promise-repeat", "final-promise-choice", "final-promise-message-error",
    "final-promise-result", "final-promise-settled", "final-promise-archive", "final-promise-reloaded",
  ],
  "first-page": [
    "first-page-mission-available", "first-page-mission-active", "first-page-station",
    "first-page-qso-result", "first-page-candidate", "first-page-goal", "first-page-settled",
    "first-page-open-station", "first-page-reloaded",
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

async function freshOutputRoot(prefix) {
  const parent = await fs.mkdtemp(path.join(os.tmpdir(), prefix));
  return path.join(parent, "evidence");
}

async function delayedStationRenderer({
  focusLossAfterPulseCount = null,
  ipcDelayMs = 180,
  projectionDelayMs = 80,
  structuredTimerLagMs = 0,
  taskYieldLagMs = 0,
  wpm = 18,
} = {}) {
  const [{ AutomaticKeyer }, { analyzeKeying, detectClearInputGesture }] = await Promise.all([
    import("../src/cw/automaticKeyer.js"),
    import("../src/cw/inputAnalyzer.js"),
  ]);
  let pulses = [];
  const projectionTimers = new Set();
  let projectedPulseCount = 0;
  let projectedDecoded = "";
  let keyerActive = false;
  let rendererFocused = true;
  let focusLossApplied = false;
  const focusCalls = [];
  const dispatchedEvents = [];
  const keyer = new AutomaticKeyer({
    getWpm: () => wpm,
    now: () => performance.now(),
    onSessionChange: (active) => { keyerActive = active; },
    onPulse: (pulse) => {
      pulses = [...pulses, pulse];
      const analysis = analyzeKeying(pulses, { fallbackWpm: wpm });
      const clearGesture = detectClearInputGesture(pulses, { analysis, fallbackWpm: wpm, threshold: 7 });
      if (clearGesture) {
        pulses = [];
        setTimeout(() => keyer.stop(), 0);
      }
      const snapshot = clearGesture
        ? { pulseCount: 0, decoded: "" }
        : { pulseCount: analysis.pulseCount, decoded: analysis.decoded };
      const timer = setTimeout(() => {
        projectionTimers.delete(timer);
        projectedPulseCount = snapshot.pulseCount;
        projectedDecoded = snapshot.decoded;
        if (!focusLossApplied && Number.isInteger(focusLossAfterPulseCount)
          && projectedPulseCount >= focusLossAfterPulseCount) {
          rendererFocused = false;
          focusLossApplied = true;
          keyer.stop();
        }
      }, projectionDelayMs);
      projectionTimers.add(timer);
    },
  });
  class FakeKeyboardEvent {
    constructor(type, options) {
      this.type = type;
      Object.assign(this, options);
    }
  }
  class LaggedMessageChannel {
    constructor() {
      this.port1 = { onmessage: null, close() {} };
      this.port2 = {
        close() {},
        postMessage: () => setTimeout(() => this.port1.onmessage?.({ data: null }), taskYieldLagMs),
      };
    }
  }
  const RendererMessageChannel = taskYieldLagMs > 0 ? LaggedMessageChannel : NativeMessageChannel;
  const document = {
    body: { className: "" },
    visibilityState: "visible",
    hasFocus: () => rendererFocused,
    querySelector(selector) {
      if (selector === ".station-screen" || selector === ".coordinate-relay-screen" || selector === ".storm-relay-screen") {
        return { dataset: {
          decoded: projectedDecoded,
          pulseCount: String(projectedPulseCount),
          qsoPhase: "PLAYER_CQ",
          coordinatePhase: "PLAYER_READBACK",
          stormPhase: "PLAYER_RELAY",
          keyerWpm: String(wpm),
          keying: String(keyerActive),
        } };
      }
      if (selector === '[data-action="submit-reply"]:not([disabled])') {
        return !keyerActive && projectedPulseCount > 0 ? {} : null;
      }
      if (selector === ".key-card strong") return { textContent: "Automatic paddle" };
      return null;
    },
  };
  const rendererWindow = {
    dispatchEvent(event) {
      dispatchedEvents.push({ type: event.type, code: event.code, at: performance.now() });
      if (!rendererFocused) return false;
      const symbol = event.code === "KeyZ" ? "." : event.code === "KeyX" ? "-" : null;
      if (!symbol) return false;
      if (event.type === "keydown") keyer.begin(symbol);
      if (event.type === "keyup") keyer.end(symbol);
      return true;
    },
  };
  const context = {
    Boolean, Date, Error, JSON, KeyboardEvent: FakeKeyboardEvent, Number, Promise,
    clearInterval, clearTimeout, document, MessageChannel: RendererMessageChannel,
    performance, setInterval,
    setTimeout(callback, delay, ...args) {
      const lag = structuredTimerLagMs > 0 && delay >= 100 ? structuredTimerLagMs : 0;
      return setTimeout(callback, delay + lag, ...args);
    },
    window: rendererWindow,
  };
  return {
    decoded: () => projectedDecoded,
    dispatchedEvents,
    focusCalls,
    pulseCount: () => projectedPulseCount,
    pulses: () => [...pulses],
    window: {
      isMinimized: () => false,
      isFocused: () => rendererFocused,
      show() { focusCalls.push("show"); },
      focus() { focusCalls.push("window-focus"); rendererFocused = true; },
      webContents: {
        focus() { focusCalls.push("renderer-focus"); rendererFocused = true; },
        async executeJavaScript(source) {
          await new Promise((resolve) => setTimeout(resolve, ipcDelayMs));
          return vm.runInNewContext(source, context);
        },
      },
    },
    cleanup() {
      keyer.stop();
      for (const timer of projectionTimers) clearTimeout(timer);
    },
  };
}

test("ordinary station QA keeps character timing with bounded IPC and delayed DOM projection", async () => {
  const renderer = await delayedStationRenderer({ ipcDelayMs: 20, projectionDelayMs: 150, wpm: 12 });
  try {
    await sendAutomaticStationText(renderer.window, "CQ", 12);
    assert.equal(renderer.decoded(), "CQ");
  } finally {
    renderer.cleanup();
  }
});

test("ordinary station QA fails closed when IPC delay exceeds the Morse character-gap budget", async () => {
  const renderer = await delayedStationRenderer({ ipcDelayMs: 180, projectionDelayMs: 80 });
  try {
    await assert.rejects(
      () => sendAutomaticStationText(renderer.window, "CQ", 18),
      /decoded 'C Q' instead of 'CQ'/,
    );
  } finally {
    renderer.cleanup();
  }
});

test("ordinary station QA uses short physical paddle taps without repeating B, 5, or H under delayed DOM projection", async () => {
  const wpm = 12;
  const dotMs = 1200 / wpm;
  const schedulerToleranceMs = 20;
  const qaSource = await fs.readFile(path.join(__dirname, "../electron/qa-capture.cjs"), "utf8");
  assert.match(qaSource, /const tapHoldMs = dotMs \* 0\.12;/);
  assert.match(qaSource, /heldCodes\.delete\(code\);\s+await yieldTask\(\);/);
  for (const [character, expectedPulses] of [["B", 4], ["5", 5], ["H", 4]]) {
    const renderer = await delayedStationRenderer({ ipcDelayMs: 0, projectionDelayMs: 150, wpm });
    try {
      await sendAutomaticStationText(renderer.window, character, wpm);
      assert.equal(renderer.decoded(), character);
      assert.equal(renderer.pulses().length, expectedPulses, `${character} must not repeat a held paddle`);
      assert.equal(renderer.dispatchedEvents.length, expectedPulses * 2);
      for (let index = 0; index < renderer.dispatchedEvents.length; index += 2) {
        const down = renderer.dispatchedEvents[index];
        const up = renderer.dispatchedEvents[index + 1];
        assert.equal(down.type, "keydown");
        assert.equal(up.type, "keyup");
        assert.equal(up.code, down.code);
        const holdMs = up.at - down.at;
        assert.ok(holdMs >= dotMs * 0.04, `${character} tap ${index / 2} was not physically held: ${holdMs}ms`);
        assert.ok(
          holdMs <= dotMs * 0.12 + schedulerToleranceMs,
          `${character} tap ${index / 2} exceeded its configured hold plus scheduler tolerance: ${holdMs}ms`,
        );
        if (index + 2 < renderer.dispatchedEvents.length) {
          const yieldMs = renderer.dispatchedEvents[index + 2].at - up.at;
          assert.ok(yieldMs > 0, `${character} tap ${index / 2} did not yield the renderer event loop`);
          assert.ok(
            yieldMs <= dotMs * 0.1 + schedulerToleranceMs,
            `${character} tap ${index / 2} exceeded its task-yield scheduler tolerance: ${yieldMs}ms`,
          );
        }
      }
    } finally {
      renderer.cleanup();
    }
  }
});

test("ordinary station QA releases a paddle before a renderer task delayed beyond two dots can repeat it", async () => {
  const wpm = 18;
  const renderer = await delayedStationRenderer({
    ipcDelayMs: 0,
    projectionDelayMs: 0,
    taskYieldLagMs: (1200 / wpm) * 2.4,
    wpm,
  });
  try {
    await sendAutomaticStationText(renderer.window, "E", wpm);
    assert.equal(renderer.decoded(), "E");
    assert.equal(renderer.pulses().length, 1);
  } finally {
    renderer.cleanup();
  }
});

test("structured chapter QA queues one whole character before a delayed renderer task can split H", async () => {
  const wpm = 18;
  const renderer = await delayedStationRenderer({
    ipcDelayMs: 0,
    projectionDelayMs: 0,
    taskYieldLagMs: (1200 / wpm) * 4,
    wpm,
  });
  try {
    await sendAutomaticStructuredText(renderer.window, "H", {
      screenSelector: ".coordinate-relay-screen",
      phaseDataset: "coordinatePhase",
      label: "Coordinate relay",
      wpm,
    });
    assert.equal(renderer.decoded(), "H");
    assert.equal(renderer.pulses().length, 4);
  } finally {
    renderer.cleanup();
  }
});

test("structured chapter QA keeps each word atomic across delayed main-renderer IPC", async () => {
  const renderer = await delayedStationRenderer({
    ipcDelayMs: 180,
    projectionDelayMs: 80,
    wpm: 18,
  });
  try {
    await sendAutomaticStructuredText(renderer.window, "WRONG CHECK IN K", {
      screenSelector: ".coordinate-relay-screen",
      phaseDataset: "coordinatePhase",
      label: "Storm relay",
      wpm: 18,
    });
    assert.equal(renderer.decoded(), "WRONG CHECK IN K");
  } finally {
    renderer.cleanup();
  }
});

test("structured chapter QA derives character spacing from the live 22 WPM keyer", async () => {
  const renderer = await delayedStationRenderer({
    ipcDelayMs: 0,
    projectionDelayMs: 0,
    structuredTimerLagMs: 60,
    wpm: 22,
  });
  try {
    await sendAutomaticStructuredText(renderer.window, "CHECK", {
      screenSelector: ".storm-relay-screen",
      phaseDataset: "stormPhase",
      label: "Storm relay",
      wpm: 12,
    });
    assert.equal(renderer.decoded(), "CHECK");
  } finally {
    renderer.cleanup();
  }
});

test("structured chapter QA does not oversleep a character gap into a word gap", async () => {
  const renderer = await delayedStationRenderer({
    ipcDelayMs: 0,
    projectionDelayMs: 0,
    structuredTimerLagMs: 150,
    wpm: 22,
  });
  try {
    await sendAutomaticStructuredText(renderer.window, "SIMF3CC", {
      screenSelector: ".storm-relay-screen",
      phaseDataset: "stormPhase",
      label: "Contest",
      wpm: 22,
    });
    assert.equal(renderer.decoded(), "SIMF3CC");
  } finally {
    renderer.cleanup();
  }
});

test("first-page ordinary QSO keeps its compact CQ atomic across delayed main-renderer IPC", async () => {
  const renderer = await delayedStationRenderer({
    ipcDelayMs: 180,
    projectionDelayMs: 80,
    wpm: 18,
  });
  try {
    const cq = "CQCQDEBH1ABCXBH1ABCXPSEK";
    await sendAutomaticFirstPageText(renderer.window, cq, 18);
    assert.equal(renderer.decoded(), cq);
  } finally {
    renderer.cleanup();
  }
});

test("ordinary station QA restores focus only at character boundaries without losing B, 5, H or inserting spaces", async () => {
  const renderer = await delayedStationRenderer({
    focusLossAfterPulseCount: 4,
    ipcDelayMs: 0,
    projectionDelayMs: 150,
    wpm: 12,
  });
  try {
    await sendAutomaticStationText(renderer.window, "B5H", 12);
    assert.equal(renderer.decoded(), "B5H");
    assert.equal(renderer.pulses().length, 13);
    assert.equal(renderer.focusCalls.filter((call) => call === "window-focus").length, 1);
    assert.equal(renderer.focusCalls.filter((call) => call === "renderer-focus").length, 1);
  } finally {
    renderer.cleanup();
  }
});

test("ordinary station QA preserves the physical seven-dot clear gesture despite delayed DOM projection and IPC", async () => {
  const renderer = await delayedStationRenderer();
  try {
    await sendAutomaticStationRun(renderer.window, ".", 7, { expectClear: true });
    assert.equal(renderer.pulseCount(), 0);
    assert.equal(renderer.decoded(), "");
  } finally {
    renderer.cleanup();
  }
});

test("segmented packaged QA preserves the 142-image baseline and adds five exact final chapter scopes", () => {
  assert.deepEqual(QA_SUPPORTED_SCOPES, [
    "full", "bootstrap", "inventory", "equipment", "practice", "qso", "expedition",
    "qsl-story", "service-net", "coordinate-relay", "contest", "listening", "storm-relay",
    "night-operations", "final-promise", "first-page",
  ]);
  const plan = buildQaSegmentPlan({ suffix: SUFFIX });
  assert.deepEqual(plan.segments.map(({ scope }) => scope), [
    "bootstrap", "inventory", "equipment", "practice", "qso", "expedition",
    "qsl-story", "service-net", "coordinate-relay", "contest", "listening", "storm-relay",
    "night-operations", "final-promise", "first-page", "lights",
  ]);

  const expectedByScope = Object.fromEntries(Object.entries(expectedCaptures)
    .map(([scope, stems]) => [scope, stems.map(filename)]));
  assert.deepEqual(Object.fromEntries(plan.segments.map(({ scope, screenshots }) => [scope, screenshots])), expectedByScope);

  const all = plan.segments.flatMap(({ screenshots }) => screenshots);
  assert.equal(all.length, 197);
  assert.equal(new Set(all).size, 197);
  assert.equal(plan.segments.find(({ scope }) => scope === "expedition").predecessor, "qso");
  assert.equal(plan.segments.find(({ scope }) => scope === "qsl-story").predecessor, "expedition");
  assert.equal(plan.segments.find(({ scope }) => scope === "service-net").predecessor, "qsl-story");
  assert.equal(plan.segments.find(({ scope }) => scope === "coordinate-relay").predecessor, "service-net");
  assert.equal(plan.segments.find(({ scope }) => scope === "contest").predecessor, "coordinate-relay");
  assert.equal(plan.segments.find(({ scope }) => scope === "listening").predecessor, "contest");
  assert.equal(plan.segments.find(({ scope }) => scope === "storm-relay").predecessor, "listening");
  assert.equal(plan.segments.find(({ scope }) => scope === "night-operations").predecessor, "storm-relay");
  assert.equal(plan.segments.find(({ scope }) => scope === "final-promise").predecessor, "night-operations");
  assert.equal(plan.segments.find(({ scope }) => scope === "first-page").predecessor, "final-promise");
  assert.equal(plan.segments.find(({ scope }) => scope === "expedition").timeoutMs, 8 * 60_000);
  assert.equal(plan.segments.find(({ scope }) => scope === "lights").timeoutMs, 8 * 60_000);
  assert.equal(plan.segments.find(({ scope }) => scope === "qso").timeoutMs, 8 * 60_000);
  assert.equal(plan.segments.find(({ scope }) => scope === "bootstrap").timeoutMs, 5 * 60_000);
});

test("chapter seven through ten evidence validators require literal linked gameplay facts", () => {
  const common = { schemaVersion: 1, qaRunId: QA_RUN_ID, settled: true, missionClaimed: true, reloadPersisted: true, duplicateSettlementExecuted: true, duplicateSettlementNoOp: true };
  const fixtures = [
    [validateQslStoryQaEvidence, { ...common, activity: "qsl-story", sourcePersonId: "person:sora", finalChoice: "request-review", eventQsoCount: 1 }],
    [validateServiceNetQaEvidence, { ...common, activity: "service-net", messageCount: 3, receiptCount: 3, eventQsoCount: 1 }],
    [validateCoordinateRelayQaEvidence, { ...common, activity: "coordinate-relay", packetId: "123", grid: "PX-1234-5678", eventQsoCount: 2 }],
    [validateContestQaEvidence, { ...common, activity: "contest", configuredWpm: 22, validContacts: 6, runContacts: 3, spContacts: 3, uniqueRegions: 3, eventQsoCount: 6, grade: "complete" }],
  ];
  for (const [validate, evidence] of fixtures) {
    assert.deepEqual(validate(evidence, { qaRunId: QA_RUN_ID }), evidence);
    assert.throws(() => validate({ ...evidence, qaRunId: "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee" }, { qaRunId: QA_RUN_ID }), /run id/i);
    assert.throws(() => validate({ ...evidence, settled: false }, { qaRunId: QA_RUN_ID }), /evidence/i);
  }
  assert.throws(() => validateContestQaEvidence({ ...fixtures.at(-1)[1], configuredWpm: 18 }, { qaRunId: QA_RUN_ID }), /contest/i);
});

test("contest packaged QA configures 22 WPM through the real settings controls before the clock starts", async () => {
  let draftWpm = 18;
  let appliedWpm = 18;
  const events = [];
  const window = {};
  const dependencies = {
    focusFn: async (_window, context) => { events.push(`focus:${context}`); },
    pressKeyFn: async (_window, key) => { events.push(`key:${key.code}`); },
    waitForFn: async (_window, selector) => { events.push(`wait:${selector}`); },
    waitForMissingFn: async (_window, selector) => { events.push(`missing:${selector}`); },
    clickFn: async (_window, selector) => {
      events.push(`click:${selector}`);
      if (selector.includes("Increase WPM")) draftWpm += 1;
      if (selector.includes("primary-button")) appliedWpm = draftWpm;
    },
    readDraftWpmFn: async () => draftWpm,
    waitForDraftWpmFn: async (_window, expected) => assert.equal(draftWpm, expected),
    waitForContestWpmFn: async (_window, expected) => assert.equal(appliedWpm, expected),
  };

  assert.equal(await configureContestQaWpm(window, 22, dependencies), 22);
  assert.equal(events.filter((event) => event.includes("Increase WPM")).length, 4);
  assert.equal(events.filter((event) => event.includes("primary-button")).length, 1);
  assert.equal(events.at(0), "focus:before opening contest settings");
  assert.equal(events.at(-1), "focus:after applying contest settings");
});

test("contest packaged recovery keys AGN through the real automatic keyer", async () => {
  const qaCaptureSource = await fs.readFile(path.join(__dirname, "..", "electron", "qa-capture.cjs"), "utf8");
  assert.match(
    qaCaptureSource,
    /await click\(window, '\[data-action="contest-agn"\]'\);[\s\S]*await submitContestAutomatic\(window, "AGN K", "EXCHANGE"\)/,
  );
});

test("expedition evidence binds gameplay recovery, settlement, reload, relationship and one-time QSL choice to the QA run", () => {
  const evidence = {
    schemaVersion: 1,
    qaRunId: QA_RUN_ID,
    activity: "hill-expedition",
    failurePenaltyApplied: true,
    recoveryAction: "AGN",
    result: "success",
    settled: true,
    relationshipPersonId: "person:sora",
    qslPersonId: "person:sora",
    qslChoice: "believe",
    qslChoicePersistedAfterReload: true,
    duplicateChoiceNoOp: true,
    timerPausedWithoutCatchUp: true,
    timeoutReachable: true,
    powerDepletedReachable: true,
    replayEntryPersisted: true,
    replayRewardNoOp: true,
  };
  assert.deepEqual(validateExpeditionQaEvidence(evidence, { qaRunId: QA_RUN_ID }), evidence);
  for (const [key, value] of [
    ["qaRunId", "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee"],
    ["failurePenaltyApplied", false], ["recoveryAction", ""], ["result", "failed"],
    ["settled", false], ["qslChoicePersistedAfterReload", false], ["duplicateChoiceNoOp", false],
    ["timerPausedWithoutCatchUp", false], ["timeoutReachable", false],
    ["powerDepletedReachable", false], ["replayEntryPersisted", false], ["replayRewardNoOp", false],
  ]) {
    assert.throws(() => validateExpeditionQaEvidence({ ...evidence, [key]: value }, { qaRunId: QA_RUN_ID }), /expedition|run id|evidence/i, key);
  }
});

test("packaged expedition QA leaves the guarded active run before fixture reloads", async () => {
  const qaSource = await fs.readFile(path.join(__dirname, "../electron/qa-capture.cjs"), "utf8");
  assert.match(
    qaSource,
    /async function leaveExpeditionToHome[\s\S]*expedition-confirm-leave[\s\S]*readyRunFixture[\s\S]*leaveExpeditionToHome\(\)[\s\S]*async function reopenExpeditionWithRun/,
  );
  assert.match(
    qaSource,
    /async function reopenExpeditionWithRun[\s\S]*focusQaWindow\(window, "before expedition timer evidence"\)[\s\S]*data-expedition-window-active="true"\]\[data-expedition-paused="false"/,
  );
  assert.match(
    qaSource,
    /waitForMissing\(window, "\.settings-modal"\)[\s\S]*focusQaWindow\(window, "after closing expedition settings"\)[\s\S]*data-expedition-window-active="true"\]\[data-expedition-paused="false"/,
  );
  assert.doesNotMatch(qaSource, /batteryFixture\.power\.usedMilliWattMilliseconds\s*=/);
  assert.match(
    qaSource,
    /const setupRunFixture[\s\S]*reopenExpeditionWithRun\(setupRunFixture\)[\s\S]*expedition-setup-antenna[\s\S]*mistake < 3[\s\S]*expedition-setup-wrong[\s\S]*POWER_DEPLETED/,
  );
});

test("PNG evidence requires initial 13-byte IHDR, bounded chunks, IDAT, and final IEND", () => {
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(1439, 0);
  ihdr.writeUInt32BE(912, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  const cases = [
    [Buffer.concat([signature, pngChunkWithCrc("tEXt", ihdr), pngChunkWithCrc("IDAT"), pngChunkWithCrc("IEND")]), /IHDR/],
    [Buffer.concat([signature, pngChunkWithCrc("IHDR", ihdr.subarray(0, 12)), pngChunkWithCrc("IDAT"), pngChunkWithCrc("IEND")]), /13-byte IHDR/],
    [Buffer.concat([signature, pngChunkWithCrc("IHDR", ihdr), pngChunkWithCrc("IEND")]), /IDAT/],
    [Buffer.concat([signature, pngChunkWithCrc("IHDR", ihdr), pngChunkWithCrc("IDAT")]), /IEND/],
    [Buffer.concat([validCapturePng(), Buffer.from([0])]), /IEND|final chunk/],
  ];
  for (const [buffer, pattern] of cases) {
    assert.throws(() => validatePngScreenshot(buffer, "proof-1439x912.png"), pattern);
  }
});

test("PNG evidence accepts only four ASCII-letter chunk types and rejects unknown critical chunks", () => {
  const valid = validCapturePng();
  const ihdrEnd = 8 + 4 + 4 + 13 + 4;
  const invalidType = Buffer.concat([
    valid.subarray(0, ihdrEnd),
    pngChunkWithCrc("ID1T", Buffer.alloc(0)),
    valid.subarray(ihdrEnd),
  ]);
  const unknownCritical = Buffer.concat([
    valid.subarray(0, ihdrEnd),
    pngChunkWithCrc("ABCD", Buffer.alloc(0)),
    valid.subarray(ihdrEnd),
  ]);
  assert.throws(() => validatePngScreenshot(invalidType, "proof-1439x912.png"), /chunk type|ASCII letters/i);
  assert.throws(() => validatePngScreenshot(unknownCritical, "proof-1439x912.png"), /unknown critical/i);
});

test("PNG evidence requires all IDAT chunks to be consecutive", () => {
  const width = 1439;
  const height = 912;
  const raw = Buffer.alloc(((width * 4) + 1) * height);
  const compressed = deflateSync(raw);
  const split = Math.max(1, Math.floor(compressed.length / 2));
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  const separatedIdat = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunkWithCrc("IHDR", ihdr),
    pngChunkWithCrc("IDAT", compressed.subarray(0, split)),
    pngChunkWithCrc("tEXt", Buffer.from("qa")),
    pngChunkWithCrc("IDAT", compressed.subarray(split)),
    pngChunkWithCrc("IEND"),
  ]);
  assert.throws(() => validatePngScreenshot(separatedIdat, "proof-1439x912.png"), /IDAT.*consecutive/i);
});

test("packaged expedition QA proves duplicate QSL confirmation preserves confirmedAt", () => {
  const source = require("node:fs").readFileSync(
    path.join(__dirname, "..", "electron", "qa-capture.cjs"),
    "utf8",
  );
  assert.match(source, /afterDuplicate\[0\]\.confirmedAt === afterFirst\[0\]\.confirmedAt/);
  assert.match(source, /duplicateChoiceNoOp:\s*duplicateChoiceNoOp/);
});

test("PNG evidence rejects chunks with forged CRC values", () => {
  assert.throws(
    () => validatePngScreenshot(forgedCrcPng(), "proof-1439x912.png"),
    /CRC/i,
  );
  for (const type of ["IHDR", "IDAT", "IEND"]) {
    assert.throws(
      () => validatePngScreenshot(
        corruptChunkCrc(validCapturePng(), type),
        "proof-1439x912.png",
      ),
      new RegExp(`${type} chunk CRC`, "i"),
    );
  }
});

test("PNG evidence rejects a CRC-valid shell whose IDAT cannot inflate", () => {
  assert.throws(
    () => validatePngScreenshot(crcValidPngShell(), "proof-1439x912.png"),
    /inflate|zlib|pixel/i,
  );
});

test("PNG evidence accepts only the RGB8 and RGBA8 capture formats", () => {
  assert.deepEqual(validatePngScreenshot(
    validCapturePng(1439, 912, 2),
    "proof-1439x912.png",
  ), { width: 1439, height: 912 });
  assert.deepEqual(validatePngScreenshot(
    validCapturePng(1439, 912, 6),
    "proof-1439x912.png",
  ), { width: 1439, height: 912 });
  const compressed = deflateSync(Buffer.alloc(1));
  assert.throws(
    () => validatePngScreenshot(
      crcValidPngShell(1439, 912, { bitDepth: 16, colorType: 6, idat: compressed }),
      "proof-1439x912.png",
    ),
    /bit depth|format/i,
  );
  assert.throws(
    () => validatePngScreenshot(
      crcValidPngShell(1439, 912, { bitDepth: 8, colorType: 0, idat: compressed }),
      "proof-1439x912.png",
    ),
    /color type|format/i,
  );
});

test("PNG evidence rejects fully transparent and uniform black placeholder captures", () => {
  const width = 1439;
  const height = 912;
  const rgbaScanlineBytes = (width * 4) + 1;
  const transparent = Buffer.alloc(rgbaScanlineBytes * height);
  assert.throws(
    () => validatePngScreenshot(crcValidPngShell(width, height, {
      colorType: 6,
      idat: deflateSync(transparent),
    }), "transparent-1439x912.png"),
    /visible pixels|transparent|placeholder/i,
  );

  const black = Buffer.alloc(rgbaScanlineBytes * height);
  for (let row = 0; row < height; row += 1) {
    for (let offset = (row * rgbaScanlineBytes) + 4; offset < (row + 1) * rgbaScanlineBytes; offset += 4) {
      black[offset] = 0xff;
    }
  }
  assert.throws(
    () => validatePngScreenshot(crcValidPngShell(width, height, {
      colorType: 6,
      idat: deflateSync(black),
    }), "black-1439x912.png"),
    /variation|uniform|placeholder/i,
  );
});

test("pixel-hash duplicate policy rejects copied, unapproved, and over-broad screenshot groups", () => {
  const copied = Array.from({ length: 102 }, (_, index) => ({
    path: `segments/bootstrap/copied-${index}-1439x912.png`,
    pixelHash: "same-pixels",
  }));
  assert.throws(() => validatePixelHashGroups(copied, { suffix: "1439x912" }), /duplicate|pixel/i);

  assert.throws(() => validatePixelHashGroups([
    { path: "segments/practice/unapproved-a-1439x912.png", pixelHash: "same-pixels" },
    { path: "segments/practice/unapproved-b-1439x912.png", pixelHash: "same-pixels" },
  ], { suffix: "1439x912" }), /duplicate|allowlist/i);

  const approved = [
    { path: "segments/inventory/warehouse-radio-warmup-1439x912.png", pixelHash: "same-pixels" },
    { path: "segments/inventory/warehouse-radio-1439x912.png", pixelHash: "same-pixels" },
  ];
  assert.doesNotThrow(() => validatePixelHashGroups(approved, { suffix: "1439x912" }));
  assert.throws(() => validatePixelHashGroups([
    ...approved,
    { path: "segments/inventory/warehouse-radio-third-1439x912.png", pixelHash: "same-pixels" },
  ], { suffix: "1439x912" }), /duplicate|allowlist|member/i);

  const emptyLogWarmup = [
    { path: "segments/inventory/home-log-empty-warmup-1439x912.png", pixelHash: "same-pixels" },
    { path: "segments/inventory/home-log-empty-1439x912.png", pixelHash: "same-pixels" },
  ];
  assert.doesNotThrow(() => validatePixelHashGroups(emptyLogWarmup, { suffix: "1439x912" }));
  assert.throws(() => validatePixelHashGroups([
    ...emptyLogWarmup,
    { path: "segments/inventory/home-log-empty-copy-1439x912.png", pixelHash: "same-pixels" },
  ], { suffix: "1439x912" }), /duplicate|allowlist|member/i);

  const chapterHandoff = [
    { path: "segments/qsl-story/qsl-reloaded-1439x912.png", pixelHash: "same-pixels" },
    { path: "segments/service-net/service-mission-available-1439x912.png", pixelHash: "same-pixels" },
  ];
  assert.doesNotThrow(() => validatePixelHashGroups(chapterHandoff, { suffix: "1439x912" }));
  assert.throws(() => validatePixelHashGroups([
    ...chapterHandoff,
    { path: "segments/service-net/service-briefing-1439x912.png", pixelHash: "same-pixels" },
  ], { suffix: "1439x912" }), /duplicate|allowlist|member/i);

  for (const handoff of [
    ["segments/service-net/service-reloaded", "segments/coordinate-relay/coordinate-mission-available"],
    ["segments/coordinate-relay/coordinate-reloaded", "segments/contest/contest-mission-available"],
  ]) {
    const pair = handoff.map((stem) => ({ path: `${stem}-1439x912.png`, pixelHash: "same-pixels" }));
    assert.doesNotThrow(() => validatePixelHashGroups(pair, { suffix: "1439x912" }));
    assert.throws(() => validatePixelHashGroups([
      ...pair,
      { path: `${handoff[1]}-copy-1439x912.png`, pixelHash: "same-pixels" },
    ], { suffix: "1439x912" }), /duplicate|allowlist|member/i);
  }
});

test("practice guidance capture opens a visually distinct aid before taking evidence", async () => {
  const practiceSource = await fs.readFile(path.join(__dirname, "../src/practice/PracticeScreen.jsx"), "utf8");
  const qaSource = await fs.readFile(path.join(__dirname, "../electron/qa-capture.cjs"), "utf8");
  assert.match(practiceSource, /data-action="practice-visual-aid"/);
  assert.match(
    qaSource,
    /click\(window, '\[data-action="practice-visual-aid"\]'\)[\s\S]*waitFor\(window, "\.practice-prompt code"\)[\s\S]*shot\("practice-lesson-guidance"\)/,
  );
});

test("PNG evidence requires the exact inflated scanline byte length", () => {
  const png = crcValidPngShell(1439, 912, {
    colorType: 6,
    idat: deflateSync(Buffer.alloc(1)),
  });
  assert.throws(
    () => validatePngScreenshot(png, "proof-1439x912.png"),
    /inflated pixel length|scanline length/i,
  );
});

test("PNG evidence rejects an invalid filter byte on any inflated scanline", () => {
  const width = 1439;
  const height = 912;
  const scanlineBytes = (width * 4) + 1;
  const raw = Buffer.alloc(scanlineBytes * height);
  raw[scanlineBytes * 400] = 5;
  const png = crcValidPngShell(width, height, {
    colorType: 6,
    idat: deflateSync(raw),
  });
  assert.throws(
    () => validatePngScreenshot(png, "proof-1439x912.png"),
    /filter byte.*row 400/i,
  );
});

test("external supervisor refuses an existing evidence root before a no-op child can reuse 91 stale captures", async () => {
  const outputRoot = await fs.mkdtemp(path.join(os.tmpdir(), "cwgame-supervisor-stale-root-"));
  const plan = buildQaSegmentPlan({ suffix: SUFFIX });
  for (const segment of plan.segments) {
    const segmentDir = path.join(outputRoot, "segments", segment.scope);
    await fs.mkdir(segmentDir, { recursive: true });
    for (const screenshot of segment.screenshots) {
      await fs.writeFile(path.join(segmentDir, screenshot), "stale screenshot");
    }
  }
  const oldManifest = '{"schemaVersion":1,"totalPhysicalCaptures":91,"stale":true}\n';
  await fs.writeFile(path.join(outputRoot, "qa-result.json"), oldManifest);
  let spawnCalls = 0;
  const spawnImpl = () => {
    spawnCalls += 1;
    const child = new EventEmitter();
    child.pid = 4001;
    setImmediate(() => child.emit("close", 0, null));
    return child;
  };

  await assert.rejects(() => runPackagedQa({
    exe: "CWGame-latest.exe", outputRoot, suffix: SUFFIX, spawnImpl,
  }), /already exists|exclusive|fresh/i);
  assert.equal(spawnCalls, 0);
  assert.equal(await fs.readFile(path.join(outputRoot, "qa-result.json"), "utf8"), oldManifest);
});

test("QA state envelopes preserve only the three raw durable storage keys", () => {
  assert.deepEqual(QA_STORAGE_KEYS, [
    "game-morse-adventurer.saves.v1",
    "game-morse-adventurer.active-save.v1",
    "game-morse-adventurer.language.v1",
  ]);
  const storage = saveStorage();
  const envelope = createQaStateEnvelope({ qaRunId: QA_RUN_ID, producerScope: "equipment", storage });
  assert.deepEqual(envelope, {
    schemaVersion: 1,
    qaRunId: QA_RUN_ID,
    producerScope: "equipment",
    storage,
    facts: {},
  });
  assert.deepEqual(validateQaStateEnvelope(envelope, { consumerScope: "practice", qaRunId: QA_RUN_ID }), envelope);
  assert.throws(
    () => validateQaStateEnvelope(envelope, {
      consumerScope: "practice", qaRunId: "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee",
    }),
    /run id/i,
  );
});

test("practice state carries one validated wrong-target fact into qso", () => {
  const storage = saveStorage({ recentTargets: ["A", "N", "T", "E"] });
  const envelope = createQaStateEnvelope({
    qaRunId: QA_RUN_ID,
    producerScope: "practice",
    storage,
    facts: { practiceWrongTarget: "N" },
  });
  assert.deepEqual(validateQaStateEnvelope(envelope, { consumerScope: "qso", qaRunId: QA_RUN_ID }), envelope);

  assert.throws(() => createQaStateEnvelope({
    qaRunId: QA_RUN_ID,
    producerScope: "practice",
    storage,
    facts: { practiceWrongTarget: "Q" },
  }), /practiceWrongTarget.*recentTargets/);
});

test("QA state rejects hostile or non-adjacent segment input", () => {
  const storage = saveStorage();
  const valid = createQaStateEnvelope({ qaRunId: QA_RUN_ID, producerScope: "bootstrap", storage });
  const cases = [
    [{ ...valid, schemaVersion: 2 }, { consumerScope: "inventory", qaRunId: QA_RUN_ID }, /schemaVersion/],
    [{ ...valid, producerScope: "equipment" }, { consumerScope: "inventory", qaRunId: QA_RUN_ID }, /predecessor/],
    [{ ...valid, storage: { ...storage, extra: "forbidden" } }, { consumerScope: "inventory", qaRunId: QA_RUN_ID }, /storage key/],
    [{ ...valid, storage: { ...storage, [QA_STORAGE_KEYS[0]]: "{" } }, { consumerScope: "inventory", qaRunId: QA_RUN_ID }, /saves/],
    [{ ...valid, storage: { ...storage, [QA_STORAGE_KEYS[1]]: "missing" } }, { consumerScope: "inventory", qaRunId: QA_RUN_ID }, /active save/],
    [{ ...valid, storage: { ...storage, [QA_STORAGE_KEYS[2]]: "xx" } }, { consumerScope: "inventory", qaRunId: QA_RUN_ID }, /language/],
    [null, { consumerScope: "inventory", qaRunId: QA_RUN_ID }, /state input/],
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
  let resizeOptions = null;
  const image = {
    getSize: () => ({ width: 2878, height: 1824 }),
    resize(options) {
      resizeOptions = options;
      return { toPNG: () => Buffer.from("png-contract") };
    },
    toPNG: () => Buffer.from("unscaled-png"),
  };
  const qaWindow = {
    webContents: {
      executeJavaScript: () => rendererGate,
      capturePage: async () => image,
    },
  };

  const capturePromise = capture(qaWindow, outputDir, "start-1439x912.png", { scope: "bootstrap" });
  await new Promise((resolve) => setTimeout(resolve, 20));
  const started = JSON.parse(await fs.readFile(path.join(outputDir, "qa-step.txt"), "utf8"));
  assert.equal(started.scope, "bootstrap");
  assert.equal(started.filename, "start-1439x912.png");
  assert.equal(started.phase, "capture-start");
  assert.equal(typeof started.at, "string");
  await assert.rejects(fs.access(path.join(outputDir, "start-1439x912.png")));

  releaseRenderer();
  await capturePromise;
  assert.deepEqual(resizeOptions, { width: 1439, height: 912, quality: "best" });
  assert.equal(await fs.readFile(path.join(outputDir, "start-1439x912.png"), "utf8"), "png-contract");
  const completed = JSON.parse(await fs.readFile(path.join(outputDir, "qa-step.txt"), "utf8"));
  assert.equal(completed.phase, "capture-complete");
  assert.equal(completed.scope, "bootstrap");
  assert.equal(completed.filename, "start-1439x912.png");
});

test("image decode readiness is bounded when Chromium leaves a decode promise pending", async () => {
  const started = Date.now();
  const result = await waitForRendererImages({
    executeJavaScript: () => new Promise(() => {}),
  }, { timeoutMs: 20 });

  assert.deepEqual(result, { timedOut: true });
  assert.ok(Date.now() - started < 500, "renderer image wait must not consume the five-minute segment budget");
});

async function writeSuccessfulFakeSegment(env, scope) {
  const outputDir = env.CWGAME_QA_OUTPUT;
  const qaRunId = env.CWGAME_QA_RUN_ID ?? QA_RUN_ID;
  const segment = buildQaSegmentPlan({ suffix: env.CWGAME_QA_SUFFIX }).segments
    .find((candidate) => candidate.scope === scope);
  await fs.mkdir(outputDir, { recursive: true });
  for (const screenshot of segment.screenshots) {
    await fs.writeFile(path.join(outputDir, screenshot), validCapturePng(1439, 912, 6, fixtureVariant(`${scope}/${screenshot}`)));
  }
  await fs.writeFile(path.join(outputDir, "runtime-console-errors.json"), "[]\n");
  if (scope === "expedition") {
    await fs.writeFile(path.join(outputDir, "expedition-qa-result.json"), `${JSON.stringify({
      schemaVersion: 1, qaRunId, activity: "hill-expedition", failurePenaltyApplied: true,
      recoveryAction: "AGN", result: "success", settled: true,
      relationshipPersonId: "person:sora", qslPersonId: "person:sora", qslChoice: "believe",
      qslChoicePersistedAfterReload: true, duplicateChoiceNoOp: true,
      timerPausedWithoutCatchUp: true, timeoutReachable: true, powerDepletedReachable: true,
      replayEntryPersisted: true, replayRewardNoOp: true,
    })}\n`);
  }
  const chapterEvidence = {
    "qsl-story": ["qsl-story-qa-result.json", {
      schemaVersion: 1, qaRunId, activity: "qsl-story", settled: true, missionClaimed: true,
      reloadPersisted: true, duplicateSettlementExecuted: true, duplicateSettlementNoOp: true, sourcePersonId: "person:sora",
      finalChoice: "request-review", eventQsoCount: 1,
    }],
    "service-net": ["service-net-qa-result.json", {
      schemaVersion: 1, qaRunId, activity: "service-net", settled: true, missionClaimed: true,
      reloadPersisted: true, duplicateSettlementExecuted: true, duplicateSettlementNoOp: true, messageCount: 3, receiptCount: 3, eventQsoCount: 1,
    }],
    "coordinate-relay": ["coordinate-relay-qa-result.json", {
      schemaVersion: 1, qaRunId, activity: "coordinate-relay", settled: true, missionClaimed: true,
      reloadPersisted: true, duplicateSettlementExecuted: true, duplicateSettlementNoOp: true, packetId: "123", grid: "PX-1234-5678", eventQsoCount: 2,
    }],
    contest: ["contest-qa-result.json", {
      schemaVersion: 1, qaRunId, activity: "contest", settled: true, missionClaimed: true,
      reloadPersisted: true, duplicateSettlementExecuted: true, duplicateSettlementNoOp: true, validContacts: 6, runContacts: 3,
      spContacts: 3, uniqueRegions: 3, eventQsoCount: 6, grade: "complete", configuredWpm: 22,
    }],
    listening: ["listening-qa-result.json", {
      schemaVersion: 1, qaRunId, activity: "listening", settled: true, missionClaimed: true,
      reloadPersisted: true, duplicateSettlementExecuted: true, duplicateSettlementNoOp: true,
      focusPauseVerified: true, replayRewardNoOp: true, rawPlayerTextPersisted: false,
      observationCount: 3, callCount: 1, eventQsoCount: 0,
      conclusionKey: "chapter11.conclusion.no-reply-after-listening",
    }],
    "storm-relay": ["storm-relay-qa-result.json", {
      schemaVersion: 1, qaRunId, activity: "storm-relay", settled: true, missionClaimed: true,
      reloadPersisted: true, duplicateSettlementExecuted: true, duplicateSettlementNoOp: true,
      focusPauseVerified: true, replayRewardNoOp: true, rawPlayerTextPersisted: false,
      canonicalRevision: 2, eventQsoCount: 2, relationshipCount: 2, failureRecoveryVerified: true,
    }],
    "night-operations": ["night-operations-qa-result.json", {
      schemaVersion: 1, qaRunId, activity: "night-operations", settled: true, missionClaimed: true,
      reloadPersisted: true, duplicateSettlementExecuted: true, duplicateSettlementNoOp: true,
      focusPauseVerified: true, replayRewardNoOp: true, rawPlayerTextPersisted: false,
      contactCount: 3, eventQsoCount: 3, relationshipCount: 3, distinctPersonCount: 3,
    }],
    "final-promise": ["final-promise-qa-result.json", {
      schemaVersion: 1, qaRunId, activity: "final-promise", settled: true, missionClaimed: true,
      reloadPersisted: true, duplicateSettlementExecuted: true, duplicateSettlementNoOp: true,
      focusPauseVerified: true, replayRewardNoOp: true, rawPlayerTextPersisted: false,
      recipientPersonId: "person:chapter14:final-recipient", tone: "steady", eventQsoCount: 1,
      relationshipCount: 1, qslLinked: true, accountRepeatVerified: true,
    }],
    "first-page": ["first-page-qa-result.json", {
      schemaVersion: 1, qaRunId, activity: "first-page", settled: true, missionClaimed: true,
      reloadPersisted: true, duplicateSettlementExecuted: true, duplicateSettlementNoOp: true,
      focusPauseVerified: true, replayRewardNoOp: true, rawPlayerTextPersisted: false,
      ordinaryQsoIncrease: 1, countedQsoCreditsPositive: true, countedQsoPostAcceptance: true,
      countedQsoEventFree: true, firstGoal: "world-log", openStationUnlocked: true,
      activeGoalUpdatedAfterReload: true,
    }],
  }[scope];
  if (chapterEvidence) {
    await fs.writeFile(path.join(outputDir, chapterEvidence[0]), `${JSON.stringify(chapterEvidence[1])}\n`);
  }
  if (env.CWGAME_QA_STATE_OUT) {
    const state = createQaStateEnvelope({
      qaRunId,
      producerScope: scope,
      storage: saveStorage(),
      facts: scope === "practice" ? { practiceWrongTarget: "N" } : {},
    });
    await fs.writeFile(env.CWGAME_QA_STATE_OUT, `${JSON.stringify(state)}\n`);
  }
  await fs.writeFile(path.join(outputDir, "qa-segment-result.json"), `${JSON.stringify({
    schemaVersion: 1,
    qaRunId,
    scope,
    captures: segment.screenshots,
    consoleErrorCount: 0,
    completedAt: "2026-08-26T00:00:00.000Z",
  })}\n`);
}

test("chapter segment validation fails closed when its gameplay result is missing", async () => {
  const outputDir = await fs.mkdtemp(path.join(os.tmpdir(), "cwgame-chapter-result-missing-"));
  const env = { CWGAME_QA_OUTPUT: outputDir, CWGAME_QA_RUN_ID: QA_RUN_ID, CWGAME_QA_SUFFIX: SUFFIX,
    CWGAME_QA_STATE_OUT: path.join(outputDir, "qa-state-out.json") };
  await writeSuccessfulFakeSegment(env, "qsl-story");
  await fs.rm(path.join(outputDir, "qsl-story-qa-result.json"));
  const segment = buildQaSegmentPlan({ suffix: SUFFIX }).segments.find(({ scope }) => scope === "qsl-story");
  await assert.rejects(() => validateQaSegmentArtifacts(segment, outputDir, { qaRunId: QA_RUN_ID }), /missing gameplay evidence/);
});

test("external supervisor launches fresh ordered segment processes and stops at the first child failure", async () => {
  const outputRoot = await freshOutputRoot("cwgame-supervisor-order-");
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
  assert.match(launches[0].env.CWGAME_QA_RUN_ID, /^[0-9a-f-]{36}$/i);
  assert.equal(launches[1].env.CWGAME_QA_RUN_ID, launches[0].env.CWGAME_QA_RUN_ID);
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
        schemaVersion: 1, qaRunId: env.CWGAME_QA_RUN_ID,
        scope: "bootstrap", captures: expectedCaptures.bootstrap.map(filename),
        consoleErrorCount: 1, completedAt: "2026-08-26T00:00:00.000Z",
      }));
    }, /console/],
    ["zero screenshot", async (dir, env) => {
      await writeSuccessfulFakeSegment(env, "bootstrap");
      await fs.writeFile(path.join(dir, expectedCaptures.bootstrap.map(filename)[0]), "");
    }, /missing or empty/],
    ["text screenshot", async (dir, env) => {
      await writeSuccessfulFakeSegment(env, "bootstrap");
      await fs.writeFile(path.join(dir, expectedCaptures.bootstrap.map(filename)[0]), "not a PNG");
    }, /PNG/i],
    ["truncated screenshot", async (dir, env) => {
      await writeSuccessfulFakeSegment(env, "bootstrap");
      await fs.writeFile(
        path.join(dir, expectedCaptures.bootstrap.map(filename)[0]),
        validCapturePng().subarray(0, -1),
      );
    }, /PNG|truncated|IEND/i],
    ["wrong screenshot dimensions", async (dir, env) => {
      await writeSuccessfulFakeSegment(env, "bootstrap");
      await fs.writeFile(
        path.join(dir, expectedCaptures.bootstrap.map(filename)[0]),
        validCapturePng(1438, 912),
      );
    }, /dimensions|1439x912/i],
    ["bad state", async (_dir, env) => {
      await writeSuccessfulFakeSegment(env, "bootstrap");
      await fs.writeFile(env.CWGAME_QA_STATE_OUT, '{"schemaVersion":1}');
    }, /state|run id/i],
    ["mismatched run id", async (dir, env) => {
      await writeSuccessfulFakeSegment(env, "bootstrap");
      const sentinelFile = path.join(dir, "qa-segment-result.json");
      const sentinel = JSON.parse(await fs.readFile(sentinelFile, "utf8"));
      await fs.writeFile(sentinelFile, JSON.stringify({ ...sentinel, qaRunId: QA_RUN_ID }));
    }, /run id/i],
  ];
  for (const [label, arrange, expected] of failureCases) {
    const outputRoot = await freshOutputRoot(`cwgame-supervisor-${label.replace(" ", "-")}-`);
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
    await assert.rejects(fs.access(path.join(outputRoot, "qa-result.json")), undefined, label);
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

test("timeout marker write failure still kills and rejects exactly once without an unhandled rejection", async () => {
  const outputDir = await fs.mkdtemp(path.join(os.tmpdir(), "cwgame-supervisor-timeout-marker-failure-"));
  const child = new EventEmitter();
  child.pid = 4313;
  let markerWriteCalls = 0;
  let killCalls = 0;
  let cleared = 0;
  const unhandled = [];
  const onUnhandled = (error) => { unhandled.push(error); };
  process.on("unhandledRejection", onUnhandled);
  try {
    const execution = runQaChildProcess({
      executable: "CWGame-latest.exe",
      args: ["--qa-capture"],
      env: {},
      outputDir,
      scope: "qso",
      timeoutMs: 1,
      spawnImpl: () => child,
      writeFileImpl: async () => {
        markerWriteCalls += 1;
        throw new Error("disk denied");
      },
      killTreeImpl: async () => {
        killCalls += 1;
        child.emit("close", 1, null);
      },
      clearTimeoutImpl: (timer) => { cleared += 1; clearTimeout(timer); },
    });
    await assert.rejects(
      Promise.race([
        execution,
        new Promise((_, reject) => setTimeout(() => reject(new Error("TEST_TIMEOUT")), 250)),
      ]),
      /qso.*timed out/,
    );
    child.emit("close", 0, null);
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(markerWriteCalls, 1);
    assert.equal(killCalls, 1);
    assert.equal(cleared, 1);
    assert.deepEqual(unhandled, []);
    await assert.rejects(fs.access(path.join(outputDir, "qa-timeout.json")));
  } finally {
    process.removeListener("unhandledRejection", onUnhandled);
  }
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
  const state = createQaStateEnvelope({ qaRunId: QA_RUN_ID, producerScope: "bootstrap", storage });
  const qaWindow = rendererStorageWindow({
    "game-morse-adventurer.saves.v1": "stale",
    "unrelated.renderer.key": "fresh-profile-proof",
  });
  await importQaStateIntoRenderer(qaWindow, state, { consumerScope: "inventory", qaRunId: QA_RUN_ID });
  assert.equal(qaWindow.reloads(), 1);
  assert.equal(qaWindow.values.get("unrelated.renderer.key"), "fresh-profile-proof");
  assert.deepEqual(Object.fromEntries(QA_STORAGE_KEYS.map((key) => [key, qaWindow.values.get(key)])), storage);
});

test("renderer state export reads exactly the allowlist and validates practice facts", async () => {
  const storage = saveStorage();
  const qaWindow = rendererStorageWindow({ ...storage, "unrelated.renderer.key": "do-not-export" });
  const envelope = await exportQaStateFromRenderer(qaWindow, {
    qaRunId: QA_RUN_ID,
    producerScope: "practice",
    facts: { practiceWrongTarget: "A" },
  });
  assert.deepEqual(envelope, {
    schemaVersion: 1,
    qaRunId: QA_RUN_ID,
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
    qaRunId: QA_RUN_ID,
    outputDir,
    stateOutFile,
    scope: "practice",
    suffix: SUFFIX,
    consoleErrors: [],
    facts: { practiceWrongTarget: "A" },
  });
  assert.deepEqual(result, {
    schemaVersion: 1,
    qaRunId: QA_RUN_ID,
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
    qaRunId: QA_RUN_ID,
    runCaptureImpl: async () => ({ resultFile: "lights-qa-result.json", qaRunId: QA_RUN_ID }),
  });
  assert.equal(result.qaRunId, QA_RUN_ID);
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
