#!/usr/bin/env node
import { createWriteStream } from "node:fs";
import { once } from "node:events";
import { resolve } from "node:path";
import {
  PROCEDURAL_NPC_REGIONS,
  PROCEDURAL_NPC_WORLD_SIZE,
  iterateNpcBatch,
  proceduralWorldHeader,
} from "../src/qso/proceduralNpc.js";

function usage() {
  return [
    "Generate deterministic fictional NPC profiles without portrait files.",
    "",
    "Usage:",
    "  node scripts/generate-npc-roster.mjs [options]",
    "",
    "Options:",
    "  --seed <text>       World seed (default: preview)",
    "  --count <number>    Profiles to stream (default: 20)",
    "  --offset <number>   Global or regional starting offset (default: 0)",
    "  --region <id>       JP, US, CN, DE, CH, or FI",
    "  --format <type>     ndjson or json (default: ndjson)",
    "  --out <path>        Write to a file instead of stdout",
    "  --summary           Print only the seed/version/quota header",
    "  --help              Show this help",
    "",
    `Conceptual population: ${PROCEDURAL_NPC_WORLD_SIZE.toLocaleString("en-US")}.`,
    "The game stores only the world header and encountered-NPC deltas; it does not",
    "materialize the full population or generate portraits unless explicitly asked.",
  ].join("\n");
}

function parseInteger(value, label) {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 0) throw new Error(`${label} must be a non-negative integer`);
  return parsed;
}

function parseArgs(argv) {
  const options = { seed: "preview", count: 20, offset: 0, region: null, format: "ndjson", out: null, summary: false };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--help" || argument === "-h") return { ...options, help: true };
    if (argument === "--summary") { options.summary = true; continue; }
    const value = argv[index + 1];
    if (value === undefined) throw new Error(`Missing value for ${argument}`);
    if (argument === "--seed") options.seed = value;
    else if (argument === "--count") options.count = parseInteger(value, "count");
    else if (argument === "--offset") options.offset = parseInteger(value, "offset");
    else if (argument === "--region") options.region = value.toUpperCase();
    else if (argument === "--format") options.format = value.toLowerCase();
    else if (argument === "--out") options.out = value;
    else throw new Error(`Unknown option: ${argument}`);
    index += 1;
  }
  if (!new Set(["ndjson", "json"]).has(options.format)) throw new Error("format must be ndjson or json");
  if (options.region && !PROCEDURAL_NPC_REGIONS.some((region) => region.id === options.region)) {
    throw new Error(`Unknown region: ${options.region}`);
  }
  return options;
}

async function writeChunk(stream, chunk) {
  if (!stream.write(chunk)) await once(stream, "drain");
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    process.stdout.write(`${usage()}\n`);
    return;
  }

  const header = {
    ...proceduralWorldHeader(options.seed),
    regions: PROCEDURAL_NPC_REGIONS.map(({ id, countryId, callPrefix, quota }) => ({ id, countryId, callPrefix, quota })),
  };
  const output = options.out ? createWriteStream(resolve(options.out), { encoding: "utf8" }) : process.stdout;
  if (options.summary) {
    await writeChunk(output, `${JSON.stringify(header, null, 2)}\n`);
  } else {
    const profiles = iterateNpcBatch({
      worldSeed: options.seed,
      offset: options.offset,
      count: options.count,
      regionId: options.region,
    });
    if (options.format === "json") {
      await writeChunk(output, `{\n  "header": ${JSON.stringify(header, null, 2).replaceAll("\n", "\n  ")},\n  "profiles": [`);
      let first = true;
      for (const profile of profiles) {
        await writeChunk(output, `${first ? "" : ","}\n    ${JSON.stringify(profile)}`);
        first = false;
      }
      await writeChunk(output, `${first ? "" : "\n  "}]\n}\n`);
    } else {
      for (const profile of profiles) await writeChunk(output, `${JSON.stringify(profile)}\n`);
    }
  }
  if (options.out) await new Promise((resolveDone, reject) => output.end(resolveDone).once("error", reject));
}

main().catch((error) => {
  process.stderr.write(`NPC generation failed: ${error.message}\n`);
  process.exitCode = 1;
});
