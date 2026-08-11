import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft, BookOpenText, CalendarDots, CheckCircle, Coins, Crosshair,
  LockKey, Play, SealCheck, Trash, X,
} from "@phosphor-icons/react";
import { MAX_ACTIVE_DAILY_MISSIONS, missionBoard, missionSummary } from "../game/missionSystem.js";

const TEXT = {
  "zh-CN": {
    title: "任务中心", kicker: "未完成的日志", story: "主线日志", daily: "常规委托", chapter: "章节", progress: "进度",
    available: "可接受", active: "进行中", ready: "可领取", locked: "未解锁", claimed: "已完成",
    accept: "接受任务", claim: "领取奖励", abandon: "放弃任务", close: "返回管理中心", money: "金钱", tp: "技术点",
    storyProgress: "日志进度", dailyNote: "每天根据呼号生成三份委托；最多同时进行两份，已接受的不会在换日时消失。",
    limit: "常规委托栏已满", targetCallsign: "优先监听", propagation: "只有当前传播允许时，目标台才会回应。",
    story01Title: "第一次开机", story01Description: "陌生人的一句“听见你了”，让这间沉默的房间重新有了声音。", story01Objective: "完成并保存第一次 QSO。",
    story02Title: "纸页上的呼号", story02Description: "褪色日志里圈着 SIM3RA。对方是否还记得这本没有写完的日志？", story02Objective: "与 SIM3RA 完成 QSO，并在通联中至少使用一次 AGN K。",
    story03Title: "不同的节奏", story03Description: "有人谨慎，有人急促，也有人需要更慢的速度。先学会听见差异。", story03Objective: "完成来自三种不同操作员风格的 QSO。",
    cleanTitle: "整洁值守", cleanDescription: "稳定的基本功仍然是台站最可靠的收入。", cleanObjective: "接受后完成一次发报准确度不低于 85、节奏不低于 75 且无需重发的 QSO。",
    weakTitle: "微弱窗口", weakDescription: "在噪声和衰落里保留足够的耐心。", weakObjective: "接受后在 P0–P2 传播等级完成一次 QSO。",
    regionsTitle: "两地来波", regionsDescription: "在同一次值守中听见两个不同地区。", regionsObjective: "接受后完成来自两个不同地区的 QSO。",
    distanceTitle: "三千公里", distanceDescription: "抓住一次足以越过远方地平线的传播。", distanceObjective: "接受后完成一次距离不少于 3,000 km 的 QSO。",
    independentTitle: "独立值守", independentDescription: "关掉引导，只依靠自己的耳朵和判断。", independentObjective: "接受后完成一次未使用引导或视觉辅助的 QSO。",
  },
  "zh-TW": {
    title: "任務中心", kicker: "未完成的日誌", story: "主線日誌", daily: "常規委託", chapter: "章節", progress: "進度",
    available: "可接受", active: "進行中", ready: "可領取", locked: "未解鎖", claimed: "已完成",
    accept: "接受任務", claim: "領取獎勵", abandon: "放棄任務", close: "返回管理中心", money: "金錢", tp: "技術點",
    storyProgress: "日誌進度", dailyNote: "每天依呼號生成三份委託；最多同時進行兩份，已接受的任務不會在換日時消失。",
    limit: "常規委託欄已滿", targetCallsign: "優先監聽", propagation: "只有目前傳播允許時，目標臺才會回應。",
    story01Title: "第一次開機", story01Description: "陌生人的一句「聽見你了」，讓沉默的房間重新有了聲音。", story01Objective: "完成並儲存第一次 QSO。",
    story02Title: "紙頁上的呼號", story02Description: "褪色日誌裡圈著 SIM3RA。對方是否還記得這本未完成的日誌？", story02Objective: "與 SIM3RA 完成 QSO，並在通聯中至少使用一次 AGN K。",
    story03Title: "不同的節奏", story03Description: "有人謹慎，有人急促，也有人需要更慢的速度。先學會聽見差異。", story03Objective: "完成來自三種不同操作員風格的 QSO。",
    cleanTitle: "整潔值守", cleanDescription: "穩定的基本功仍是臺站最可靠的收入。", cleanObjective: "接受後完成一次發報準確度不低於 85、節奏不低於 75 且無需重發的 QSO。",
    weakTitle: "微弱窗口", weakDescription: "在雜訊和衰落裡保留足夠的耐心。", weakObjective: "接受後在 P0–P2 傳播等級完成一次 QSO。",
    regionsTitle: "兩地來波", regionsDescription: "在同一次值守中聽見兩個不同地區。", regionsObjective: "接受後完成來自兩個不同地區的 QSO。",
    distanceTitle: "三千公里", distanceDescription: "抓住一次足以越過遠方地平線的傳播。", distanceObjective: "接受後完成一次距離不少於 3,000 km 的 QSO。",
    independentTitle: "獨立值守", independentDescription: "關掉引導，只依靠自己的耳朵和判斷。", independentObjective: "接受後完成一次未使用引導或視覺輔助的 QSO。",
  },
  ja: {
    title: "ミッションセンター", kicker: "未完のログブック", story: "メインログ", daily: "通常依頼", chapter: "章", progress: "進捗",
    available: "受注可能", active: "進行中", ready: "受取可能", locked: "未解放", claimed: "完了",
    accept: "受注する", claim: "報酬を受け取る", abandon: "依頼を破棄", close: "管理センターへ", money: "所持金", tp: "技術ポイント",
    storyProgress: "ログ進捗", dailyNote: "コールサインを基に毎日3件生成。通常依頼は同時に2件までで、受注済みの依頼は日付が変わっても残ります。",
    limit: "通常依頼枠が満杯です", targetCallsign: "優先受信", propagation: "現在の伝搬が届く場合だけ対象局が応答します。",
    story01Title: "初めての電源", story01Description: "見知らぬ誰かの「聞こえた」が、静かな部屋にもう一度音を戻します。", story01Objective: "最初のQSOを完了し、ログに保存する。",
    story02Title: "紙に残ったコール", story02Description: "色あせたログにはSIM3RAが囲まれています。相手は未完のログを覚えているでしょうか。", story02Objective: "SIM3RAとQSOし、交信中にAGN Kを1回以上使用する。",
    story03Title: "それぞれのリズム", story03Description: "慎重な人、速い人、ゆっくりでなければ聞けない人。まず違いを聞き分けます。", story03Objective: "3種類のオペレータースタイルとQSOする。",
    cleanTitle: "クリーン・ウォッチ", cleanDescription: "確かな基本操作は今も局の最も安定した収入です。", cleanObjective: "受注後、送信精度85以上、リズム75以上、再送なしのQSOを1回完了する。",
    weakTitle: "弱い窓", weakDescription: "雑音とフェージングの中でも急がずに待ちます。", weakObjective: "受注後、伝搬レベルP0–P2でQSOを1回完了する。",
    regionsTitle: "二つの地域", regionsDescription: "一度の運用で異なる二地域の信号を聞きます。", regionsObjective: "受注後、異なる二地域とQSOする。",
    distanceTitle: "三千キロ", distanceDescription: "遠い地平線を越える伝搬を一度つかみます。", distanceObjective: "受注後、3,000 km以上のQSOを1回完了する。",
    independentTitle: "単独運用", independentDescription: "ガイドを閉じ、自分の耳と判断だけで運用します。", independentObjective: "受注後、ガイドと視覚補助なしでQSOを1回完了する。",
  },
  en: {
    title: "Mission Center", kicker: "The Unfinished Logbook", story: "Story Log", daily: "Regular Commissions", chapter: "Chapter", progress: "Progress",
    available: "Available", active: "Active", ready: "Reward Ready", locked: "Locked", claimed: "Completed",
    accept: "Accept Mission", claim: "Claim Reward", abandon: "Abandon", close: "Back to Management Center", money: "Money", tp: "Technology Point",
    storyProgress: "Log Progress", dailyNote: "Three commissions are generated daily from your station seed. Up to two may be active; accepted work survives the day change.",
    limit: "Regular commission slots are full", targetCallsign: "Priority Listener", propagation: "The target station answers only when current propagation reaches it.",
    story01Title: "First Power-On", story01Description: "A stranger's “I hear you” brings sound back into the silent room.", story01Objective: "Complete and save your first QSO.",
    story02Title: "The Callsign on Paper", story02Description: "SIM3RA is circled in the faded log. Does that operator still remember the unfinished page?", story02Objective: "Complete a QSO with SIM3RA and use AGN K at least once during the contact.",
    story03Title: "Different Rhythms", story03Description: "Some operators are cautious, some rush, and some need a slower pace. Learn to hear the difference.", story03Objective: "Complete QSOs with three distinct operator styles.",
    cleanTitle: "Clean Watch", cleanDescription: "Steady fundamentals remain the station's most dependable income.", cleanObjective: "After accepting, complete one QSO with at least 85 transmit accuracy, 75 rhythm, and no repeats.",
    weakTitle: "Weak Window", weakDescription: "Keep enough patience through noise and fading.", weakObjective: "After accepting, complete one QSO at propagation level P0–P2.",
    regionsTitle: "Signals from Two Regions", regionsDescription: "Hear two different regions during the same watch.", regionsObjective: "After accepting, complete QSOs with two different regions.",
    distanceTitle: "Three Thousand Kilometers", distanceDescription: "Catch one opening that reaches beyond a distant horizon.", distanceObjective: "After accepting, complete one QSO of at least 3,000 km.",
    independentTitle: "Independent Watch", independentDescription: "Close the guidance and rely on your own ears and judgment.", independentObjective: "After accepting, complete one QSO without guidance or visual assistance.",
  },
  es: {
    title: "Centro de misiones", kicker: "El registro inacabado", story: "Registro principal", daily: "Encargos habituales", chapter: "Capítulo", progress: "Progreso",
    available: "Disponible", active: "En curso", ready: "Recompensa lista", locked: "Bloqueado", claimed: "Completado",
    accept: "Aceptar misión", claim: "Recibir recompensa", abandon: "Abandonar", close: "Volver al Centro de Gestión", money: "Dinero", tp: "Punto tecnológico",
    storyProgress: "Progreso del registro", dailyNote: "Cada día se generan tres encargos según tu estación. Puedes mantener dos activos; los aceptados no desaparecen al cambiar el día.",
    limit: "Los espacios de encargos están llenos", targetCallsign: "Escucha prioritaria", propagation: "La estación objetivo solo responderá si la propagación actual la alcanza.",
    story01Title: "Primer encendido", story01Description: "El «te escucho» de un desconocido devuelve el sonido a la habitación silenciosa.", story01Objective: "Completa y guarda tu primer QSO.",
    story02Title: "El indicativo en el papel", story02Description: "SIM3RA está rodeado en el registro descolorido. ¿Recordará aún esa página inacabada?", story02Objective: "Completa un QSO con SIM3RA y usa AGN K al menos una vez.",
    story03Title: "Ritmos diferentes", story03Description: "Algunos son prudentes, otros rápidos y otros necesitan más calma. Aprende a oír la diferencia.", story03Objective: "Completa QSO con tres estilos de operador distintos.",
    cleanTitle: "Guardia limpia", cleanDescription: "Los fundamentos firmes siguen siendo el ingreso más fiable.", cleanObjective: "Tras aceptar, completa un QSO con precisión mínima 85, ritmo 75 y sin repeticiones.",
    weakTitle: "Ventana débil", weakDescription: "Conserva la paciencia entre ruido y desvanecimiento.", weakObjective: "Tras aceptar, completa un QSO con propagación P0–P2.",
    regionsTitle: "Dos regiones", regionsDescription: "Escucha dos regiones distintas durante una misma guardia.", regionsObjective: "Tras aceptar, completa QSO con dos regiones diferentes.",
    distanceTitle: "Tres mil kilómetros", distanceDescription: "Aprovecha una apertura que cruce un horizonte lejano.", distanceObjective: "Tras aceptar, completa un QSO de al menos 3.000 km.",
    independentTitle: "Guardia independiente", independentDescription: "Cierra la guía y confía en tus propios oídos.", independentObjective: "Tras aceptar, completa un QSO sin guía ni ayuda visual.",
  },
  de: {
    title: "Missionszentrale", kicker: "Das unvollendete Logbuch", story: "Handlungslog", daily: "Reguläre Aufträge", chapter: "Kapitel", progress: "Fortschritt",
    available: "Verfügbar", active: "Aktiv", ready: "Belohnung bereit", locked: "Gesperrt", claimed: "Abgeschlossen",
    accept: "Mission annehmen", claim: "Belohnung abholen", abandon: "Aufgeben", close: "Zurück zum Verwaltungszentrum", money: "Geld", tp: "Technologiepunkt",
    storyProgress: "Logbuchfortschritt", dailyNote: "Täglich entstehen drei Aufträge aus deinem Stations-Seed. Zwei dürfen gleichzeitig aktiv sein; angenommene Aufträge bleiben über den Tageswechsel erhalten.",
    limit: "Alle regulären Auftragsplätze sind belegt", targetCallsign: "Prioritätsempfang", propagation: "Die Zielstation antwortet nur, wenn die aktuelle Ausbreitung sie erreicht.",
    story01Title: "Erstes Einschalten", story01Description: "Das „Ich höre dich“ eines Fremden bringt Klang in den stillen Raum zurück.", story01Objective: "Das erste QSO abschließen und speichern.",
    story02Title: "Das Rufzeichen auf Papier", story02Description: "SIM3RA ist im verblichenen Log eingekreist. Erinnert sich der Operator noch an die unvollendete Seite?", story02Objective: "Ein QSO mit SIM3RA abschließen und dabei mindestens einmal AGN K verwenden.",
    story03Title: "Verschiedene Rhythmen", story03Description: "Manche funken vorsichtig, manche schnell, andere brauchen mehr Ruhe. Höre zuerst den Unterschied.", story03Objective: "QSOs mit drei unterschiedlichen Operatorstilen abschließen.",
    cleanTitle: "Saubere Wache", cleanDescription: "Sichere Grundlagen bleiben die verlässlichste Einnahme der Station.", cleanObjective: "Nach Annahme ein QSO mit mindestens 85 Sendegenauigkeit, 75 Rhythmus und ohne Wiederholung abschließen.",
    weakTitle: "Schwaches Fenster", weakDescription: "Bewahre Geduld zwischen Rauschen und Schwund.", weakObjective: "Nach Annahme ein QSO bei Ausbreitungsstufe P0–P2 abschließen.",
    regionsTitle: "Zwei Regionen", regionsDescription: "Höre während einer Wache zwei verschiedene Regionen.", regionsObjective: "Nach Annahme QSOs mit zwei verschiedenen Regionen abschließen.",
    distanceTitle: "Dreitausend Kilometer", distanceDescription: "Nutze eine Öffnung über einen fernen Horizont.", distanceObjective: "Nach Annahme ein QSO über mindestens 3.000 km abschließen.",
    independentTitle: "Selbstständige Wache", independentDescription: "Schließe die Führung und vertraue den eigenen Ohren.", independentObjective: "Nach Annahme ein QSO ohne Führung oder visuelle Hilfe abschließen.",
  },
  ru: {
    title: "Центр заданий", kicker: "Незавершённый журнал", story: "Сюжетный журнал", daily: "Обычные поручения", chapter: "Глава", progress: "Прогресс",
    available: "Доступно", active: "Выполняется", ready: "Награда готова", locked: "Закрыто", claimed: "Завершено",
    accept: "Принять задание", claim: "Получить награду", abandon: "Отказаться", close: "Назад в Центр управления", money: "Деньги", tp: "Очко технологии",
    storyProgress: "Прогресс журнала", dailyNote: "Каждый день создаются три поручения по данным станции. Одновременно активны не более двух; принятые поручения сохраняются после смены дня.",
    limit: "Все места обычных поручений заняты", targetCallsign: "Приоритетный приём", propagation: "Целевая станция ответит, только если текущая трасса распространения её достигает.",
    story01Title: "Первое включение", story01Description: "Слова незнакомца «я вас слышу» возвращают звук в тихую комнату.", story01Objective: "Завершите и сохраните первое QSO.",
    story02Title: "Позывной на бумаге", story02Description: "SIM3RA обведён в выцветшем журнале. Помнит ли оператор незавершённую страницу?", story02Objective: "Проведите QSO с SIM3RA и хотя бы один раз используйте AGN K.",
    story03Title: "Разные ритмы", story03Description: "Кто-то осторожен, кто-то спешит, кому-то нужен медленный темп. Научитесь слышать различия.", story03Objective: "Проведите QSO с тремя разными стилями операторов.",
    cleanTitle: "Чистая вахта", cleanDescription: "Уверенная основа остаётся самым надёжным доходом станции.", cleanObjective: "После принятия проведите QSO с точностью не ниже 85, ритмом не ниже 75 и без повторов.",
    weakTitle: "Слабое окно", weakDescription: "Сохраняйте терпение среди шума и замираний.", weakObjective: "После принятия проведите QSO при уровне распространения P0–P2.",
    regionsTitle: "Два региона", regionsDescription: "Услышьте два разных региона за одну вахту.", regionsObjective: "После принятия проведите QSO с двумя разными регионами.",
    distanceTitle: "Три тысячи километров", distanceDescription: "Поймайте прохождение за далёкий горизонт.", distanceObjective: "После принятия проведите QSO на расстоянии не менее 3 000 км.",
    independentTitle: "Самостоятельная вахта", independentDescription: "Отключите подсказки и полагайтесь на собственный слух.", independentObjective: "После принятия проведите QSO без подсказок и визуальной помощи.",
  },
};

