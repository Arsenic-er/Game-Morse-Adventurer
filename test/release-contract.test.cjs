const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..");
const read = (relative) => fs.readFileSync(path.join(root, relative), "utf8");
const workflow = read(".github/workflows/windows-portable.yml");
const packageJson = JSON.parse(read("package.json"));
const readmes = [
  "README.md", "README.zh-CN.md", "README.zh-TW.md", "README.ja.md",
  "README.es.md", "README.de.md", "README.ru.md",
].map((file) => [file, read(file)]);

function jobBlock(jobId) {
  const startMatch = new RegExp(`^  ${jobId}:\\r?$`, "m").exec(workflow);
  assert.ok(startMatch, `workflow is missing the ${jobId} job`);
  const remainder = workflow.slice(startMatch.index + startMatch[0].length);
  const nextJob = /^  [a-zA-Z0-9_-]+:\r?$/m.exec(remainder);
  return workflow.slice(startMatch.index, nextJob ? startMatch.index + startMatch[0].length + nextJob.index : undefined);
}

test("tag builds publish the portable executable and checksum to a durable GitHub Release", () => {
  assert.match(workflow, /tags:\s*\r?\n\s*- ["']v\*["']/);
  assert.match(workflow, /github\.ref_type\s*==\s*'tag'/);
  assert.match(workflow, /gh release (?:create|upload)/);
  assert.match(workflow, /gh release view \$tag \*> \$null\s*\r?\n\s*if \(\$LASTEXITCODE -eq 0\)/);
  assert.match(workflow, /release\/CWGame-latest\.exe/);
  assert.match(workflow, /release\/CWGame-latest\.sha256/);
  assert.match(workflow, /unsigned prototype build/i);
});

test("every third-party action is pinned to an immutable full commit SHA", () => {
  const actionRefs = [...workflow.matchAll(/^\s*uses:\s*([^\s#]+).*$/gm)].map((match) => match[1]);
  assert.ok(actionRefs.length >= 4);
  for (const ref of actionRefs) {
    assert.match(ref, /^[^@]+@[0-9a-f]{40}$/i, `${ref} is not pinned to a full commit SHA`);
  }
});

test("build is read-only and only the tag-gated release job receives write permission", () => {
  const build = jobBlock("build");
  const release = jobBlock("release");
  assert.match(build, /permissions:\s*\r?\n\s+contents:\s*read/);
  assert.match(build, /uses:\s*actions\/checkout@[0-9a-f]{40}[\s\S]*?with:\s*\r?\n\s+persist-credentials:\s*false/i);
  assert.doesNotMatch(build, /contents:\s*write|gh release/i);

  assert.match(release, /needs:\s*build/);
  assert.match(release, /if:\s*github\.ref_type\s*==\s*'tag'[\s\S]*startsWith\(github\.ref_name,\s*'v'\)/);
  assert.match(release, /permissions:\s*\r?\n\s+contents:\s*write/);
  assert.match(release, /actions\/download-artifact@3e5f45b2cfb9172054b4087a40e8e0b5a5461e7c/);
  assert.match(release, /name:\s*CWGame-Windows-x64-portable/);
  assert.match(release, /Get-FileHash[\s\S]*CWGame-latest\.sha256[\s\S]*gh release/i);
});

test("the build contract gates every emitted JavaScript chunk at 500 KiB and reports sizes", () => {
  assert.match(packageJson.scripts.build, /build:size/);
  assert.match(packageJson.scripts["build:size"], /report-build-size/);
  assert.match(workflow, /build-size-report\.json/);
  assert.match(workflow, /GITHUB_STEP_SUMMARY/);
});

test("the size reporter rejects an oversized chunk and records literal byte totals", () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "cwgame-size-report-"));
  const report = path.join(directory, "report.json");
  try {
    fs.mkdirSync(path.join(directory, "assets"));
    fs.writeFileSync(path.join(directory, "assets", "owned-small.js"), Buffer.alloc(512_000));
    fs.writeFileSync(path.join(directory, "assets", "owned-large.js"), Buffer.alloc(512_001));
    fs.writeFileSync(path.join(directory, "assets", "font.woff2"), Buffer.alloc(123));

    const result = spawnSync(process.execPath, [
      path.join(root, "scripts", "report-build-size.mjs"),
      "--directory", directory,
      "--report", report,
    ], { cwd: root, encoding: "utf8" });

    assert.equal(result.status, 1, result.stderr);
    const payload = JSON.parse(fs.readFileSync(report, "utf8"));
    assert.equal(payload.maxOwnedJsBytes, 512_000);
    assert.equal(payload.totalBuildBytes, 1_024_124);
    assert.deepEqual(payload.ownedJsChunks.map(({ path: file, bytes }) => [file, bytes]), [
      ["assets/owned-large.js", 512_001],
      ["assets/owned-small.js", 512_000],
    ]);
    assert.equal(payload.passed, false);
    assert.match(result.stderr, /owned-large\.js.*512001.*512000/s);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test("the size reporter fails when a build emits zero JavaScript chunks", () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "cwgame-size-report-no-js-"));
  const report = path.join(directory, "report.json");
  try {
    fs.writeFileSync(path.join(directory, "index.html"), "<!doctype html>");
    const result = spawnSync(process.execPath, [
      path.join(root, "scripts", "report-build-size.mjs"),
      "--directory", directory,
      "--report", report,
    ], { cwd: root, encoding: "utf8" });

    assert.equal(result.status, 1, result.stdout);
    const payload = JSON.parse(fs.readFileSync(report, "utf8"));
    assert.equal(payload.passed, false);
    assert.equal(payload.largestOwnedJsChunk, null);
    assert.match(result.stderr, /no owned JavaScript chunks/i);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test("the size reporter accepts a nonempty largest chunk exactly at 512000 bytes", () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "cwgame-size-report-boundary-"));
  const report = path.join(directory, "report.json");
  try {
    fs.mkdirSync(path.join(directory, "assets"));
    fs.writeFileSync(path.join(directory, "assets", "owned-boundary.js"), Buffer.alloc(512_000));
    const result = spawnSync(process.execPath, [
      path.join(root, "scripts", "report-build-size.mjs"),
      "--directory", directory,
      "--report", report,
    ], { cwd: root, encoding: "utf8" });

    assert.equal(result.status, 0, result.stderr);
    const payload = JSON.parse(fs.readFileSync(report, "utf8"));
    assert.equal(payload.passed, true);
    assert.deepEqual(payload.largestOwnedJsChunk, {
      path: "assets/owned-boundary.js", bytes: 512_000,
    });
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test("the release uses one project icon and WOFF2 fonts for all seven language interfaces", () => {
  assert.equal(packageJson.build.win.icon, "build/icon.ico");
  assert.match(read("electron/main.cjs"), /icon:\s*path\.join\([^\n]+build[^\n]+icon\.ico/);
  const css = read("src/pixel-theme.css");
  assert.equal((css.match(/\.woff2/g) ?? []).length, 4);
  assert.doesNotMatch(css, /\.ttf/);
});

test("all localized READMEs describe an unsigned source-available proprietary prototype", () => {
  const unsignedWords = /unsigned|未签名|未簽署|署名なし|sin firma|nicht signiert|не подписан/i;
  const sourceAvailableWords = /source-available|源码可审阅|原始碼可供審閱|ソース閲覧可能|código fuente disponible|Quellcode ist einsehbar|исходный код доступен/i;
  const proprietaryWords = /proprietary|专有|專有|プロプライエタリ|propietari|proprietär|проприетар/i;
  for (const [file, contents] of readmes) {
    assert.match(contents, unsignedWords, `${file} omits the unsigned Windows notice`);
    assert.match(contents, sourceAvailableWords, `${file} omits source-available wording`);
    assert.match(contents, proprietaryWords, `${file} omits proprietary licensing wording`);
  }
});
