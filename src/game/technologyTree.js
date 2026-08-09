export const TECHNOLOGY_TREE_VERSION = 1;
export const ROOT_TECHNOLOGY_ID = "station-basics";

export const TECHNOLOGY_RESULT = Object.freeze({
  UNLOCKED: "UNLOCKED",
  UNKNOWN_TECHNOLOGY: "UNKNOWN_TECHNOLOGY",
  ALREADY_UNLOCKED: "ALREADY_UNLOCKED",
  UNAVAILABLE: "UNAVAILABLE",
  MISSING_PREREQUISITE: "MISSING_PREREQUISITE",
  INSUFFICIENT_POINTS: "INSUFFICIENT_POINTS",
});

export const TECHNOLOGY_BRANCHES = Object.freeze([
  { id: "radio", icon: "radio" },
  { id: "antenna", icon: "antenna" },
  { id: "signal", icon: "signal" },
  { id: "power", icon: "power" },
  { id: "automation", icon: "automation" },
]);

export const TECHNOLOGIES = Object.freeze([
  {
    id: ROOT_TECHNOLOGY_ID,
    branch: "core",
    tier: 0,
    cost: 0,
    prerequisites: [],
    available: true,
    names: {
      "zh-CN": "基础台站",
      "zh-TW": "基礎臺站",
      ja: "基礎ステーション",
      en: "Basic Station",
      es: "Estación básica",
      de: "Basisstation",
      ru: "Базовая станция",
    },
  },
  {
    id: "rf-circuits",
    branch: "radio",
    tier: 1,
    cost: 2,
    prerequisites: [ROOT_TECHNOLOGY_ID],
    available: true,
    names: {
      "zh-CN": "射频电路",
      "zh-TW": "射頻電路",
      ja: "高周波回路",
      en: "RF Circuits",
      es: "Circuitos RF",
      de: "HF-Schaltungen",
      ru: "РЧ-схемы",
    },
  },
  {
    id: "frequency-synthesis",
    branch: "radio",
    tier: 2,
    cost: 3,
    prerequisites: ["rf-circuits"],
    available: true,
    names: {
      "zh-CN": "频率合成",
      "zh-TW": "頻率合成",
      ja: "周波数シンセサイザー",
      en: "Frequency Synthesis",
      es: "Síntesis de frecuencia",
      de: "Frequenzsynthese",
      ru: "Синтез частоты",
    },
  },
  {
    id: "multiband-qrp",
    branch: "radio",
    tier: 3,
    cost: 4,
    prerequisites: ["frequency-synthesis"],
    available: true,
    unlocks: [{ category: "radio", itemId: "usdr-8" }],
    names: {
      "zh-CN": "多波段 QRP",
      "zh-TW": "多波段 QRP",
      ja: "マルチバンド QRP",
      en: "Multiband QRP",
      es: "QRP multibanda",
      de: "Mehrband-QRP",
      ru: "Многодиапазонный QRP",
    },
  },
  {
    id: "efficient-power-amplifiers",
    branch: "radio",
    tier: 4,
    cost: 6,
    prerequisites: ["multiband-qrp"],
    available: false,
    names: {
      "zh-CN": "高效率功放", "zh-TW": "高效率功放", ja: "高効率パワーアンプ", en: "Efficient Power Amplifiers",
      es: "Amplificadores eficientes", de: "Effiziente Endstufen", ru: "Эффективные усилители мощности",
    },
  },
  {
    id: "advanced-receiver-architecture",
    branch: "radio",
    tier: 5,
    cost: 8,
    prerequisites: ["efficient-power-amplifiers"],
    available: false,
    names: {
      "zh-CN": "进阶接收架构", "zh-TW": "進階接收架構", ja: "高度な受信機構成", en: "Advanced Receiver Architecture",
      es: "Arquitectura avanzada de receptor", de: "Fortgeschrittene Empfängerarchitektur", ru: "Продвинутая архитектура приёмника",
    },
  },
  {
    id: "software-defined-radio",
    branch: "radio",
    tier: 6,
    cost: 10,
    prerequisites: ["advanced-receiver-architecture"],
    available: false,
    names: {
      "zh-CN": "软件定义电台",
      "zh-TW": "軟體定義電臺",
      ja: "ソフトウェア無線",
      en: "Software-defined Radio",
      es: "Radio definida por software",
      de: "Softwaredefiniertes Funkgerät",
      ru: "Программно-определяемое радио",
    },
  },
  {
    id: "feedline-matching",
    branch: "antenna",
    tier: 1,
    cost: 2,
    prerequisites: [ROOT_TECHNOLOGY_ID],
    available: true,
    names: {
      "zh-CN": "馈线与匹配",
      "zh-TW": "饋線與匹配",
      ja: "給電線と整合",
      en: "Feedlines & Matching",
      es: "Líneas y adaptación",
      de: "Speiseleitungen & Anpassung",
      ru: "Фидеры и согласование",
    },
  },
  {
    id: "vertical-aerials",
    branch: "antenna",
    tier: 2,
    cost: 3,
    prerequisites: ["feedline-matching"],
    available: true,
    unlocks: [{ category: "antenna", itemId: "vertical" }],
    names: {
      "zh-CN": "垂直天线系统",
      "zh-TW": "垂直天線系統",
      ja: "バーチカルアンテナ",
      en: "Vertical Aerials",
      es: "Antenas verticales",
      de: "Vertikalantennen",
      ru: "Вертикальные антенны",
    },
  },
  {
    id: "directional-arrays",
    branch: "antenna",
    tier: 3,
    cost: 5,
    prerequisites: ["vertical-aerials"],
    available: true,
    unlocks: [{ category: "antenna", itemId: "yagi-3el" }],
    names: {
      "zh-CN": "定向阵列",
      "zh-TW": "定向陣列",
      ja: "指向性アレイ",
      en: "Directional Arrays",
      es: "Arreglos direccionales",
      de: "Richtantennen-Arrays",
      ru: "Направленные решётки",
    },
  },
  {
    id: "portable-wire-systems",
    branch: "antenna",
    tier: 4,
    cost: 6,
    prerequisites: ["directional-arrays"],
    available: false,
    names: {
      "zh-CN": "便携线天线", "zh-TW": "便攜線天線", ja: "ポータブルワイヤーアンテナ", en: "Portable Wire Systems",
      es: "Sistemas portátiles de hilo", de: "Portable Drahtantennen", ru: "Портативные проволочные антенны",
    },
  },
  {
    id: "automatic-antenna-matching",
    branch: "antenna",
    tier: 5,
    cost: 8,
    prerequisites: ["portable-wire-systems"],
    available: false,
    names: {
      "zh-CN": "自动天线匹配", "zh-TW": "自動天線匹配", ja: "自動アンテナ整合", en: "Automatic Antenna Matching",
      es: "Adaptación automática de antena", de: "Automatische Antennenanpassung", ru: "Автоматическое согласование антенны",
    },
  },
  {
    id: "antenna-measurement",
    branch: "antenna",
    tier: 6,
    cost: 10,
    prerequisites: ["automatic-antenna-matching"],
    available: false,
    names: {
      "zh-CN": "天线测量分析", "zh-TW": "天線量測分析", ja: "アンテナ測定解析", en: "Antenna Measurement",
      es: "Medición de antenas", de: "Antennenmesstechnik", ru: "Измерение антенн",
    },
  },
  {
    id: "receiver-audio",
    branch: "signal",
    tier: 1,
    cost: 2,
    prerequisites: [ROOT_TECHNOLOGY_ID],
    available: true,
    names: {
      "zh-CN": "接收音频",
      "zh-TW": "接收音訊",
      ja: "受信オーディオ",
      en: "Receiver Audio",
      es: "Audio de recepción",
      de: "Empfänger-Audio",
      ru: "Аудиотракт приёмника",
    },
  },
  {
    id: "narrowband-filtering",
    branch: "signal",
    tier: 2,
    cost: 3,
    prerequisites: ["receiver-audio"],
    available: true,
    unlocks: [{ category: "accessories", itemId: "cw-filter-500" }],
    names: {
      "zh-CN": "窄带滤波",
      "zh-TW": "窄頻濾波",
      ja: "狭帯域フィルター",
      en: "Narrowband Filtering",
      es: "Filtrado de banda estrecha",
      de: "Schmalbandfilterung",
      ru: "Узкополосная фильтрация",
    },
  },
  {
    id: "automatic-gain-control",
    branch: "signal",
    tier: 3,
    cost: 5,
    prerequisites: ["narrowband-filtering"],
    available: false,
    names: {
      "zh-CN": "自动增益控制", "zh-TW": "自動增益控制", ja: "自動利得制御", en: "Automatic Gain Control",
      es: "Control automático de ganancia", de: "Automatische Verstärkungsregelung", ru: "Автоматическая регулировка усиления",
    },
  },
  {
    id: "noise-reduction",
    branch: "signal",
    tier: 4,
    cost: 6,
    prerequisites: ["automatic-gain-control"],
    available: false,
    names: {
      "zh-CN": "噪声抑制", "zh-TW": "雜訊抑制", ja: "ノイズ低減", en: "Noise Reduction",
      es: "Reducción de ruido", de: "Rauschunterdrückung", ru: "Шумоподавление",
    },
  },
  {
    id: "spectrum-analysis",
    branch: "signal",
    tier: 5,
    cost: 8,
    prerequisites: ["noise-reduction"],
    available: false,
    names: {
      "zh-CN": "频谱分析", "zh-TW": "頻譜分析", ja: "スペクトラム解析", en: "Spectrum Analysis",
      es: "Análisis de espectro", de: "Spektrumanalyse", ru: "Анализ спектра",
    },
  },
  {
    id: "adaptive-dsp",
    branch: "signal",
    tier: 6,
    cost: 10,
    prerequisites: ["spectrum-analysis"],
    available: false,
    names: {
      "zh-CN": "自适应 DSP",
      "zh-TW": "自適應 DSP",
      ja: "適応 DSP",
      en: "Adaptive DSP",
      es: "DSP adaptativo",
      de: "Adaptiver DSP",
      ru: "Адаптивный DSP",
    },
  },
  {
    id: "regulated-power-supplies",
    branch: "power",
    tier: 1,
    cost: 2,
    prerequisites: [ROOT_TECHNOLOGY_ID],
    available: false,
    names: {
      "zh-CN": "稳压电源", "zh-TW": "穩壓電源", ja: "安定化電源", en: "Regulated Power Supplies",
      es: "Fuentes reguladas", de: "Geregelte Netzteile", ru: "Стабилизированные источники питания",
    },
  },
  {
    id: "battery-systems",
    branch: "power",
    tier: 2,
    cost: 3,
    prerequisites: ["regulated-power-supplies"],
    available: false,
    names: {
      "zh-CN": "电池系统", "zh-TW": "電池系統", ja: "バッテリーシステム", en: "Battery Systems",
      es: "Sistemas de baterías", de: "Batteriesysteme", ru: "Аккумуляторные системы",
    },
  },
  {
    id: "field-power",
    branch: "power",
    tier: 3,
    cost: 5,
    prerequisites: ["battery-systems"],
    available: false,
    names: {
      "zh-CN": "野外供电", "zh-TW": "野外供電", ja: "フィールド電源", en: "Field Power",
      es: "Energía de campo", de: "Feldstromversorgung", ru: "Полевое питание",
    },
  },
  {
    id: "solar-charging",
    branch: "power",
    tier: 4,
    cost: 7,
    prerequisites: ["field-power"],
    available: false,
    names: {
      "zh-CN": "太阳能充电", "zh-TW": "太陽能充電", ja: "ソーラー充電", en: "Solar Charging",
      es: "Carga solar", de: "Solarladung", ru: "Солнечная зарядка",
    },
  },
  {
    id: "station-power-management",
    branch: "power",
    tier: 5,
    cost: 9,
    prerequisites: ["solar-charging"],
    available: false,
    names: {
      "zh-CN": "台站能源管理", "zh-TW": "臺站能源管理", ja: "局電源管理", en: "Station Power Management",
      es: "Gestión energética de estación", de: "Stations-Energiemanagement", ru: "Управление питанием станции",
    },
  },
  {
    id: "digital-logging",
    branch: "automation",
    tier: 1,
    cost: 2,
    prerequisites: [ROOT_TECHNOLOGY_ID],
    available: false,
    names: {
      "zh-CN": "数字日志", "zh-TW": "數位日誌", ja: "デジタルログ", en: "Digital Logging",
      es: "Registro digital", de: "Digitales Logbuch", ru: "Цифровой журнал",
    },
  },
  {
    id: "cat-control",
    branch: "automation",
    tier: 2,
    cost: 3,
    prerequisites: ["digital-logging"],
    available: false,
    names: {
      "zh-CN": "CAT 控制", "zh-TW": "CAT 控制", ja: "CAT 制御", en: "CAT Control",
      es: "Control CAT", de: "CAT-Steuerung", ru: "Управление CAT",
    },
  },
  {
    id: "antenna-switching",
    branch: "automation",
    tier: 3,
    cost: 5,
    prerequisites: ["cat-control"],
    available: false,
    names: {
      "zh-CN": "天线切换", "zh-TW": "天線切換", ja: "アンテナ切替", en: "Antenna Switching",
      es: "Conmutación de antenas", de: "Antennenumschaltung", ru: "Коммутация антенн",
    },
  },
  {
    id: "propagation-forecasting",
    branch: "automation",
    tier: 4,
    cost: 7,
    prerequisites: ["antenna-switching"],
    available: false,
    names: {
      "zh-CN": "传播预测", "zh-TW": "傳播預測", ja: "伝搬予測", en: "Propagation Forecasting",
      es: "Predicción de propagación", de: "Ausbreitungsvorhersage", ru: "Прогноз прохождения",
    },
  },
  {
    id: "remote-station-control",
    branch: "automation",
    tier: 5,
    cost: 9,
    prerequisites: ["propagation-forecasting", "station-power-management"],
    available: false,
    names: {
      "zh-CN": "远程台站控制", "zh-TW": "遠端臺站控制", ja: "リモート局制御", en: "Remote Station Control",
      es: "Control remoto de estación", de: "Fernsteuerung der Station", ru: "Удалённое управление станцией",
    },
  },
]);

