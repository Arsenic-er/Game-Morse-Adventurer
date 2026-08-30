const { execFile, spawn } = require("node:child_process");
const { createHash, randomUUID } = require("node:crypto");
const fs = require("node:fs/promises");
const path = require("node:path");
const { inflateSync } = require("node:zlib");

const {
  buildQaSegmentPlan,
  createQaStateEnvelope,
  validateContestQaEvidence,
  validateCoordinateRelayQaEvidence,
  validateExpeditionQaEvidence,
  validateFinalPromiseQaEvidence,
  validateFirstPageQaEvidence,
  validateLightsQaEvidence,
  validateListeningQaEvidence,
  validateNightOperationsQaEvidence,
  validateQslStoryQaEvidence,
  validateQaStateEnvelope,
  validateServiceNetQaEvidence,
  validateStormRelayQaEvidence,
} = require("../electron/qa-capture.cjs");

function parseJson(text, label) {
  try {
    return JSON.parse(text);
  } catch (error) {
    throw new Error(`${label} is not valid JSON: ${error.message}`);
  }
}

async function readJson(file, label) {
  return parseJson(await fs.readFile(file, "utf8"), label);
}

async function pathExists(file) {
  try {
    await fs.access(file);
    return true;
  } catch {
    return false;
  }
}

const CRC32_TABLE = Uint32Array.from({ length: 256 }, (_, index) => {
  let value = index;
  for (let bit = 0; bit < 8; bit += 1) {
    value = (value >>> 1) ^ ((value & 1) ? 0xedb88320 : 0);
  }
  return value >>> 0;
});

function crc32(buffer, start, end) {
  let value = 0xffffffff;
  for (let index = start; index < end; index += 1) {
    value = CRC32_TABLE[(value ^ buffer[index]) & 0xff] ^ (value >>> 8);
  }
  return (value ^ 0xffffffff) >>> 0;
}

function killWindowsProcessTree(pid, { execFileImpl = execFile } = {}) {
  return new Promise((resolve, reject) => {
    execFileImpl("taskkill.exe", ["/PID", String(pid), "/T", "/F"], (error, stdout, stderr) => {
      if (error) {
        error.stdout = stdout;
        error.stderr = stderr;
        reject(error);
        return;
      }
      resolve();
    });
  });
}

async function readLastQaStep(outputDir) {
  const file = path.join(outputDir, "qa-step.txt");
  if (!await pathExists(file)) return null;
  const text = await fs.readFile(file, "utf8");
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text.trim() };
  }
}

function paethPredictor(left, up, upperLeft) {
  const estimate = left + up - upperLeft;
  const leftDistance = Math.abs(estimate - left);
  const upDistance = Math.abs(estimate - up);
  const upperLeftDistance = Math.abs(estimate - upperLeft);
  if (leftDistance <= upDistance && leftDistance <= upperLeftDistance) return left;
  return upDistance <= upperLeftDistance ? up : upperLeft;
}

