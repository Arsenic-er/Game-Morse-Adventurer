import { readdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";

const MAX_OWNED_JS_BYTES = 500 * 1024;

function option(name, fallback) {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

const buildDirectory = path.resolve(option("--directory", "dist"));
const reportPath = path.resolve(option("--report", path.join(buildDirectory, "build-size-report.json")));

async function filesBelow(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map(async (entry) => {
    const absolute = path.join(directory, entry.name);
    return entry.isDirectory() ? filesBelow(absolute) : [absolute];
  }));
  return nested.flat();
}

function relativePath(file) {
  return path.relative(buildDirectory, file).split(path.sep).join("/");
}

const files = (await filesBelow(buildDirectory))
  .filter((file) => path.resolve(file) !== reportPath);
const assets = await Promise.all(files.map(async (file) => ({
  path: relativePath(file),
  bytes: (await stat(file)).size,
})));
assets.sort((left, right) => right.bytes - left.bytes || left.path.localeCompare(right.path));
const ownedJsChunks = assets.filter(({ path: file }) => file.endsWith(".js"));
const totalBuildBytes = assets.reduce((total, asset) => total + asset.bytes, 0);
const oversizedChunks = ownedJsChunks.filter(({ bytes }) => bytes > MAX_OWNED_JS_BYTES);
const hasOwnedJsChunks = ownedJsChunks.length > 0;
const payload = {
  schemaVersion: 1,
  maxOwnedJsBytes: MAX_OWNED_JS_BYTES,
  totalBuildBytes,
  largestAsset: assets[0] ?? null,
  largestOwnedJsChunk: ownedJsChunks[0] ?? null,
  ownedJsChunks,
  passed: hasOwnedJsChunks && oversizedChunks.length === 0,
};

await writeFile(reportPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");

const summary = [
  "## Build size report",
  "",
  `- Total output: \`${payload.totalBuildBytes} bytes\``,
  `- Largest asset: \`${payload.largestAsset?.path ?? "none"}\` (${payload.largestAsset?.bytes ?? 0} bytes)`,
  `- Largest owned JS chunk: \`${payload.largestOwnedJsChunk?.path ?? "none"}\` (${payload.largestOwnedJsChunk?.bytes ?? 0} bytes)`,
  `- Owned JS budget: \`${MAX_OWNED_JS_BYTES} bytes (500 KiB)\``,
  `- Budget result: **${payload.passed ? "PASS" : "FAIL"}**`,
  "",
].join("\n");
process.stdout.write(summary);
if (process.env.GITHUB_STEP_SUMMARY) {
  const { appendFile } = await import("node:fs/promises");
  await appendFile(process.env.GITHUB_STEP_SUMMARY, summary, "utf8");
}

if (!payload.passed) {
  if (!hasOwnedJsChunks) {
    process.stderr.write("Build emitted no owned JavaScript chunks; size gate cannot pass.\n");
  }
  for (const chunk of oversizedChunks) {
    process.stderr.write(`Owned JavaScript chunk ${chunk.path} is ${chunk.bytes} bytes; limit is ${MAX_OWNED_JS_BYTES}.\n`);
  }
  process.exitCode = 1;
}