const TECHNOLOGY_BY_ID = new Map(TECHNOLOGIES.map((technology) => [technology.id, technology]));
const ITEM_REQUIREMENTS = new Map();
for (const technology of TECHNOLOGIES) {
  for (const unlock of technology.unlocks ?? []) {
    ITEM_REQUIREMENTS.set(`${unlock.category}:${unlock.itemId}`, technology.id);
  }
}

export function technologyName(technology, language = "en") {
  return technology?.names?.[language] ?? technology?.names?.en ?? "";
}

export function getTechnology(technologyId) {
  return TECHNOLOGY_BY_ID.get(technologyId) ?? null;
}

export function technologyForItem(category, itemId) {
  return getTechnology(ITEM_REQUIREMENTS.get(`${category}:${itemId}`));
}

export function normalizeTechnologyPoints(value) {
  const points = Number(value);
  return Number.isFinite(points)
    ? Math.min(Number.MAX_SAFE_INTEGER, Math.max(0, Math.floor(points)))
    : 0;
}

function addWithPrerequisites(target, technologyId) {
  const technology = getTechnology(technologyId);
  if (!technology || target.has(technology.id)) return;
  for (const prerequisite of technology.prerequisites) addWithPrerequisites(target, prerequisite);
  target.add(technology.id);
}

