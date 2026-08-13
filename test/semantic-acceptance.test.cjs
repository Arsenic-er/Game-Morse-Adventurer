const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const {
  MODEL_FILE,
  createSemanticRuntime,
} = require("../electron/semantic-runtime.cjs");

const projectRoot = path.resolve(__dirname, "..");
const assetDirectory = path.join(projectRoot, "runtime-models");
const fixture = JSON.parse(fs.readFileSync(
  path.join(__dirname, "fixtures", "semantic-acceptance.json"),
  "utf8",
));

function slotValues(result, topic) {
  return result.slots.filter((slot) => slot.topic === topic).map((slot) => slot.value);
}

test("critical semantic acceptance requires the release model and the real CPU provider", async () => {
  const modelPath = path.join(assetDirectory, MODEL_FILE);
  assert.ok(fs.existsSync(modelPath), `Critical semantic model is missing: ${modelPath}`);
  const runtime = createSemanticRuntime({ assetDirectory });
  const status = await runtime.status();
  assert.deepEqual(status.available, true);
  assert.equal(status.contractVersion, fixture.contractVersion);
  assert.equal(status.provider, fixture.provider);

  for (const spec of fixture.cases) {
    const result = await runtime.interpret(spec.payload);
    assert.equal(result.provider, fixture.provider, spec.id);
    assert.equal(result.contractVersion, fixture.contractVersion, spec.id);
    assert.equal(result.fallbackRequired, false, spec.id);
    assert.equal(result.safeToCommit, spec.expect.safeToCommit, spec.id);
    if (spec.expect.procedure) assert.equal(result.procedure.grade, spec.expect.procedure, spec.id);
    if (spec.expect.act) assert.ok(result.acts[spec.expect.act] >= spec.expect.minimum, spec.id);
    if (spec.expect.topic) assert.ok(result.topics[spec.expect.topic] >= spec.expect.minimum, spec.id);
    if (spec.expect.slot) assert.ok(slotValues(result, spec.expect.topic).includes(spec.expect.slot), spec.id);
    if (spec.expect.maximumInterpretability != null) {
      assert.ok(result.interpretability <= spec.expect.maximumInterpretability, spec.id);
    }
  }
});

test("corrupted N-best candidates remain unsafe while the recoverable candidate uses ONNX", async () => {
  const runtime = createSemanticRuntime({ assetDirectory });
  const { candidates, context, minimumAccepted } = fixture.corruptedNBest;
  const results = await Promise.all(candidates.map(({ message }) => runtime.interpret({ ...context, message })));
  results.forEach((result, index) => {
    assert.equal(result.provider, fixture.provider, candidates[index].message);
    assert.equal(result.fallbackRequired, false, candidates[index].message);
    assert.equal(result.safeToCommit, candidates[index].safeToCommit, candidates[index].message);
  });
  assert.ok(results.filter(({ safeToCommit }) => safeToCommit).length >= minimumAccepted);
});

test("dynamic save catalogs add values without replacing built-in semantic values", async () => {
  const runtime = createSemanticRuntime({ assetDirectory });
  const context = {
    phase: "PLAYER_OPTIONAL_ANSWER",
    pendingQuestion: "NAME",
    selfCallsign: "BH1ABC",
    peerCallsign: "SIM8CW",
    catalogs: { NAME: ["DIEGO"] },
  };
  const dynamic = await runtime.interpret({ ...context, message: "MY NAME DIEGO K" });
  const builtIn = await runtime.interpret({ ...context, message: "MY NAME SORA K" });
  assert.ok(slotValues(dynamic, "NAME").includes("DIEGO"));
  assert.ok(slotValues(builtIn, "NAME").includes("SORA"));
});

test("a missing semantic model reports unavailable and interpret rejects instead of faking provider success", async () => {
  const missingDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "cwgame-semantic-missing-"));
  try {
    const runtime = createSemanticRuntime({ assetDirectory: missingDirectory });
    const status = await runtime.status();
    assert.equal(status.available, false);
    assert.match(status.reason, /ENOENT|no such file/i);
    await assert.rejects(
      runtime.interpret({ message: "CQ CQ DE BH1ABC K", phase: "PLAYER_CQ", selfCallsign: "BH1ABC" }),
      /ENOENT|no such file/i,
    );
  } finally {
    fs.rmSync(missingDirectory, { recursive: true, force: true });
  }
});

test("renderer, IPC, and QSO settlement contracts forward bounded live state", () => {
  const mainSource = fs.readFileSync(path.join(projectRoot, "electron", "main.cjs"), "utf8");
  const appSource = fs.readFileSync(path.join(projectRoot, "src", "App.jsx"), "utf8");
  assert.match(mainSource, /semanticRuntime\.interpret\(sanitizeSemanticPayload\(payload\)\)/);
  assert.match(appSource, /catalogs:\s*semanticCatalogs/);
  for (const catalog of ["NAME", "LOCATION", "WEATHER", "RIG", "ANTENNA", "REGION"]) {
    assert.ok(appSource.includes(`${catalog}: [`), catalog);
  }
  assert.match(appSource, /transmitter\.panelLabel/);
  assert.match(appSource, /antenna\.names\?\.en/);
  assert.match(appSource, /qso\.npc\?\.operatorStyle/);
  assert.match(appSource, /missionStateVersion:\s*settlement\.save\.missionStateVersion/);
  assert.match(appSource, /missionState:\s*settlement\.save\.missionState/);
});