function validatePngScreenshot(buffer, filename, { includePixelHash = false } = {}) {
  if (!Buffer.isBuffer(buffer)) throw new Error(`${filename} PNG evidence is not a buffer`);
  const expected = /-(\d+)x(\d+)\.png$/i.exec(filename);
  if (!expected) throw new Error(`${filename} does not declare expected WIDTHxHEIGHT dimensions`);
  const expectedWidth = Number(expected[1]);
  const expectedHeight = Number(expected[2]);
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  if (buffer.length < signature.length || !buffer.subarray(0, signature.length).equals(signature)) {
    throw new Error(`${filename} is not PNG evidence (invalid signature)`);
  }

  let offset = signature.length;
  let chunkIndex = 0;
  let foundIdat = false;
  let idatSequenceEnded = false;
  const idatChunks = [];
  let foundIend = false;
  let actualWidth = null;
  let actualHeight = null;
  let actualColorType = null;
  let bytesPerPixel = null;
  while (offset < buffer.length) {
    if (buffer.length - offset < 12) throw new Error(`${filename} PNG chunk is truncated`);
    const dataLength = buffer.readUInt32BE(offset);
    if (dataLength > buffer.length - offset - 12) throw new Error(`${filename} PNG chunk crosses the file boundary`);
    const typeBytes = buffer.subarray(offset + 4, offset + 8);
    if (typeBytes.length !== 4 || ![...typeBytes].every((byte) => (byte >= 0x41 && byte <= 0x5a)
      || (byte >= 0x61 && byte <= 0x7a))) {
      throw new Error(`${filename} PNG chunk type must contain exactly four ASCII letters`);
    }
    const type = typeBytes.toString("ascii");
    if (typeBytes[0] >= 0x41 && typeBytes[0] <= 0x5a
      && !["IHDR", "PLTE", "IDAT", "IEND"].includes(type)) {
      throw new Error(`${filename} PNG contains unknown critical chunk ${type}`);
    }
    const dataOffset = offset + 8;
    const crcOffset = dataOffset + dataLength;
    const nextOffset = crcOffset + 4;
    const declaredCrc = buffer.readUInt32BE(crcOffset);
    const computedCrc = crc32(buffer, offset + 4, crcOffset);
    if (declaredCrc !== computedCrc) {
      throw new Error(`${filename} PNG ${type} chunk CRC mismatch`);
    }
    if (chunkIndex === 0) {
      if (type !== "IHDR" || dataLength !== 13) {
        throw new Error(`${filename} PNG must start with a 13-byte IHDR chunk`);
      }
      actualWidth = buffer.readUInt32BE(dataOffset);
      actualHeight = buffer.readUInt32BE(dataOffset + 4);
      if (actualWidth !== expectedWidth || actualHeight !== expectedHeight) {
        throw new Error(`${filename} PNG dimensions ${actualWidth}x${actualHeight} do not match ${expectedWidth}x${expectedHeight}`);
      }
      if (actualWidth === 0 || actualHeight === 0) {
        throw new Error(`${filename} PNG dimensions must be positive`);
      }
      const bitDepth = buffer[dataOffset + 8];
      const colorType = buffer[dataOffset + 9];
      const compressionMethod = buffer[dataOffset + 10];
      const filterMethod = buffer[dataOffset + 11];
      const interlaceMethod = buffer[dataOffset + 12];
      if (bitDepth !== 8) {
        throw new Error(`${filename} PNG bit depth ${bitDepth} is not the expected 8-bit capture format`);
      }
      if (colorType !== 2 && colorType !== 6) {
        throw new Error(`${filename} PNG color type ${colorType} is not an allowed RGB/RGBA capture format`);
      }
      if (compressionMethod !== 0 || filterMethod !== 0 || interlaceMethod !== 0) {
        throw new Error(`${filename} PNG uses an unsupported compression, filter, or interlace format`);
      }
      bytesPerPixel = colorType === 2 ? 3 : 4;
      actualColorType = colorType;
    } else if (type === "IHDR") {
      throw new Error(`${filename} PNG contains a non-initial IHDR chunk`);
    }
    if (type === "IDAT") {
      if (idatSequenceEnded) throw new Error(`${filename} PNG IDAT chunks must be consecutive`);
      foundIdat = true;
      idatChunks.push(buffer.subarray(dataOffset, dataOffset + dataLength));
    } else if (foundIdat) {
      idatSequenceEnded = true;
    }
    if (type === "IEND") {
      if (dataLength !== 0 || nextOffset !== buffer.length) {
        throw new Error(`${filename} PNG IEND is malformed or not the final chunk`);
      }
      foundIend = true;
      offset = nextOffset;
      break;
    }
    offset = nextOffset;
    chunkIndex += 1;
  }
  if (actualWidth === null || actualHeight === null) throw new Error(`${filename} PNG is missing IHDR`);
  if (bytesPerPixel === null) throw new Error(`${filename} PNG capture format is missing`);
  if (!foundIdat) throw new Error(`${filename} PNG is missing IDAT`);
  if (!foundIend || offset !== buffer.length) throw new Error(`${filename} PNG is missing a final IEND`);
  const scanlineBytes = (actualWidth * bytesPerPixel) + 1;
  const expectedInflatedLength = scanlineBytes * actualHeight;
  if (!Number.isSafeInteger(expectedInflatedLength)) {
    throw new Error(`${filename} PNG expected scanline length is unsafe`);
  }
  let inflated;
  try {
    inflated = inflateSync(Buffer.concat(idatChunks), {
      maxOutputLength: expectedInflatedLength + 1,
    });
  } catch (error) {
    throw new Error(`${filename} PNG IDAT zlib stream cannot inflate: ${error.message}`);
  }
  if (inflated.length !== expectedInflatedLength) {
    throw new Error(`${filename} PNG inflated pixel length ${inflated.length} does not match ${expectedInflatedLength}`);
  }
  const rowPixelBytes = actualWidth * bytesPerPixel;
  let previousRow = Buffer.alloc(rowPixelBytes);
  let currentRow = Buffer.alloc(rowPixelBytes);
  let visiblePixels = 0;
  const distinctColors = new Set();
  let minimumLuma = 255;
  let maximumLuma = 0;
  const pixelHasher = includePixelHash ? createHash("sha256") : null;
  pixelHasher?.update(`${actualWidth}x${actualHeight}:${actualColorType}:`);
  for (let row = 0; row < actualHeight; row += 1) {
    const scanlineOffset = row * scanlineBytes;
    const filterByte = inflated[scanlineOffset];
    if (filterByte > 4) {
      throw new Error(`${filename} PNG filter byte ${filterByte} is invalid on row ${row}`);
    }
    for (let byteIndex = 0; byteIndex < rowPixelBytes; byteIndex += 1) {
      const filtered = inflated[scanlineOffset + 1 + byteIndex];
      const left = byteIndex >= bytesPerPixel ? currentRow[byteIndex - bytesPerPixel] : 0;
      const up = previousRow[byteIndex];
      const upperLeft = byteIndex >= bytesPerPixel ? previousRow[byteIndex - bytesPerPixel] : 0;
      let predictor = 0;
      if (filterByte === 1) predictor = left;
      else if (filterByte === 2) predictor = up;
      else if (filterByte === 3) predictor = Math.floor((left + up) / 2);
      else if (filterByte === 4) predictor = paethPredictor(left, up, upperLeft);
      currentRow[byteIndex] = (filtered + predictor) & 0xff;
    }
    pixelHasher?.update(currentRow);
    for (let column = 0; column < actualWidth; column += 1) {
      const pixelOffset = column * bytesPerPixel;
      if (actualColorType === 6 && currentRow[pixelOffset + 3] === 0) continue;
      visiblePixels += 1;
      const red = currentRow[pixelOffset];
      const green = currentRow[pixelOffset + 1];
      const blue = currentRow[pixelOffset + 2];
      if (distinctColors.size < 8) distinctColors.add((red << 16) | (green << 8) | blue);
      const luma = Math.floor(((54 * red) + (183 * green) + (19 * blue)) / 256);
      minimumLuma = Math.min(minimumLuma, luma);
      maximumLuma = Math.max(maximumLuma, luma);
    }
    [previousRow, currentRow] = [currentRow, previousRow];
  }
  const minimumVisiblePixels = Math.min(64, actualWidth * actualHeight);
  if (visiblePixels < minimumVisiblePixels) {
    throw new Error(`${filename} PNG has only ${visiblePixels} visible pixels; transparent placeholder evidence is not allowed`);
  }
  if (distinctColors.size < 8 || maximumLuma - minimumLuma < 16) {
    throw new Error(`${filename} PNG lacks visible colour/luma variation; uniform placeholder evidence is not allowed`);
  }
  return {
    width: actualWidth,
    height: actualHeight,
    ...(includePixelHash ? { pixelHash: pixelHasher.digest("hex") } : {}),
  };
}

