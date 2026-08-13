import { ACCESSORIES } from "./accessoryCatalog.js";
import { ANTENNAS } from "./antennaCatalog.js";
import { TRANSMITTERS } from "./equipmentCatalog.js";
import {
  dailyMissionDefinitions, emptyMissionState, missionBoard,
} from "./missionSystem.js";
import { settleResearchProjects } from "./researchProjects.js";
import {
  ROOT_TECHNOLOGY_ID, TECHNOLOGIES,
} from "./technologyTree.js";
import {
  QSO_REWARD_VALUES, calculateQsoRewardBreakdown,
} from "./qsoRewards.js";

export const MISSION_ECONOMY_SIMULATION_VERSION = 1;

export const DEFAULT_MISSION_ECONOMY_SCENARIO = Object.freeze({
  id: "balanced-operator-v1",
  cycles: 12,
  contactsPerCycle: 2,
  dailyMissionInterval: 2,
  storyClaimCycles: Object.freeze([1, 3, 6, 10]),
  startDate: "2026-08-01T12:00:00.000Z",
  stationId: "economy-calibration-station",
});

export const MISSION_ECONOMY_GATES = Object.freeze({
  minimumQsoIncomeShare: 0.4,
  minimumMissionIncomeShare: 0.25,
  maximumMissionIncomeShare: 0.55,
  qsoOnlyMicaMinimumContacts: 4,
  qsoOnlyMicaMaximumContacts: 10,
  firstPurchaseMinimumCycle: 2,
  firstPurchaseMaximumCycle: 4,
  fullLoadoutMinimumCycle: 4,
  fullLoadoutMaximumCycle: 10,
  firstProductTechnologyMinimumContacts: 3,
  firstProductTechnologyMaximumContacts: 6,
  allProductTechnologyMinimumContacts: 4,
  allProductTechnologyMaximumContacts: 12,
  minimumResearchTpShare: 0.7,
});

const TECHNOLOGY_BY_ID = new Map(TECHNOLOGIES.map((technology) => [technology.id, technology]));

function exactPrice(catalog, itemId) {
  const price = Number(catalog.find(({ id }) => id === itemId)?.price);
  if (!Number.isSafeInteger(price) || price <= 0) throw new Error(`Missing economy price for ${itemId}.`);
  return price;
}

export const ECONOMY_PURCHASE_PLAN = Object.freeze([
  Object.freeze({
    id: "vertical", category: "antenna", itemId: "vertical",
    price: exactPrice(ANTENNAS, "vertical"),
    technologyPath: Object.freeze(["feedline-matching", "vertical-aerials"]),
  }),
  Object.freeze({
    id: "cw-filter-500", category: "accessories", itemId: "cw-filter-500",
    price: exactPrice(ACCESSORIES, "cw-filter-500"),
    technologyPath: Object.freeze(["receiver-audio", "narrowband-filtering"]),
  }),
  Object.freeze({
    id: "yagi-3el", category: "antenna", itemId: "yagi-3el",
    price: exactPrice(ANTENNAS, "yagi-3el"),
    technologyPath: Object.freeze(["feedline-matching", "vertical-aerials", "directional-arrays"]),
  }),
  Object.freeze({
    id: "usdr-8", category: "radio", itemId: "usdr-8",
    price: exactPrice(TRANSMITTERS, "usdr-8"),
    technologyPath: Object.freeze(["rf-circuits", "frequency-synthesis", "multiband-qrp"]),
  }),
]);

function safePositiveInteger(value, fallback) {
  const numeric = Number(value);
  return Number.isSafeInteger(numeric) && numeric > 0 ? numeric : fallback;
}