export function normalizeUnlockedTechnologies(values, { unlockAllCurrent = false, ownedItems = [] } = {}) {
  const unlocked = new Set();
  addWithPrerequisites(unlocked, ROOT_TECHNOLOGY_ID);
  if (unlockAllCurrent) {
    for (const technology of TECHNOLOGIES) {
      if (technology.available) addWithPrerequisites(unlocked, technology.id);
    }
  }
  if (Array.isArray(values)) {
    for (const technologyId of values) addWithPrerequisites(unlocked, technologyId);
  }
  for (const item of ownedItems) {
    const requirement = technologyForItem(item.category, item.itemId);
    if (requirement) addWithPrerequisites(unlocked, requirement.id);
  }
  return TECHNOLOGIES.map(({ id }) => id).filter((id) => unlocked.has(id));
}

export function hasTechnologyState(save) {
  return Number(save?.technologyTreeVersion) >= 1
    || Object.prototype.hasOwnProperty.call(save ?? {}, "technologyPoints")
    || Object.prototype.hasOwnProperty.call(save ?? {}, "unlockedTechnologies");
}

export function isTechnologyUnlocked(save, technologyId) {
  return Array.isArray(save?.unlockedTechnologies) && save.unlockedTechnologies.includes(technologyId);
}

export function isItemTechnologyUnlocked(save, category, itemId) {
  const requirement = technologyForItem(category, itemId);
  if (!requirement) return true;
  // Direct callers using a pre-research save keep the old catalogue behaviour.
  if (!hasTechnologyState(save)) return true;
  return isTechnologyUnlocked(save, requirement.id);
}