const ALLOWED_PIXEL_DUPLICATE_STEMS = Object.freeze([
  Object.freeze([
    "segments/inventory/warehouse-radio-warmup",
    "segments/inventory/warehouse-radio",
  ]),
  Object.freeze([
    "segments/inventory/home-log-empty-warmup",
    "segments/inventory/home-log-empty",
  ]),
  Object.freeze([
    "segments/equipment/store-radio-available-warmup",
    "segments/equipment/store-radio-available",
  ]),
  Object.freeze([
    "segments/practice/practice-weak-cleared",
    "segments/practice/practice-weak-cleared-reloaded",
  ]),
  Object.freeze([
    "segments/qso/station-listening-warmup",
    "segments/qso/station-listening",
  ]),
  Object.freeze([
    "segments/qso/qso-result-unsaved-warmup",
    "segments/qso/qso-result-unsaved",
  ]),
  Object.freeze([
    "segments/qsl-story/qsl-reloaded",
    "segments/service-net/service-mission-available",
  ]),
  Object.freeze([
    "segments/service-net/service-reloaded",
    "segments/coordinate-relay/coordinate-mission-available",
  ]),
  Object.freeze([
    "segments/coordinate-relay/coordinate-reloaded",
    "segments/contest/contest-mission-available",
  ]),
]);

