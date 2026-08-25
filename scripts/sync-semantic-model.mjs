import { createHash } from "node:crypto";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectDirectory = path.resolve(scriptDirectory, "..");
const outputDirectory = process.env.CWGAME_SEMANTIC_MODEL_DIR
  ? path.resolve(process.env.CWGAME_SEMANTIC_MODEL_DIR)
  : path.join(projectDirectory, "runtime-models");
const sourceModelName = "qso-semanticformer-v0.4.release.int8.onnx";
const sourceContractName = "qso-semanticformer-v0.4.release.fp32.runtime-contract.json";
const outputModelName = "qso-semanticformer-v0.4.int8.onnx";
const outputContractName = "qso-semanticformer-v0.4.runtime-contract.json";
const release = Object.freeze({
  repository: "Arsenic-er/cwformer",
  commit: "7a1b896b9da07488cf46e8fd0911940ad11cd46e",
  directory: "releases/semantic-v0.4",
  modelSha256: "7cf7333e31c317db4c9636d4f74f83941865ae48d67ada4287884af65d203855",
  contractSha256: "73c7c96de8715602390c6b54a7847b6c06221ad98ba9374a0003b842b15f6de0",
});

function sha256(buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

async function downloadReleaseFile(fileName) {
  const baseUrl = `https://raw.githubusercontent.com/${release.repository}/${release.commit}/${release.directory}`;
  const url = `${baseUrl}/${fileName}`;
  const response = await fetch(url, {
    headers: { "user-agent": "Game-Morse-Adventurer-model-sync" },
    redirect: "follow",
    signal: AbortSignal.timeout(60_000),
  });
  if (!response.ok) {
    throw new Error(`Unable to download ${fileName} from pinned cwformer release (${response.status}).`);
  }
  return Buffer.from(await response.arrayBuffer());
}

async function readReleaseFile(fileName) {
  const localSource = process.env.CWGAME_SEMANTIC_MODEL_SOURCE;
  if (localSource) return readFile(path.join(path.resolve(localSource), fileName));
  return downloadReleaseFile(fileName);
}

async function verifyReleasePair({ contractBuffer, modelBuffer }) {
  const actualContractDigest = sha256(contractBuffer);
  if (actualContractDigest !== release.contractSha256) {
    throw new Error(`Semantic runtime contract checksum mismatch: ${actualContractDigest}`);
  }

  const contract = JSON.parse(contractBuffer.toString("utf8"));
  const expectedArtifact = contract.artifacts?.find(({ file }) => file === sourceModelName);

  if (contract.contractVersion !== "qso-semantic-runtime-4") {
    throw new Error(`Unsupported semantic contract: ${contract.contractVersion ?? "missing"}`);
  }
  if (!expectedArtifact) throw new Error(`Contract does not declare ${sourceModelName}.`);
  const actualDigest = sha256(modelBuffer);
  if (
    actualDigest !== release.modelSha256
    || actualDigest !== String(expectedArtifact.sha256).toLowerCase()
  ) {
    throw new Error(`Semantic model checksum mismatch: ${actualDigest}`);
  }
  return { actualContractDigest, actualDigest, contract };
}

async function readLocalRuntime() {
  const [contractBuffer, modelBuffer] = await Promise.all([
    readFile(path.join(outputDirectory, outputContractName)),
    readFile(path.join(outputDirectory, outputModelName)),
  ]);
  return { contractBuffer, modelBuffer };
}

async function writeAtomically(file, buffer) {
  const temporary = `${file}.${process.pid}.tmp`;
  try {
    await writeFile(temporary, buffer, { flag: "wx" });
    await rename(temporary, file);
  } finally {
    await rm(temporary, { force: true });
  }
}

const updateRequested = process.argv.slice(2).includes("--update");
if (!updateRequested) {
  const pair = await readLocalRuntime();
  const verified = await verifyReleasePair(pair);
  process.stdout.write(
    `Verified local semantic runtime ${verified.contract.modelVersion}: `
      + `${outputModelName} (${pair.modelBuffer.length} bytes, ${verified.actualDigest}); `
      + `${outputContractName} (${pair.contractBuffer.length} bytes, ${verified.actualContractDigest})\n`,
  );
  process.exit(0);
}

const [contractBuffer, modelBuffer] = await Promise.all([
  readReleaseFile(sourceContractName),
  readReleaseFile(sourceModelName),
]);
const verified = await verifyReleasePair({ contractBuffer, modelBuffer });

await mkdir(outputDirectory, { recursive: true });
await writeAtomically(path.join(outputDirectory, outputModelName), modelBuffer);
await writeAtomically(path.join(outputDirectory, outputContractName), contractBuffer);

process.stdout.write(
  `Semantic runtime updated from ${release.repository}@${release.commit}: `
    + `${outputModelName} (${modelBuffer.length} bytes, ${verified.actualDigest})\n`,
);