function normalizedScenario(options = {}) {
  const requestedStoryCycles = Array.isArray(options.storyClaimCycles)
    ? options.storyClaimCycles : DEFAULT_MISSION_ECONOMY_SCENARIO.storyClaimCycles;
  return {
    ...DEFAULT_MISSION_ECONOMY_SCENARIO,
    ...options,
    cycles: safePositiveInteger(options.cycles, DEFAULT_MISSION_ECONOMY_SCENARIO.cycles),
    contactsPerCycle: safePositiveInteger(
      options.contactsPerCycle,
      DEFAULT_MISSION_ECONOMY_SCENARIO.contactsPerCycle,
    ),
    dailyMissionInterval: Number.isSafeInteger(Number(options.dailyMissionInterval))
      ? Math.max(0, Number(options.dailyMissionInterval))
      : DEFAULT_MISSION_ECONOMY_SCENARIO.dailyMissionInterval,
    storyClaimCycles: [...new Set(requestedStoryCycles.map(Number)
      .filter((cycle) => Number.isSafeInteger(cycle) && cycle >= 1))].sort((a, b) => a - b),
  };
}

function emptyResearchState() {
  return {
    technologyPoints: 0,
    completedResearchProjects: [],
    qsoLogs: [],
    qsoRecords: {
      total: 0, weakSignalQsos: 0, contactedRegions: [], longestDistanceKm: 0,
    },
  };
}

function contactFacts(contact) {
  const weakSignal = contact % 3 === 0;
  const independentWatch = contact % 4 === 0;
  const newRegion = contact <= 6;
  const newDistanceRecord = [1, 4, 10].includes(contact);
  const recovery = [4, 12].includes(contact);
  const distanceKm = contact >= 10 ? 9500 : contact >= 4 ? 6000 : 3500;
  return {
    weakSignal,
    independentWatch,
    newRegion,
    newDistanceRecord,
    recovery,
    distanceKm,
    region: `SIM-${Math.min(contact, 6)}`,
  };
}

function addResearchContact(state, contact, facts) {
  const qsoLogs = [...state.qsoLogs, {
    id: `economy-qso-${contact}`,
    transmitAccuracy: facts.recovery ? 89 : 94,
    keyingScore: facts.recovery ? 78 : 86,
    repeatRequests: facts.recovery ? 1 : 0,
    independentWatch: facts.independentWatch,
    attemptHistory: facts.recovery
      ? [{ remoteOutcome: "query", accepted: false }, { remoteOutcome: "copied", accepted: true }]
      : [{ remoteOutcome: "copied", accepted: true }],
  }];
  const contactedRegions = facts.newRegion
    ? [...new Set([...state.qsoRecords.contactedRegions, facts.region])]
    : state.qsoRecords.contactedRegions;
  const qsoRecords = {
    ...state.qsoRecords,
    total: contact,
    weakSignalQsos: state.qsoRecords.weakSignalQsos + (facts.weakSignal ? 1 : 0),
    contactedRegions,
    longestDistanceKm: Math.max(state.qsoRecords.longestDistanceKm, facts.distanceKm),
  };
  const settlement = settleResearchProjects({ ...state, qsoLogs, qsoRecords });
  return {
    state: { ...settlement.save, technologyPoints: 0 },
    technologyPointsAwarded: settlement.technologyPointsAwarded,
    projects: settlement.newlyCompleted.map(({ id }) => id),
  };
}

function technologyPathCost(path) {
  return path.reduce((sum, technologyId) => sum + Number(TECHNOLOGY_BY_ID.get(technologyId)?.cost ?? 0), 0);
}

function storyDefinitions() {
  return missionBoard({
    id: "economy-story-catalog",
    qsoLogs: [],
    missionState: emptyMissionState(),
  }).story;
}

function addMissionIncome(ledger, mission, type) {
  const money = Number(mission?.moneyReward) || 0;
  const technologyPoints = Number(mission?.technologyPointsReward) || 0;
  ledger.money += money;
  ledger.technologyPoints += technologyPoints;
  ledger.entries.push({ id: mission.id, type, money, technologyPoints });
}

