const { execFile, spawn } = require("node:child_process");
const { randomUUID } = require("node:crypto");
const fs = require("node:fs/promises");
const path = require("node:path");
const { inflateSync } = require("node:zlib");

const {
  buildQaSegmentPlan,
  createQaStateEnvelope,
  validateLightsQaEvidence,
  validateQaStateEnvelope,
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

function validatePngScreenshot(buffer, filename) {
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
  const idatChunks = [];
  let foundIend = false;
  let actualWidth = null;
  let actualHeight = null;
  let bytesPerPixel = null;
  while (offset < buffer.length) {
    if (buffer.length - offset < 12) throw new Error(`${filename} PNG chunk is truncated`);
    const dataLength = buffer.readUInt32BE(offset);
    if (dataLength > buffer.length - offset - 12) throw new Error(`${filename} PNG chunk crosses the file boundary`);
    const type = buffer.toString("ascii", offset + 4, offset + 8);
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
    } else if (type === "IHDR") {
      throw new Error(`${filename} PNG contains a non-initial IHDR chunk`);
    }
    if (type === "IDAT") {
      foundIdat = true;
      idatChunks.push(buffer.subarray(dataOffset, dataOffset + dataLength));
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
  for (let row = 0; row < actualHeight; row += 1) {
    const filterByte = inflated[row * scanlineBytes];
    if (filterByte > 4) {
      throw new Error(`${filename} PNG filter byte ${filterByte} is invalid on row ${row}`);
    }
  }
  return { width: actualWidth, height: actualHeight };
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
  for (const screenshot of segment.screenshots) {
    const screenshotFile = path.join(outputDir, screenshot);
    const stat = await fs.stat(screenshotFile).catch(() => null);
    if (!stat || !stat.isFile() || stat.size === 0) {
      throw new Error(`${segment.scope} screenshot is missing or empty: ${screenshot}`);
    }
    validatePngScreenshot(await fs.readFile(screenshotFile), screenshot);
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
  } else {
    const lightsFile = path.join(outputDir, "lights-qa-result.json");
    if (!await pathExists(lightsFile)) throw new Error("lights is missing Lights evidence");
    validateLightsQaEvidence(await readJson(lightsFile, "Lights QA evidence"), { qaRunId });
  }
  return { sentinel, consoleErrors, stateOut };
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
    });
    previousStateFile = stateOutFile;
  }

  const allCaptures = results.flatMap(({ captures }) => captures);
  const finalResult = {
    schemaVersion: 1,
    qaRunId,
    planVersion: 1,
    suffix,
    totalPhysicalCaptures: allCaptures.length,
    captures: allCaptures,
    segments: results,
    lightsResult: path.join("segments", "lights", "lights-qa-result.json"),
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
  validateQaSegmentArtifacts,
};
