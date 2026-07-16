import {
  ArrowClockwise, Broadcast, CheckCircle, FloppyDisk, Gauge, MapPin, Radio,
  Ruler, ShieldCheck, WarningCircle, X,
} from "@phosphor-icons/react";

const TEXT = {
  "zh-CN": {
    success: "通联完成", failed: "通联未完成", saved: "已写入永久日志", unsaved: "等待写入日志",
    callsign: "对方呼号", region: "地区", distance: "距离", rst: "双方 RST", propagation: "传播等级",
    equipment: "设备快照", speed: "检测速度", accuracy: "抄收正确率", rhythm: "发报节奏",
    credits: "本次信用点", sim: "虚构台站", newRegion: "首次通联地区", newDistance: "最远距离纪录",
    save: "写入日志并结算", next: "开始下一次通联", restart: "重新开始本次通联", continue: "返回发射台",
    failedHint: "本次回应未通过最小 QSO 流程判定，不会扣除信用点，也不会写入日志。",
  },
  "zh-TW": {
    success: "通聯完成", failed: "通聯未完成", saved: "已寫入永久日誌", unsaved: "等待寫入日誌",
    callsign: "對方呼號", region: "地區", distance: "距離", rst: "雙方 RST", propagation: "傳播等級",
    equipment: "設備快照", speed: "偵測速度", accuracy: "抄收正確率", rhythm: "發報節奏",
    credits: "本次信用點", sim: "虛構臺站", newRegion: "首次通聯地區", newDistance: "最遠距離紀錄",
    save: "寫入日誌並結算", next: "開始下一次通聯", restart: "重新開始本次通聯", continue: "返回發射臺",
    failedHint: "本次回應未通過最小 QSO 流程判定，不會扣除信用點，也不會寫入日誌。",
  },
  ja: {
    success: "交信完了", failed: "交信未完了", saved: "永久ログに保存済み", unsaved: "ログ保存待ち",
    callsign: "相手局", region: "地域", distance: "距離", rst: "双方の RST", propagation: "伝搬レベル",
    equipment: "装備スナップショット", speed: "検出速度", accuracy: "受信正確率", rhythm: "送信リズム",
    credits: "今回のクレジット", sim: "架空局", newRegion: "初交信地域", newDistance: "最長距離記録",
    save: "ログ保存と精算", next: "次の交信を開始", restart: "この交信をやり直す", continue: "運用卓へ戻る",
    failedHint: "最小 QSO 手順を完了できませんでした。クレジット消費やログ記録はありません。",
  },
  en: {
    success: "QSO Complete", failed: "QSO Incomplete", saved: "Saved to permanent log", unsaved: "Waiting to be logged",
    callsign: "Remote callsign", region: "Region", distance: "Distance", rst: "RST exchanged", propagation: "Propagation level",
    equipment: "Equipment snapshot", speed: "Detected speed", accuracy: "Copy accuracy", rhythm: "Keying rhythm",
    credits: "Credits earned", sim: "Fictional station", newRegion: "First contact in region", newDistance: "New distance record",
    save: "Save log and settle", next: "Start next QSO", restart: "Restart this QSO", continue: "Return to station",
    failedHint: "The reply did not complete the minimum QSO flow. No credits are deducted and no log entry is written.",
  },
};

function value(value, suffix = "") {
  return value === null || value === undefined || value === "" ? "---" : `${value}${suffix}`;
}

export function QsoResultModal({
  language, failed = false, entry = null, creditsAwarded = 0, saved = false,
  newRegion = false, newDistanceRecord = false, onSave, onRestart, onNext, onClose,
}) {
  const t = TEXT[language] ?? TEXT.en;
  return (
    <div className="qso-result-backdrop">
      <section className={`qso-result-modal ${failed ? "failed" : "success"}`} role="dialog" aria-modal="true" aria-labelledby="qso-result-title">
        <header>
          {failed ? <WarningCircle size={34} weight="fill" /> : <CheckCircle size={34} weight="fill" />}
          <div><small>{failed ? "QSO // FAILED" : "QSO // COMPLETE"}</small><h2 id="qso-result-title">{failed ? t.failed : t.success}</h2></div>
          {saved && <button className="icon-button" onClick={onClose} aria-label={t.continue}><X size={21} /></button>}
        </header>

        {failed ? (
          <div className="qso-result-failure">
            <WarningCircle size={76} weight="duotone" />
            <p>{t.failedHint}</p>
          </div>
        ) : (
          <div className="qso-result-body">
            <div className="qso-result-identity">
              <span><Radio size={19} weight="fill" />{t.callsign}</span>
              <strong>{entry?.callsign ?? "---"}</strong>
              <b>SIM // {t.sim}</b>
            </div>
            <dl className="qso-result-stats">
              <div><dt><MapPin size={18} />{t.region}</dt><dd>{value(entry?.location)}</dd></div>
              <div><dt><Ruler size={18} />{t.distance}</dt><dd>{value(entry?.distanceKm, " km")}</dd></div>
              <div><dt><ShieldCheck size={18} />{t.rst}</dt><dd>{value(entry?.sent)} / {value(entry?.received)}</dd></div>
              <div><dt><Broadcast size={18} />{t.propagation}</dt><dd>P{value(entry?.finalPropagationLevel)}</dd></div>
              <div><dt><Radio size={18} />{t.equipment}</dt><dd>{value(entry?.equipmentId)} / {value(entry?.antennaId)}</dd></div>
              <div><dt><Gauge size={18} />{t.speed}</dt><dd>{value(entry?.wpm, " WPM")}</dd></div>
              <div><dt>{t.accuracy}</dt><dd>{value(entry?.copyAccuracy, "%")}</dd></div>
              <div><dt>{t.rhythm}</dt><dd>{value(entry?.keyingScore, "%")}</dd></div>
            </dl>
            <div className="qso-result-rewards">
              <span>{saved ? t.saved : t.unsaved}</span>
              <strong>+{creditsAwarded} <small>{t.credits}</small></strong>
              <div>{newRegion && <b>{t.newRegion}</b>}{newDistanceRecord && <b>{t.newDistance}</b>}</div>
            </div>
          </div>
        )}

        <footer>
          {failed ? (
            <button className="qso-result-primary" onClick={onRestart}><ArrowClockwise size={21} weight="bold" />{t.restart}</button>
          ) : !saved ? (
            <button className="qso-result-primary" onClick={onSave}><FloppyDisk size={21} weight="fill" />{t.save}</button>
          ) : (
            <><button className="qso-result-primary" onClick={onNext}><Radio size={21} weight="fill" />{t.next}</button><button onClick={onClose}>{t.continue}</button></>
          )}
        </footer>
      </section>
    </div>
  );
}
