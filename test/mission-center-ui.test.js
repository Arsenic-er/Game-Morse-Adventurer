import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("../src/screens/MissionCenterModal.jsx", import.meta.url), "utf8");
const styles = readFileSync(new URL("../src/pixel-theme.css", import.meta.url), "utf8");

test("mission cards render narrative state, contact contracts, and operator relationships", () => {
  assert.match(source, /data-mission-narrative=\{narrative\.kind\}/);
  assert.match(source, /\["ready", "claimed"\]\.includes\(mission\.status\)/);
  assert.match(source, /data-mission-contract=/);
  assert.match(source, /data-contract-clue=\{clue\.kind\}/);
  assert.match(source, /data-relationship-callsign=\{mission\.targetCallsign\}/);
  assert.match(source, /data-relationship-stat="completedQsos"/);
  assert.match(source, /data-relationship-stat="weakSignalRecoveries"/);
});

test("chapters four and five and every new daily mission have localized render keys", () => {
  for (const key of [
    "story04Title", "story04Description", "story04Objective", "story04Brief", "story04Debrief",
    "story05Title", "story05Description", "story05Objective", "story05Brief", "story05Debrief",
    "weatherTitle", "weatherDescription", "weatherObjective",
    "relayTitle", "relayDescription", "relayObjective",
    "equipmentTitle", "equipmentDescription", "equipmentObjective",
    "contestTitle", "contestDescription", "contestObjective",
    "friendshipTitle", "friendshipDescription", "friendshipObjective",
  ]) {
    assert.equal((source.match(new RegExp(`${key}:`, "g")) ?? []).length, 7, `${key} must exist in seven languages`);
  }
});

test("chapter five cards expose story, annual, and practice launch actions", () => {
  assert.match(source, /data-action="launch-lights-story"/);
  assert.match(source, /data-action="launch-lights-annual"/);
  assert.match(source, /data-action="launch-lights-practice"/);
  for (const key of ["launchEvent", "annualReplay", "practiceRun"]) {
    assert.equal((source.match(new RegExp(`${key}:`, "g")) ?? []).length, 7, `${key} must exist in seven languages`);
  }
});

test("chapter six keeps its accepted-story launch and exposes a durable replay action", () => {
  assert.match(source, /mission\.id === "story-06" && active/);
  assert.match(source, /data-action="launch-expedition-story"/);
  assert.match(source, /data-action="launch-expedition-replay"/);
  for (const key of ["story06Title", "story06Description", "story06Objective", "story06Brief", "story06Debrief", "launchExpedition"]) {
    assert.equal((source.match(new RegExp(`${key}:`, "g")) ?? []).length, 7, `${key} must exist in seven languages`);
  }
});

test("chapter seven exposes its accepted investigation action with localized story copy", () => {
  assert.match(source, /mission\.id === "story-07" && active/);
  assert.match(source, /data-action="launch-qsl-story"/);
  for (const key of ["story07Title", "story07Description", "story07Objective", "story07Brief", "story07Debrief", "launchQslStory"]) {
    assert.equal((source.match(new RegExp(`${key}:`, "g")) ?? []).length, 7, `${key} must exist in seven languages`);
  }
});

test("chapter eight exposes its accepted service-net action and durable replay with localized story copy", () => {
  assert.match(source, /mission\.id === "story-08" && \(active \|\| serviceNetReplay\)/);
  assert.match(source, /data-action="launch-service-net"/);
  for (const key of ["story08Title", "story08Description", "story08Objective", "story08Brief", "story08Debrief", "launchServiceNet"]) {
    assert.equal((source.match(new RegExp(`${key}:`, "g")) ?? []).length, 7, `${key} must exist in seven languages`);
  }
});

test("new mission information keeps the established pixel-card styling", () => {
  for (const selector of [".mission-narrative", ".mission-contract", ".mission-target-identity", ".mission-relationship"]) {
    assert.ok(styles.includes(selector), `${selector} must be styled`);
  }
  assert.match(styles, /\.mission-contract li[^\{]*\{[^}]*border:/s);
  assert.match(styles, /\.mission-relationship[^\{]*\{[^}]*border-left:/s);
});
