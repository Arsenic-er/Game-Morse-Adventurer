const TEXT = {
  "zh-CN": {
    title: "奖励明细",
    base: "基础通联",
    independentWatch: "独立值守",
    weakSignal: "弱信号通联",
    newRegion: "新地区",
    newDistanceRecord: "距离纪录",
    total: "合计",
    legacy: "旧版日志仅保留历史奖励合计，无法还原各项奖励明细。",
  },
  "zh-TW": {
    title: "獎勵明細",
    base: "基礎通聯",
    independentWatch: "獨立值守",
    weakSignal: "弱訊號通聯",
    newRegion: "新地區",
    newDistanceRecord: "距離紀錄",
    total: "合計",
    legacy: "舊版日誌僅保留歷史獎勵合計，無法還原各項獎勵明細。",
  },
  ja: {
    title: "報酬内訳",
    base: "基本交信",
    independentWatch: "単独運用",
    weakSignal: "弱信号交信",
    newRegion: "新地域",
    newDistanceRecord: "距離記録",
    total: "合計",
    legacy: "旧形式のログには過去の報酬合計のみが残っているため、項目別の内訳は復元できません。",
  },
  en: {
    title: "Reward Breakdown",
    base: "Base contact",
    independentWatch: "Independent watch",
    weakSignal: "Weak-signal contact",
    newRegion: "New region",
    newDistanceRecord: "Distance record",
    total: "Total",
    legacy: "This legacy log retains only the historical reward total; its individual rewards cannot be reconstructed.",
  },
  es: {
    title: "Desglose de recompensas",
    base: "Contacto base",
    independentWatch: "Guardia independiente",
    weakSignal: "Contacto con señal débil",
    newRegion: "Nueva región",
    newDistanceRecord: "Récord de distancia",
    total: "Total",
    legacy: "Este registro antiguo solo conserva el total histórico; no se puede reconstruir el desglose de recompensas.",
  },
  de: {
    title: "Belohnungsübersicht",
    base: "Basisverbindung",
    independentWatch: "Selbstständige Wache",
    weakSignal: "Schwachsignalverbindung",
    newRegion: "Neue Region",
    newDistanceRecord: "Entfernungsrekord",
    total: "Gesamt",
    legacy: "Dieses ältere Log enthält nur die historische Gesamtsumme; die einzelnen Belohnungen lassen sich nicht rekonstruieren.",
  },
  ru: {
    title: "Состав награды",
    base: "Базовая связь",
    independentWatch: "Самостоятельная вахта",
    weakSignal: "Связь при слабом сигнале",
    newRegion: "Новый регион",
    newDistanceRecord: "Рекорд расстояния",
    total: "Итого",
    legacy: "В старой записи сохранена только общая историческая награда; восстановить отдельные начисления невозможно.",
  },
};

const REWARD_ITEMS = ["base", "independentWatch", "weakSignal", "newRegion", "newDistanceRecord"];

function normalizeReward(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, Math.floor(number)) : fallback;
}

export function QsoRewardBreakdown({ language, breakdown, credits, compact = false }) {
  const t = TEXT[language] ?? TEXT.en;
  const hasBreakdown = Boolean(breakdown && typeof breakdown === "object");
  const historicalTotal = normalizeReward(credits);
  const total = hasBreakdown
    ? normalizeReward(breakdown.total, historicalTotal)
    : historicalTotal;
  const rewards = hasBreakdown
    ? REWARD_ITEMS.map((key) => ({ key, value: normalizeReward(breakdown[key]) })).filter((item) => item.value > 0)
    : [];
  const version = hasBreakdown ? String(breakdown.version ?? 1) : "legacy";

  return (
    <section
      className={`qso-reward-breakdown${compact ? " compact" : ""}`}
      data-reward-version={version}
      aria-label={t.title}
    >
      <h4>{t.title}</h4>
      {!hasBreakdown && <p className="qso-reward-legacy">{t.legacy}</p>}
      <dl>
        {rewards.map(({ key, value }) => (
          <div key={key} data-reward={key}>
            <dt>{t[key]}</dt>
            <dd>+{value}</dd>
          </div>
        ))}
        <div className="qso-reward-total" data-reward="total">
          <dt>{t.total}</dt>
          <dd>+{total}</dd>
        </div>
      </dl>
    </section>
  );
}