function validatePixelHashGroups(entries, { suffix }) {
  if (!Array.isArray(entries) || typeof suffix !== "string" || !suffix) {
    throw new Error("Packaged QA pixel duplicate validation requires evidence entries and a suffix");
  }
  const allowedGroups = new Set(ALLOWED_PIXEL_DUPLICATE_STEMS.map((stems) => stems
    .map((stem) => `${stem}-${suffix}.png`)
    .sort()
    .join("\n")));
  const byHash = new Map();
  for (const entry of entries) {
    const normalizedPath = String(entry?.path ?? "").replaceAll("\\", "/");
    const pixelHash = String(entry?.pixelHash ?? "");
    if (!normalizedPath || !pixelHash) throw new Error("Packaged QA screenshot pixel evidence is incomplete");
    const group = byHash.get(pixelHash) ?? [];
    group.push(normalizedPath);
    byHash.set(pixelHash, group);
  }
  const duplicateGroups = [];
  for (const paths of byHash.values()) {
    if (paths.length < 2) continue;
    const normalizedGroup = [...paths].sort();
    if (!allowedGroups.has(normalizedGroup.join("\n"))) {
      throw new Error(`Packaged QA has an unapproved duplicate pixel group: ${normalizedGroup.join(", ")}`);
    }
    duplicateGroups.push(normalizedGroup);
  }
  return duplicateGroups;
}

async function runQaChildProcess({
  executable,
  args,
  env,
  outputDir,
  scope,
  timeoutMs,
  spawnImpl = spawn,
  killTreeImpl = killWindowsProcessTree,
  writeFileImpl = fs.writeFile,
  setTimeoutImpl = setTimeout,
  clearTimeoutImpl = clearTimeout,
}) {
  await fs.mkdir(outputDir, { recursive: true });
  const stdoutHandle = await fs.open(path.join(outputDir, "qa-stdout.log"), "w");
  const stderrHandle = await fs.open(path.join(outputDir, "qa-stderr.log"), "w");
  try {
    const child = spawnImpl(executable, args, {
      env,
      windowsHide: true,
      stdio: ["ignore", stdoutHandle.fd, stderrHandle.fd],
    });
    return await new Promise((resolve, reject) => {
      let settled = false;
      let timedOut = false;
      let timer;
      const finish = (error, value) => {
        if (settled) return;
        settled = true;
        clearTimeoutImpl(timer);
        if (error) reject(error);
        else resolve(value);
      };
      child.once("error", (error) => finish(new Error(`${scope} failed to launch: ${error.message}`)));
      child.once("close", (code, signal) => {
        if (timedOut) return;
        if (code === 0) finish(null, { code, signal, pid: child.pid });
        else finish(new Error(`${scope} child exited with code ${code}${signal ? ` (${signal})` : ""}`));
      });
      timer = setTimeoutImpl(() => {
        void (async () => {
          if (settled) return;
          timedOut = true;
          const lastStep = await readLastQaStep(outputDir).catch((error) => ({ readError: error.message }));
          const marker = {
            schemaVersion: 1,
            scope,
            elapsedMs: timeoutMs,
            pid: child.pid,
            lastStep,
            timedOutAt: new Date().toISOString(),
          };
          let markerError = null;
          let killError = null;
          try {
            try {
              await writeFileImpl(
                path.join(outputDir, "qa-timeout.json"),
                `${JSON.stringify(marker, null, 2)}\n`,
                "utf8",
              );
            } catch (error) {
              markerError = error;
            }
          } finally {
            try {
              await killTreeImpl(child.pid);
            } catch (error) {
              killError = error;
            } finally {
              const timeoutError = new Error(`${scope} timed out after ${timeoutMs}ms`);
              const causes = [markerError, killError].filter(Boolean);
              if (causes.length === 1) [timeoutError.cause] = causes;
              if (causes.length > 1) timeoutError.cause = new AggregateError(causes, "QA timeout cleanup failed");
              finish(timeoutError);
            }
          }
        })().catch((error) => {
          const timeoutError = new Error(`${scope} timed out after ${timeoutMs}ms`);
          timeoutError.cause = error;
          finish(timeoutError);
        });
      }, timeoutMs);
    });
  } finally {
    await Promise.allSettled([stdoutHandle.close(), stderrHandle.close()]);
  }
}