function advancePurchasePlan(state, cycle, contact) {
  let advanced = true;
  while (advanced && state.nextGoal < ECONOMY_PURCHASE_PLAN.length) {
    advanced = false;
    const goal = ECONOMY_PURCHASE_PLAN[state.nextGoal];
    for (const technologyId of goal.technologyPath) {
      if (state.unlockedTechnologies.has(technologyId)) continue;
      const technology = TECHNOLOGY_BY_ID.get(technologyId);
      if (!technology?.available || technology.prerequisites.some((id) => !state.unlockedTechnologies.has(id))) {
        return;
      }
      if (state.technologyPoints < technology.cost) return;
      state.technologyPoints -= technology.cost;
      state.technologyPointsSpent += technology.cost;
      state.unlockedTechnologies.add(technologyId);
      state.unlocks.push({ technologyId, cost: technology.cost, cycle, contact });
      advanced = true;
    }
    if (!goal.technologyPath.every((id) => state.unlockedTechnologies.has(id))) return;
    if (!state.technologyReady[goal.id]) state.technologyReady[goal.id] = { cycle, contact };
    if (state.money < goal.price) return;
    state.money -= goal.price;
    state.moneySpent += goal.price;
    state.purchases.push({ id: goal.id, price: goal.price, cycle, contact });
    state.nextGoal += 1;
    advanced = true;
  }
}

function threshold(id, actual, expectation, passed) {
  return { id, actual, expectation, passed: Boolean(passed) };
}

function economyThresholds(report) {
  const gates = MISSION_ECONOMY_GATES;
  const firstPurchase = report.purchases[0];
  const lastPurchase = report.purchases.at(-1);
  const technologyReady = Object.values(report.technology.productReady);
  const firstReadyContact = Math.min(...technologyReady.map(({ contact }) => contact));
  const allReadyContact = Math.max(...technologyReady.map(({ contact }) => contact));
  return [
    threshold("qso-income-share", report.income.qsoShare, `>= ${gates.minimumQsoIncomeShare}`,
      report.income.qsoShare >= gates.minimumQsoIncomeShare),
    threshold("mission-income-floor", report.income.missionShare, `>= ${gates.minimumMissionIncomeShare}`,
      report.income.missionShare >= gates.minimumMissionIncomeShare),
    threshold("mission-income-ceiling", report.income.missionShare, `<= ${gates.maximumMissionIncomeShare}`,
      report.income.missionShare <= gates.maximumMissionIncomeShare),
    threshold("qso-only-mica", report.qsoOnly.contactsToMica,
      `${gates.qsoOnlyMicaMinimumContacts}-${gates.qsoOnlyMicaMaximumContacts} contacts`,
      report.qsoOnly.contactsToMica >= gates.qsoOnlyMicaMinimumContacts
        && report.qsoOnly.contactsToMica <= gates.qsoOnlyMicaMaximumContacts),
    threshold("first-purchase", firstPurchase?.cycle ?? null,
      `cycle ${gates.firstPurchaseMinimumCycle}-${gates.firstPurchaseMaximumCycle}`,
      firstPurchase?.cycle >= gates.firstPurchaseMinimumCycle
        && firstPurchase?.cycle <= gates.firstPurchaseMaximumCycle),
    threshold("full-loadout", report.purchases.length === ECONOMY_PURCHASE_PLAN.length ? lastPurchase?.cycle : null,
      `cycle ${gates.fullLoadoutMinimumCycle}-${gates.fullLoadoutMaximumCycle}`,
      report.purchases.length === ECONOMY_PURCHASE_PLAN.length
        && lastPurchase.cycle >= gates.fullLoadoutMinimumCycle
        && lastPurchase.cycle <= gates.fullLoadoutMaximumCycle),
    threshold("first-product-technology", firstReadyContact,
      `${gates.firstProductTechnologyMinimumContacts}-${gates.firstProductTechnologyMaximumContacts} contacts`,
      firstReadyContact >= gates.firstProductTechnologyMinimumContacts
        && firstReadyContact <= gates.firstProductTechnologyMaximumContacts),
    threshold("all-product-technology", allReadyContact,
      `${gates.allProductTechnologyMinimumContacts}-${gates.allProductTechnologyMaximumContacts} contacts`,
      allReadyContact >= gates.allProductTechnologyMinimumContacts
        && allReadyContact <= gates.allProductTechnologyMaximumContacts),
    threshold("research-tp-share", report.technology.researchShare,
      `>= ${gates.minimumResearchTpShare}`,
      report.technology.researchShare >= gates.minimumResearchTpShare),
  ];
}

