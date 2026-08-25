const assert = require("node:assert/strict");
const { createHash } = require("node:crypto");
const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const projectRoot = path.resolve(__dirname, "..");
const script = path.join(projectRoot, "scripts", "sync-semantic-model.mjs");
const assetDirectory = path.join(projectRoot, "runtime-models");
const modelName = "qso-semanticformer-v0.4.int8.onnx";
const contractName = "qso-semanticformer-v0.4.runtime-contract.json";
const expectedModelHash = "7cf7333e31c317db4c9636d4f74f83941865ae48d67ada4287884af65d203855";
const expectedContractHash = "73c7c96de8715602390c6b54a7847b6c06221ad98ba9374a0003b842b15f6de0";

function sha256(file) {
  return createHash("sha256").update(fs.readFileSync(file)).digest("hex");
}

function runSync(directory) {
  const sandbox = fs.mkdtempSync(path.join(os.tmpdir(), "cwgame-offline-sync-"));
  const preload = path.join(sandbox, "deny-network.cjs");
  fs.writeFileSync(preload, "global.fetch = async () => { throw new Error('NETWORK_DENIED'); };\n", "utf8");
  const result = spawnSync(process.execPath, ["--require", preload, script], {
    cwd: projectRoot,
    encoding: "utf8",
    env: {
      ...process.env,
      CWGAME_SEMANTIC_MODEL_DIR: directory,
      CWGAME_SEMANTIC_MODEL_SOURCE: "",
    },
  });
  fs.rmSync(sandbox, { recursive: true, force: true });
  return result;
}

test("tracked semantic runtime verifies successfully with all network access denied", () => {
  const result = runSync(assetDirectory);

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /verified local semantic runtime/i);
  assert.match(result.stdout, new RegExp(expectedModelHash));
  assert.equal(sha256(path.join(assetDirectory, modelName)), expectedModelHash);
  assert.equal(sha256(path.join(assetDirectory, contractName)), expectedContractHash);
  const contract = JSON.parse(fs.readFileSync(path.join(assetDirectory, contractName), "utf8"));
  assert.equal(contract.contractVersion, "qso-semantic-runtime-4");
  assert.equal(contract.modelVersion, "qso-semanticformer-0.4");
});

test("a corrupt local model fails closed without network repair or byte replacement", () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "cwgame-corrupt-model-"));
  try {
    fs.copyFileSync(path.join(assetDirectory, contractName), path.join(directory, contractName));
    fs.writeFileSync(path.join(directory, modelName), Buffer.from("corrupt pinned model"));
    const corruptBytes = fs.readFileSync(path.join(directory, modelName));

    const result = runSync(directory);

    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /semantic model checksum mismatch/i);
    assert.doesNotMatch(result.stderr, /NETWORK_DENIED/);
    assert.deepEqual(fs.readFileSync(path.join(directory, modelName)), corruptBytes);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});