function statusText(t, status) {
  return t[status] ?? status;
}

function MissionCard({ mission, t, dailyLimitReached, onAccept, onClaim, onAbandon }) {
  const ready = mission.status === "ready";
  const active = mission.status === "active";
  const available = mission.status === "available";
  const acceptDisabled = mission.type === "daily" && dailyLimitReached;
  const percent = Math.max(0, Math.min(100, Math.round((mission.current / Math.max(1, mission.target)) * 100)));
  return (
    <article className={`mission-card mission-${mission.status}`} data-mission-id={mission.id} data-mission-status={mission.status}>
      <div className="mission-card-code">
        <span>{mission.type === "story" ? `${t.chapter} ${String(mission.chapter).padStart(2, "0")}` : mission.dayKey}</span>
        <b>{statusText(t, mission.status)}</b>
      </div>
      <div className="mission-card-title">
        {mission.status === "locked" ? <LockKey size={24} weight="fill" /> : mission.type === "story" ? <BookOpenText size={24} weight="fill" /> : <Crosshair size={24} weight="duotone" />}
        <div><h3>{t[mission.titleKey]}</h3><p>{t[mission.descriptionKey]}</p></div>
      </div>
      <div className="mission-objective"><SealCheck size={18} weight="fill" /><span>{t[mission.objectiveKey]}</span></div>
      {mission.targetCallsign && <div className="mission-target"><b>{t.targetCallsign}</b><strong>{mission.targetCallsign}</strong><small>{t.propagation}</small></div>}
      <div className="mission-progress-row">
        <span>{t.progress}</span><strong>{mission.current}/{mission.target}</strong>
        <div className="mission-progress-track"><i style={{ width: `${percent}%` }} /></div>
      </div>
      <div className="mission-reward"><Coins size={17} weight="fill" /><span>+{mission.moneyReward} {t.money}</span>{mission.technologyPointsReward > 0 && <em>+{mission.technologyPointsReward} TP</em>}</div>
      <div className="mission-actions">
        {available && <button data-action="accept-mission" data-mission-action-id={mission.id} disabled={acceptDisabled} onClick={() => onAccept(mission.id)}><Play size={17} weight="fill" />{acceptDisabled ? t.limit : t.accept}</button>}
        {active && <button className="mission-abandon" data-action="abandon-mission" data-mission-action-id={mission.id} onClick={() => onAbandon(mission.id)}><Trash size={17} />{t.abandon}</button>}
        {ready && <button className="mission-claim" data-action="claim-mission" data-mission-action-id={mission.id} onClick={() => onClaim(mission.id)}><CheckCircle size={17} weight="fill" />{t.claim}</button>}
      </div>
    </article>
  );
}