async function validateQaSegmentArtifacts(segment, outputDir, { qaRunId }) {
  const failureFile = path.join(outputDir, "qa-failure.txt");
  if (await pathExists(failureFile)) {
    throw new Error(`${segment.scope} wrote qa-failure.txt: ${await fs.readFile(failureFile, "utf8")}`);
  }
  if (await pathExists(path.join(outputDir, "qa-timeout.json"))) {
    throw new Error(`${segment.scope} wrote qa-timeout.json`);
  }
  const sentinelFile = path.join(outputDir, "qa-segment-result.json");
  if (!await pathExists(sentinelFile)) throw new Error(`${segment.scope} is missing its segment sentinel`);
  const sentinel = await readJson(sentinelFile, `${segment.scope} segment sentinel`);
  if (sentinel?.schemaVersion !== 1 || sentinel?.scope !== segment.scope || sentinel?.qaRunId !== qaRunId) {
    throw new Error(`${segment.scope} segment sentinel has the wrong schema, scope, or QA run id`);
  }
  if (!Array.isArray(sentinel.captures)
    || JSON.stringify(sentinel.captures) !== JSON.stringify(segment.screenshots)) {
    throw new Error(`${segment.scope} segment sentinel capture manifest is not exact`);
  }
  const consoleFile = path.join(outputDir, "runtime-console-errors.json");
  if (!await pathExists(consoleFile)) throw new Error(`${segment.scope} is missing runtime console evidence`);
  const consoleErrors = await readJson(consoleFile, `${segment.scope} runtime console evidence`);
  if (!Array.isArray(consoleErrors) || consoleErrors.length !== 0 || sentinel.consoleErrorCount !== 0) {
    throw new Error(`${segment.scope} reported runtime console errors`);
  }
  const screenshotPixelHashes = [];
  for (const screenshot of segment.screenshots) {
    const screenshotFile = path.join(outputDir, screenshot);
    const stat = await fs.stat(screenshotFile).catch(() => null);
    if (!stat || !stat.isFile() || stat.size === 0) {
      throw new Error(`${segment.scope} screenshot is missing or empty: ${screenshot}`);
    }
    const inspected = validatePngScreenshot(await fs.readFile(screenshotFile), screenshot, { includePixelHash: true });
    screenshotPixelHashes.push({ path: screenshot, pixelHash: inspected.pixelHash });
  }

  let stateOut = null;
  if (segment.scope !== "lights") {
    const stateFile = path.join(outputDir, "qa-state-out.json");
    if (!await pathExists(stateFile)) throw new Error(`${segment.scope} is missing state output`);
    stateOut = await readJson(stateFile, `${segment.scope} state output`);
    const validated = createQaStateEnvelope(stateOut);
    if (validated.producerScope !== segment.scope || validated.qaRunId !== qaRunId) {
      throw new Error(`${segment.scope} state output has the wrong producer or QA run id`);
    }
    const chapterEvidence = {
      expedition: ["expedition-qa-result.json", "Expedition", validateExpeditionQaEvidence],
      "qsl-story": ["qsl-story-qa-result.json", "QSL story", validateQslStoryQaEvidence],
      "service-net": ["service-net-qa-result.json", "Service net", validateServiceNetQaEvidence],
      "coordinate-relay": ["coordinate-relay-qa-result.json", "Coordinate relay", validateCoordinateRelayQaEvidence],
      contest: ["contest-qa-result.json", "Contest", validateContestQaEvidence],
      listening: ["listening-qa-result.json", "Listening", validateListeningQaEvidence],
      "storm-relay": ["storm-relay-qa-result.json", "Storm relay", validateStormRelayQaEvidence],
      "night-operations": ["night-operations-qa-result.json", "Night operations", validateNightOperationsQaEvidence],
      "final-promise": ["final-promise-qa-result.json", "Final promise", validateFinalPromiseQaEvidence],
      "first-page": ["first-page-qa-result.json", "First page", validateFirstPageQaEvidence],
    }[segment.scope];
    if (chapterEvidence) {
      const [filename, label, validate] = chapterEvidence;
      const evidenceFile = path.join(outputDir, filename);
      if (!await pathExists(evidenceFile)) throw new Error(`${segment.scope} is missing gameplay evidence`);
      validate(await readJson(evidenceFile, `${label} QA evidence`), { qaRunId });
    }
  } else {
    const lightsFile = path.join(outputDir, "lights-qa-result.json");
    if (!await pathExists(lightsFile)) throw new Error("lights is missing Lights evidence");
    validateLightsQaEvidence(await readJson(lightsFile, "Lights QA evidence"), { qaRunId });
  }
  return { sentinel, consoleErrors, screenshotPixelHashes, stateOut };
}

