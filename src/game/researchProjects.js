import { normalizeTechnologyPoints } from "./technologyTree.js";

export const RESEARCH_PROJECTS_VERSION = 1;

export const RESEARCH_PROJECTS = Object.freeze([
  {
    id: "first-contact",
    tier: 1,
    reward: 2,
    prerequisite: null,
    metric: "total",
    target: 1,
    names: {
      "zh-CN": "首次值守", "zh-TW": "首次值守", ja: "初交信", en: "First Watch",
      es: "Primera guardia", de: "Erste Wache", ru: "Первая вахта",
    },
  },
  {
    id: "reliable-operator",
    tier: 2,
    reward: 2,
    prerequisite: "first-contact",
    metric: "total",
    target: 3,
    names: {
      "zh-CN": "可靠操作员", "zh-TW": "可靠操作員", ja: "確実な運用者", en: "Reliable Operator",
      es: "Operador fiable", de: "Zuverlässiger Operator", ru: "Надёжный оператор",
    },
  },
  {
    id: "precision-operating",
    tier: 3,
    reward: 3,
    prerequisite: "reliable-operator",
    metric: "clean",
    target: 2,
    names: {
      "zh-CN": "精准操作", "zh-TW": "精準操作", ja: "精密運用", en: "Precision Operating",
      es: "Operación precisa", de: "Präziser Betrieb", ru: "Точная работа",
    },
  },
  {
    id: "recovery-drill",
    tier: 3,
    reward: 3,
    prerequisite: "reliable-operator",
    metric: "recovery",
    target: 1,
    names: {
      "zh-CN": "纠错演练", "zh-TW": "糾錯演練", ja: "訂正訓練", en: "Recovery Drill",
      es: "Práctica de recuperación", de: "Korrekturübung", ru: "Тренировка исправления",
    },
  },
  {
    id: "endurance-watch",
    tier: 3,
    reward: 4,
    prerequisite: "reliable-operator",
    metric: "total",
    target: 10,
    names: {
      "zh-CN": "持续值守", "zh-TW": "持續值守", ja: "継続運用", en: "Endurance Watch",
      es: "Guardia prolongada", de: "Ausdauerwache", ru: "Продолжительная вахта",
    },
  },
  {
    id: "weak-signal-study",
    tier: 3,
    reward: 3,
    prerequisite: "reliable-operator",
    metric: "weakSignalQsos",
    target: 1,
    names: {
      "zh-CN": "弱信号研究", "zh-TW": "弱訊號研究", ja: "弱信号研究", en: "Weak-signal Study",
      es: "Estudio de señal débil", de: "Schwachsignalstudie", ru: "Исследование слабых сигналов",
    },
  },
  {
    id: "weak-signal-specialist",
    tier: 4,
    reward: 5,
    prerequisite: "weak-signal-study",
    metric: "weakSignalQsos",
    target: 3,
    names: {
      "zh-CN": "弱信号专精", "zh-TW": "弱訊號專精", ja: "弱信号スペシャリスト", en: "Weak-signal Specialist",
      es: "Especialista en señales débiles", de: "Schwachsignal-Spezialist", ru: "Специалист по слабым сигналам",
    },
  },
  {
    id: "regional-network",
    tier: 4,
    reward: 4,
    prerequisite: "weak-signal-study",
    metric: "regions",
    target: 3,
    names: {
      "zh-CN": "区域联络网", "zh-TW": "區域聯絡網", ja: "地域ネットワーク", en: "Regional Network",
      es: "Red regional", de: "Regionales Netz", ru: "Региональная сеть",
    },
  },
  {
    id: "world-network",
    tier: 5,
    reward: 6,
    prerequisite: "regional-network",
    metric: "regions",
    target: 6,
    names: {
      "zh-CN": "世界联络网", "zh-TW": "世界聯絡網", ja: "世界ネットワーク", en: "World Network",
      es: "Red mundial", de: "Weltnetz", ru: "Всемирная сеть",
    },
  },
  {
    id: "independent-watch",
    tier: 4,
    reward: 4,
    prerequisite: "reliable-operator",
    metric: "independent",
    target: 1,
    names: {
      "zh-CN": "独立值守", "zh-TW": "獨立值守", ja: "単独運用", en: "Independent Watch",
      es: "Guardia independiente", de: "Selbstständige Wache", ru: "Самостоятельная вахта",
    },
  },
  {
    id: "independent-operator",
    tier: 5,
    reward: 6,
    prerequisite: "independent-watch",
    metric: "independent",
    target: 3,
    names: {
      "zh-CN": "独立操作员", "zh-TW": "獨立操作員", ja: "独立運用者", en: "Independent Operator",
      es: "Operador independiente", de: "Selbstständiger Operator", ru: "Самостоятельный оператор",
    },
  },
  {
    id: "dx-field-programme",
    tier: 5,
    reward: 5,
    prerequisite: "regional-network",
    metric: "longestDistanceKm",
    target: 5000,
    names: {
      "zh-CN": "DX 远征项目", "zh-TW": "DX 遠征計畫", ja: "DX フィールド計画", en: "DX Field Programme",
      es: "Programa de campo DX", de: "DX-Feldprogramm", ru: "Полевая программа DX",
    },
  },
  {
    id: "deep-dx",
    tier: 6,
    reward: 7,
    prerequisite: "dx-field-programme",
    metric: "longestDistanceKm",
    target: 9000,
    names: {
      "zh-CN": "深度 DX", "zh-TW": "深度 DX", ja: "ディープ DX", en: "Deep DX",
      es: "DX profundo", de: "Deep DX", ru: "Дальний DX",
    },
  },
  {
    id: "seasoned-operator",
    tier: 6,
    reward: 8,
    prerequisite: "endurance-watch",
    metric: "total",
    target: 25,
    names: {
      "zh-CN": "资深操作员", "zh-TW": "資深操作員", ja: "熟練運用者", en: "Seasoned Operator",
      es: "Operador veterano", de: "Erfahrener Operator", ru: "Опытный оператор",
    },
  },
]);

