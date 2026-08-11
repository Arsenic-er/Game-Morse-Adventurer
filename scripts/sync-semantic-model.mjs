import { createHash } from "node:crypto";
import { copyFile, mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectDirectory = path.resolve(scriptDirectory, "..");
const defaultReleaseDirectory = path.resolve(
  projectDirectory,
  "..",
  "Game-Morse-Adventurer-Assets",
  "ml",
  "cw_pulseformer",
  "releases",
  "semantic-v0.4",
);
const sourceDirectory = path.resolve(
  process.env.CWGAME_SEMANTIC_MODEL_SOURCE || defaultReleaseDirectory,
);
const outputDirectory = path.join(projectDirectory, "runtime-models");
const sourceModelName = "qso-semanticformer-v0.4.release.int8.onnx";
const sourceContractName = "qso-semanticformer-v0.4.release.fp32.runtime-contract.json";
const outputModelName = "qso-semanticformer-v0.4.int8.onnx";
const outputContractName = "qso-semanticformer-v0.4.runtime-contract.json";

function sha256(buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

const contractBuffer = await readFile(path.join(sourceDirectory, sourceContractName));
const contract = JSON.parse(contractBuffer.toString("utf8"));
const sourceModel = path.join(sourceDirectory, sourceModelName);
const modelBuffer = await readFile(sourceModel);
const expectedArtifact = contract.artifacts?.find(({ file }) => file === sourceModelName);

if (contract.contractVersion !== "qso-semantic-runtime-4") {
  throw new Error(`Unsupported semantic contract: ${contract.contractVersion ?? "missing"}`);
}
if (!expectedArtifact) throw new Error(`Contract does not declare ${sourceModelName}.`);
const actualDigest = sha256(modelBuffer);
if (actualDigest !== String(expectedArtifact.sha256).toLowerCase()) {
  throw new Error(`Semantic model checksum mismatch: ${actualDigest}`);
}

await mkdir(outputDirectory, { recursive: true });
await copyFile(sourceModel, path.join(outputDirectory, outputModelName));
await copyFile(
  path.join(sourceDirectory, sourceContractName),
  path.join(outputDirectory, outputContractName),
);

process.stdout.write(
  `Semantic model synced: ${outputModelName} (${modelBuffer.length} bytes, ${actualDigest})\n`,
);
