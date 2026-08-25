const { execFile, spawn } = require("node:child_process");
const fs = require("node:fs/promises");
const path = require("node:path");

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

async function runQaChildProcess({
  executable,
  args,
  env,
  outputDir,
  scope,
  timeoutMs,
  spawnImpl = spawn,
  killTreeImpl = killWindowsProcessTree,
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
      timer = setTimeoutImpl(async () => {
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
        await fs.writeFile(
          path.join(outputDir, "qa-timeout.json"),
          `${JSON.stringify(marker, null, 2)}\n`,
          "utf8",
        );
        let killError = null;
        try {
          await killTreeImpl(child.pid);
        } catch (error) {
          killError = error;
        }
        const timeoutError = new Error(`${scope} timed out after ${timeoutMs}ms`);
        if (killError) timeoutError.cause = killError;
        finish(timeoutError);
      }, timeoutMs);
    });
  } finally {
    await Promise.allSettled([stdoutHandle.close(), stderrHandle.close()]);
  }
}

async function validateQaSegmentArtifacts(segment, outputDir) {
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
  if (sentinel?.schemaVersion !== 1 || sentinel?.scope !== segment.scope) {
    throw new Error(`${segment.scope} segment sentinel has the wrong schema or scope`);
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
    const stat = await fs.stat(path.join(outputDir, screenshot)).catch(() => null);
    if (!stat || !stat.isFile() || stat.size === 0) {
      throw new Error(`${segment.scope} screenshot is missing or empty: ${screenshot}`);
    }
  }

  let stateOut = null;
  if (segment.scope !== "lights") {
    const stateFile = path.join(outputDir, "qa-state-out.json");
    if (!await pathExists(stateFile)) throw new Error(`${segment.scope} is missing state output`);
    stateOut = await readJson(stateFile, `${segment.scope} state output`);
    const validated = createQaStateEnvelope(stateOut);
    if (validated.producerScope !== segment.scope) {
      throw new Error(`${segment.scope} state output has producer ${validated.producerScope}`);
    }
  } else {
    const lightsFile = path.join(outputDir, "lights-qa-result.json");
    if (!await pathExists(lightsFile)) throw new Error("lights is missing Lights evidence");
    validateLightsQaEvidence(await readJson(lightsFile, "Lights QA evidence"));
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
  await fs.mkdir(path.join(resolvedOutput, "segments"), { recursive: true });
  const plan = buildQaSegmentPlan({ suffix });
  const results = [];
  let previousStateFile = null;

  for (const segment of plan.segments) {
    const outputDir = segmentOutputPath(resolvedOutput, segment.scope);
    await fs.mkdir(outputDir, { recursive: true });
    if (segment.predecessor) {
      const previousState = await readJson(previousStateFile, `${segment.scope} predecessor state`);
      validateQaStateEnvelope(previousState, { consumerScope: segment.scope });
    }
    const stateOutFile = segment.scope === "lights" ? null : path.join(outputDir, "qa-state-out.json");
    const env = {
      ...process.env,
      CWGAME_QA_OUTPUT: outputDir,
      CWGAME_QA_SCOPE: segment.scope,
      CWGAME_QA_SUFFIX: suffix,
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
    const evidence = await validateQaSegmentArtifacts(segment, outputDir);
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
  validateQaSegmentArtifacts,
};