const PROJECT_IDS = new Set(RESEARCH_PROJECTS.map(({ id }) => id));

export function researchProjectName(project, language = "en") {
  return project?.names?.[language] ?? project?.names?.en ?? "";
}

export function normalizeCompletedResearchProjects(values) {
  const requested = new Set(Array.isArray(values) ? values : []);
  return RESEARCH_PROJECTS.map(({ id }) => id).filter((id) => requested.has(id) && PROJECT_IDS.has(id));
}

export function researchProjectProgress(save, project) {
  const records = save?.qsoRecords ?? {};
  const logs = Array.isArray(save?.qsoLogs) ? save.qsoLogs : [];
  if (project.metric === "regions") return Array.isArray(records.contactedRegions) ? records.contactedRegions.length : 0;
  if (project.metric === "independent") {
    return logs.filter((entry) => entry?.independentWatch === true).length;
  }
  if (project.metric === "clean") {
    return logs.filter((entry) => (
      Number(entry?.transmitAccuracy) >= 90
      && Number(entry?.keyingScore) >= 80
      && Number(entry?.repeatRequests ?? 0) === 0
    )).length;
  }
  if (project.metric === "recovery") {
    return logs.filter((entry) => Array.isArray(entry?.attemptHistory) && entry.attemptHistory.some((attempt) => {
      const outcome = String(attempt?.remoteOutcome ?? attempt?.outcome ?? "").toLowerCase();
      return outcome.includes("query")
        || outcome.includes("unreadable")
        || outcome.includes("repeat")
        || attempt?.accepted === false;
    })).length;
  }
  const value = Number(records[project.metric]);
  return Number.isFinite(value) ? Math.max(0, value) : 0;
}

export function settleResearchProjects(save) {
  const completed = new Set(normalizeCompletedResearchProjects(save?.completedResearchProjects));
  const newlyCompleted = [];
  for (const project of RESEARCH_PROJECTS) {
    if (completed.has(project.id)) continue;
    if (project.prerequisite && !completed.has(project.prerequisite)) continue;
    if (researchProjectProgress(save, project) < project.target) continue;
    completed.add(project.id);
    newlyCompleted.push(project);
  }
  const technologyPointsAwarded = newlyCompleted.reduce((sum, project) => sum + project.reward, 0);
  return {
    save: {
      ...save,
      technologyPoints: normalizeTechnologyPoints(save?.technologyPoints) + technologyPointsAwarded,
      completedResearchProjects: normalizeCompletedResearchProjects([...completed]),
    },
    newlyCompleted,
    technologyPointsAwarded,
  };
}
