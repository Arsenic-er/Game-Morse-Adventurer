import test from "node:test";
import assert from "node:assert/strict";
import {
  personIdForOperator,
  stationIdentityForCallsign,
} from "../src/game/personIdentity.js";

test("SORA keeps one person identity while SIM6JP and SIM5LT remain distinct stations", () => {
  const clubStation = stationIdentityForCallsign(" sim6jp ");
  const lightsStation = stationIdentityForCallsign("sim5lt");

  assert.equal(personIdForOperator({ callsign: "SIM6JP", operatorName: "SORA" }), "person:sora");
  assert.equal(personIdForOperator({ callsign: "SIM5LT", operatorName: "SORA" }), "person:sora");
  assert.deepEqual(clubStation, { stationId: "station:sim6jp", callsign: "SIM6JP" });
  assert.deepEqual(lightsStation, { stationId: "station:lights-sim5lt", callsign: "SIM5LT" });
  assert.notEqual(clubStation.stationId, lightsStation.stationId);
});

test("procedural operators derive a stable person identity from npcId", () => {
  assert.equal(personIdForOperator({
    npcId: "N1-JP-000A",
    callsign: "SIM9ZZ",
    operatorName: "SORA",
  }), "person:procedural:N1-JP-000A");
  assert.deepEqual(stationIdentityForCallsign("SIM9ZZ", { npcId: "N1-JP-000A" }), {
    stationId: "station:procedural:N1-JP-000A",
    callsign: "SIM9ZZ",
  });
});

test("unknown legacy callsigns stay distinct even when their display names match", () => {
  const first = personIdForOperator({ callsign: " old1aa ", operatorName: "SAME NAME" });
  const second = personIdForOperator({ callsign: "old2bb", operatorName: "SAME NAME" });

  assert.equal(first, "person:legacy:OLD1AA");
  assert.equal(second, "person:legacy:OLD2BB");
  assert.notEqual(first, second);
  assert.deepEqual(stationIdentityForCallsign("old1aa"), {
    stationId: "station:legacy:OLD1AA",
    callsign: "OLD1AA",
  });
});

test("hostile identity inputs are bounded and invalid callsigns are rejected", () => {
  assert.equal(personIdForOperator({ callsign: "<script>" }), null);
  assert.equal(stationIdentityForCallsign("<script>"), null);
  assert.equal(personIdForOperator({ npcId: `N1-JP-${"A".repeat(500)}`, callsign: "SIM9ZZ" }).length <= 96, true);
});