function segmentOutputPath(outputRoot, scope) {
  const root = path.resolve(outputRoot);
  const segment = path.resolve(root, "segments", scope);
  if (segment !== root && !segment.startsWith(`${root}${path.sep}`)) {
    throw new Error(`QA segment path escaped output root: ${scope}`);
  }
  return segment;
}

async function runPackagedQa({
  exe,
  outputRoot,
  suffix = "1439x912",
  spawnImpl = spawn,
  killTreeImpl = killWindowsProcessTree,
}) {
  if (!exe || !outputRoot) throw new Error("runPackagedQa requires exe and outputRoot");
  const resolvedOutput = path.resolve(outputRoot);
  const qaRunId = randomUUID();
  await fs.mkdir(path.dirname(resolvedOutput), { recursive: true });
  try {
    await fs.mkdir(resolvedOutput);
  } catch (error) {
    if (error?.code === "EEXIST") {
      throw new Error(`QA output root already exists; choose a fresh exclusive path: ${resolvedOutput}`);
    }
    throw error;
  }
  await fs.mkdir(path.join(resolvedOutput, "segments"));
  const plan = buildQaSegmentPlan({ suffix });
  const results = [];
  let previousStateFile = null;

  for (const segment of plan.segments) {
    const outputDir = segmentOutputPath(resolvedOutput, segment.scope);
    await fs.mkdir(outputDir);
    if (segment.predecessor) {
      const previousState = await readJson(previousStateFile, `${segment.scope} predecessor state`);
      validateQaStateEnvelope(previousState, { consumerScope: segment.scope, qaRunId });
    }
    const stateOutFile = segment.scope === "lights" ? null : path.join(outputDir, "qa-state-out.json");
    const env = {
      ...process.env,
      CWGAME_QA_OUTPUT: outputDir,
      CWGAME_QA_SCOPE: segment.scope,
      CWGAME_QA_SUFFIX: suffix,
      CWGAME_QA_RUN_ID: qaRunId,
      ...(segment.predecessor ? { CWGAME_QA_STATE_IN: previousStateFile } : {}),
      ...(stateOutFile ? { CWGAME_QA_STATE_OUT: stateOutFile } : {}),
    };
    await runQaChildProcess({
      executable: path.resolve(exe),
      args: [segment.mode === "qa-lights-capture" ? "--qa-lights-capture" : "--qa-capture"],
      env,
      outputDir,
      scope: segment.scope,
      timeoutMs: segment.timeoutMs,
      spawnImpl,
      killTreeImpl,
    });
    const evidence = await validateQaSegmentArtifacts(segment, outputDir, { qaRunId });
    results.push({
      scope: segment.scope,
      outputDir: path.relative(resolvedOutput, outputDir),
      captures: evidence.sentinel.captures.map((name) => path.join("segments", segment.scope, name)),
      consoleErrorCount: evidence.consoleErrors.length,
      screenshotPixelHashes: evidence.screenshotPixelHashes.map(({ path: screenshot, pixelHash }) => ({
        path: path.join("segments", segment.scope, screenshot),
        pixelHash,
      })),
    });
    previousStateFile = stateOutFile;
  }

  const allCaptures = results.flatMap(({ captures }) => captures);
  const approvedPixelDuplicateGroups = validatePixelHashGroups(
    results.flatMap(({ screenshotPixelHashes }) => screenshotPixelHashes),
    { suffix },
  );
  const finalResult = {
    schemaVersion: 1,
    qaRunId,
    planVersion: 1,
    suffix,
    totalPhysicalCaptures: allCaptures.length,
    captures: allCaptures,
    segments: results.map(({ screenshotPixelHashes: _pixelHashes, ...result }) => result),
    approvedPixelDuplicateGroups,
    lightsResult: path.join("segments", "lights", "lights-qa-result.json"),
    chapterResults: {
      expedition: path.join("segments", "expedition", "expedition-qa-result.json"),
      qslStory: path.join("segments", "qsl-story", "qsl-story-qa-result.json"),
      serviceNet: path.join("segments", "service-net", "service-net-qa-result.json"),
      coordinateRelay: path.join("segments", "coordinate-relay", "coordinate-relay-qa-result.json"),
      contest: path.join("segments", "contest", "contest-qa-result.json"),
      listening: path.join("segments", "listening", "listening-qa-result.json"),
      stormRelay: path.join("segments", "storm-relay", "storm-relay-qa-result.json"),
      nightOperations: path.join("segments", "night-operations", "night-operations-qa-result.json"),
      finalPromise: path.join("segments", "final-promise", "final-promise-qa-result.json"),
      firstPage: path.join("segments", "first-page", "first-page-qa-result.json"),
    },
    completedAt: new Date().toISOString(),
  };
  await fs.writeFile(path.join(resolvedOutput, "runtime-console-errors.json"), "[]\n", "utf8");
  await fs.writeFile(path.join(resolvedOutput, "qa-result.json"), `${JSON.stringify(finalResult, null, 2)}\n`, "utf8");
  return finalResult;
}

function parseArgs(argv) {
  const values = {};
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (!["--exe", "--output", "--suffix"].includes(argument)) throw new Error(`Unknown argument: ${argument}`);
    const value = argv[index + 1];
    if (!value) throw new Error(`Missing value for ${argument}`);
    values[argument.slice(2)] = value;
    index += 1;
  }
  if (!values.exe || !values.output) throw new Error("Usage: node scripts/run-packaged-qa.cjs --exe <portable.exe> --output <directory> [--suffix <suffix>]");
  return values;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const result = await runPackagedQa({
    exe: options.exe,
    outputRoot: options.output,
    suffix: options.suffix,
  });
  process.stdout.write(`${JSON.stringify(result)}\n`);
}

if (require.main === module) {
  main().catch((error) => {
    process.stderr.write(`${error.stack || error.message}\n`);
    process.exitCode = 1;
  });
}

module.exports = {
  killWindowsProcessTree,
  parseArgs,
  runPackagedQa,
  runQaChildProcess,
  validatePngScreenshot,
  validatePixelHashGroups,
  validateQaSegmentArtifacts,
};