export function unlockTechnology(save, technologyId) {
  const technology = getTechnology(technologyId);
  if (!technology) return { save, unlocked: false, reason: TECHNOLOGY_RESULT.UNKNOWN_TECHNOLOGY };
  if (isTechnologyUnlocked(save, technology.id)) {
    return { save, unlocked: false, reason: TECHNOLOGY_RESULT.ALREADY_UNLOCKED };
  }
  if (!technology.available) return { save, unlocked: false, reason: TECHNOLOGY_RESULT.UNAVAILABLE };
  if (technology.prerequisites.some((id) => !isTechnologyUnlocked(save, id))) {
    return { save, unlocked: false, reason: TECHNOLOGY_RESULT.MISSING_PREREQUISITE };
  }
  const technologyPoints = normalizeTechnologyPoints(save?.technologyPoints);
  if (technologyPoints < technology.cost) {
    return { save, unlocked: false, reason: TECHNOLOGY_RESULT.INSUFFICIENT_POINTS };
  }
  return {
    save: {
      ...save,
      technologyTreeVersion: TECHNOLOGY_TREE_VERSION,
      technologyPoints: technologyPoints - technology.cost,
      unlockedTechnologies: normalizeUnlockedTechnologies([
        ...(save?.unlockedTechnologies ?? []),
        technology.id,
      ]),
      updatedAt: new Date().toISOString(),
    },
    unlocked: true,
    reason: TECHNOLOGY_RESULT.UNLOCKED,
    technology,
  };
}