export function MissionCenterModal({ language, save, onAccept, onClaim, onAbandon, onClose }) {
  const t = TEXT[language] ?? TEXT.en;
  const [tab, setTab] = useState("story");
  const board = useMemo(() => missionBoard(save), [save]);
  const summary = useMemo(() => missionSummary(save), [save]);
  const activeDaily = board.daily.filter(({ status }) => ["active", "ready"].includes(status)).length;
  const missions = tab === "story" ? board.story : board.daily;

  useEffect(() => {
    function handleKeyDown(event) { if (event.key === "Escape") onClose(); }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <div className="modal-backdrop mission-center-backdrop" data-testid="mission-center-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="mission-center-modal" data-testid="mission-center-modal" role="dialog" aria-modal="true" aria-labelledby="mission-center-title">
        <header>
          <BookOpenText size={38} weight="fill" />
          <div><span>{t.kicker}</span><h2 id="mission-center-title">{t.title}</h2></div>
          <div className="mission-center-summary"><small>{t.storyProgress}</small><strong>{summary.storyClaimed}/{summary.storyTotal}</strong><b><Coins size={16} weight="fill" />{save.money}</b></div>
          <button className="icon-button" data-action="close-missions" onClick={onClose} aria-label={t.close}><X size={22} weight="bold" /></button>
        </header>
        <nav className="mission-center-tabs" aria-label={t.title}>
          <button className={tab === "story" ? "selected" : ""} data-mission-tab="story" onClick={() => setTab("story")}><BookOpenText size={20} weight="fill" />{t.story}</button>
          <button className={tab === "daily" ? "selected" : ""} data-mission-tab="daily" onClick={() => setTab("daily")}><CalendarDots size={20} weight="fill" />{t.daily}<span>{activeDaily}/{MAX_ACTIVE_DAILY_MISSIONS}</span></button>
        </nav>
        <div className="mission-center-body">
          {tab === "daily" && <p className="mission-daily-note">{t.dailyNote}</p>}
          <div className="mission-list">
            {missions.map((mission) => <MissionCard key={mission.id} mission={mission} t={t} dailyLimitReached={activeDaily >= MAX_ACTIVE_DAILY_MISSIONS} onAccept={onAccept} onClaim={onClaim} onAbandon={onAbandon} />)}
          </div>
        </div>
        <footer><span>{save.callsign} // {summary.ready} {t.ready}</span><button data-action="close-missions-footer" onClick={onClose}><ArrowLeft size={19} weight="bold" />{t.close}</button></footer>
      </section>
    </div>
  );
}
