#!/usr/bin/env node

import {
  formatMissionEconomyReport, simulateMissionEconomy,
} from "../src/game/missionEconomy.js";

const report = simulateMissionEconomy();
if (process.argv.includes("--json")) {
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
} else {
  process.stdout.write(`${formatMissionEconomyReport(report)}\n`);
}

if (!report.releaseReady) {
  const failures = report.thresholds.filter(({ passed }) => !passed)
    .map(({ id }) => id).join(", ");
  process.stderr.write(`Economy release gate failed: ${failures}\n`);
  process.exitCode = 1;
}