export function simulateMissionEconomy(options = {}) {
  const scenario = normalizedScenario(options);
  const story = storyDefinitions();
  const storyByCycle = new Map(scenario.storyClaimCycles
    .slice(0, story.length).map((cycle, index) => [cycle, story[index]]));
  let researchState = emptyResearchState();
  const shopping = {
    money: 0,
    moneySpent: 0,
    technologyPoints: 0,
    technologyPointsSpent: 0,
    unlockedTechnologies: new Set([ROOT_TECHNOLOGY_ID]),
    technologyReady: {},
    unlocks: [],
    purchases: [],
    nextGoal: 0,
  };
  const totals = { qso: 0, story: 0, daily: 0, researchTp: 0, missionTp: 0 };
  const cycles = [];
  const dailyHistory = [];
  let contact = 0;
  let qsoOnlyMoney = 0;
  let contactsToMica = null;
  const micaPrice = exactPrice(TRANSMITTERS, "usdr-8");

  for (let cycle = 1; cycle <= scenario.cycles; cycle += 1) {
    const cycleLedger = { cycle, contacts: [], qsoMoney: 0, researchTp: 0, missions: [], spent: 0 };
    for (let index = 0; index < scenario.contactsPerCycle; index += 1) {
      contact += 1;
      const facts = contactFacts(contact);
      const reward = calculateQsoRewardBreakdown({
        independentWatch: facts.independentWatch,
        finalPropagationLevel: facts.weakSignal ? 2 : 3,
        newRegion: facts.newRegion,
        newDistanceRecord: facts.newDistanceRecord,
      });
      totals.qso += reward.total;
      qsoOnlyMoney += reward.total;
      if (contactsToMica === null && qsoOnlyMoney >= micaPrice) contactsToMica = contact;
      shopping.money += reward.total;
      cycleLedger.qsoMoney += reward.total;
      const research = addResearchContact(researchState, contact, facts);
      researchState = research.state;
      totals.researchTp += research.technologyPointsAwarded;
      shopping.technologyPoints += research.technologyPointsAwarded;
      cycleLedger.researchTp += research.technologyPointsAwarded;
      cycleLedger.contacts.push({ contact, reward: reward.total, facts, projects: research.projects });
      const spentBefore = shopping.moneySpent;
      advancePurchasePlan(shopping, cycle, contact);
      cycleLedger.spent += shopping.moneySpent - spentBefore;
    }

    const missionLedger = { money: 0, technologyPoints: 0, entries: [] };
    const storyMission = storyByCycle.get(cycle);
    if (storyMission) addMissionIncome(missionLedger, storyMission, "story");
    if (scenario.dailyMissionInterval > 0 && cycle % scenario.dailyMissionInterval === 0) {
      const date = new Date(Date.parse(scenario.startDate) + (cycle - 1) * 86_400_000);
      const definitions = dailyMissionDefinitions({
        id: scenario.stationId,
        missionState: { ...emptyMissionState(), history: dailyHistory },
      }, date);
      const selected = definitions[0];
      if (selected) {
        addMissionIncome(missionLedger, selected, "daily");
        dailyHistory.push({
          id: selected.id,
          claimedAt: date.toISOString(),
          moneyReward: selected.moneyReward,
          technologyPointsReward: selected.technologyPointsReward,
          dnaFingerprint: selected.dna.fingerprint,
        });
      }
    }
    totals.story += missionLedger.entries.filter(({ type }) => type === "story")
      .reduce((sum, entry) => sum + entry.money, 0);
    totals.daily += missionLedger.entries.filter(({ type }) => type === "daily")
      .reduce((sum, entry) => sum + entry.money, 0);
    totals.missionTp += missionLedger.technologyPoints;
    shopping.money += missionLedger.money;
    shopping.technologyPoints += missionLedger.technologyPoints;
    cycleLedger.missions = missionLedger.entries;
    const spentBefore = shopping.moneySpent;
    advancePurchasePlan(shopping, cycle, contact);
    cycleLedger.spent += shopping.moneySpent - spentBefore;
    cycleLedger.balance = shopping.money;
    cycleLedger.technologyPoints = shopping.technologyPoints;
    cycles.push(cycleLedger);
  }

  const missionMoney = totals.story + totals.daily;
  const totalMoney = totals.qso + missionMoney;
  const totalTp = totals.researchTp + totals.missionTp;
  const report = {
    version: MISSION_ECONOMY_SIMULATION_VERSION,
    scenario,
    contacts: contact,
    cycles,
    income: {
      qso: totals.qso,
      story: totals.story,
      daily: totals.daily,
      mission: missionMoney,
      total: totalMoney,
      qsoShare: totalMoney ? Number((totals.qso / totalMoney).toFixed(4)) : 0,
      missionShare: totalMoney ? Number((missionMoney / totalMoney).toFixed(4)) : 0,
    },
    spending: { total: shopping.moneySpent, balance: shopping.money },
    purchases: shopping.purchases,
    purchasePlan: ECONOMY_PURCHASE_PLAN.map((goal) => ({
      ...goal,
      cumulativeTechnologyCost: technologyPathCost(goal.technologyPath),
    })),
    technology: {
      researchEarned: totals.researchTp,
      missionEarned: totals.missionTp,
      totalEarned: totalTp,
      spent: shopping.technologyPointsSpent,
      balance: shopping.technologyPoints,
      researchShare: totalTp ? Number((totals.researchTp / totalTp).toFixed(4)) : 0,
      unlocks: shopping.unlocks,
      productReady: shopping.technologyReady,
    },
    qsoOnly: { contactsToMica, moneyAtEnd: qsoOnlyMoney },
    sourceValues: {
      qsoRewards: QSO_REWARD_VALUES,
      storyRewards: story.map(({ id, moneyReward, technologyPointsReward }) => ({ id, moneyReward, technologyPointsReward })),
    },
  };
  report.thresholds = economyThresholds(report);
  report.releaseReady = report.thresholds.every(({ passed }) => passed);
  return report;
}

export function formatMissionEconomyReport(report) {
  const lines = [
    `Mission economy simulation v${report.version}: ${report.scenario.id}`,
    `Cycles/contacts: ${report.scenario.cycles}/${report.contacts}`,
    `Income: QSO ${report.income.qso} (${(report.income.qsoShare * 100).toFixed(1)}%), missions ${report.income.mission} (${(report.income.missionShare * 100).toFixed(1)}%)`,
    `Mission split: story ${report.income.story}, daily ${report.income.daily}`,
    `Purchases: ${report.purchases.map(({ id, cycle }) => `${id}@${cycle}`).join(", ") || "none"}; balance ${report.spending.balance}`,
    `TP: research ${report.technology.researchEarned}, missions ${report.technology.missionEarned}, spent ${report.technology.spent}, balance ${report.technology.balance}`,
    `QSO-only MICA-8 purchasing power: ${report.qsoOnly.contactsToMica} contacts`,
    ...report.thresholds.map(({ id, actual, expectation, passed }) => `${passed ? "PASS" : "FAIL"} ${id}: ${actual} (${expectation})`),
    `Release gate: ${report.releaseReady ? "PASS" : "FAIL"}`,
  ];
  return lines.join("\n");
}
