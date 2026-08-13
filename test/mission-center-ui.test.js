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

test("chapter four and every new daily mission have localized render keys", () => {
  for (const key of [
    "story04Title", "story04Description", "story04Objective", "story04Brief", "story04Debrief",
    "weatherTitle", "weatherDescription", "weatherObjective",
    "relayTitle", "relayDescription", "relayObjective",
    "equipmentTitle", "equipmentDescription", "equipmentObjective",
    "contestTitle", "contestDescription", "contestObjective",
    "friendshipTitle", "friendshipDescription", "friendshipObjective",
  ]) {
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
