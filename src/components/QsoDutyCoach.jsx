import { useEffect, useRef, useState } from "react";
import {
  Broadcast, CaretDown, CaretUp, Check, ClipboardText, Headphones, Question, WarningCircle, X,
} from "@phosphor-icons/react";

export const QSO_GUIDANCE_LEVELS = Object.freeze(["full", "hints", "off"]);

export function normalizeQsoGuidance(value) {
  return QSO_GUIDANCE_LEVELS.includes(value) ? value : "full";
}

const TEXT = {
  "zh-CN": {
    briefingKicker: "FIRST WATCH // 值守简报", briefingTitle: "完成你的第一次通联",
    briefingBody: "接收机进入发射台后会自动守听。请先发出完整 CQ，抄收远方台呼号，再交换 RST 与 73，最后保存日志。",
    privacy: "盲听阶段不会在界面上提前显示远方台呼号。听不清时发送 AGN K 请求重发。",
    guidance: "值守引导", full: "完整引导", fullHint: "显示当前阶段、标准模板与具体错误。", hints: "仅提示", hintsHint: "只显示必要电文顺序。", off: "关闭", offHint: "隐藏任务卡，保留原始台站操作。",
    begin: "开始值守", skip: "跳过引导", close: "关闭值守简报",
    duty: "当前任务", step: "步骤", collapse: "收起任务卡", expand: "展开任务卡",
    preflight: "台站检查", power: "开启电台后开始守听。", antenna: "请先在仓库装备天线。",
    cqTitle: "发送完整 CQ", cqBody: "按电键输入呼叫，完成后按 F2。", cqHint: "CQ → DE → 本台呼号 → K",
    listenTitle: "守听远方回应", listenBody: "请勿发射；接收机正在自动播放回应。", listenHint: "RX → 抄收远方台呼号",
    replyTitle: "交换报告并结束", replyBody: "REMOTE 表示你从声音中抄收的远方台呼号，不要发送单词 REMOTE。听不清可发送 AGN K。", replyHint: "远方台呼号 → DE → 本台呼号 → RST → 559 → 73 → K",
    logTitle: "保存通联日志", logBody: "通联已完成。按 F3 保存日志并结算信用点。", logHint: "F3 → 日志 → 信用点",
    failedTitle: "重新开始本次通联", failedBody: "本次交换未完成。按 F3 重新开始。", complete: "第一次值守已完成",
    remote: "REMOTE", repeat: "请求重发：AGN K", clearRetry: "清空并重试", attempts: "尝试次数",
    errors: { missingCq: "缺少 CQ。", missingDe: "缺少 DE。", missingPlayerCallsign: "缺少你的呼号。", wrongCqOrder: "顺序应为 CQ、DE、本台呼号、K。", wrongReplyOrder: "顺序应为：远方台呼号、DE、本台呼号、RST、报告、73、K。", missingK: "结尾缺少 K。", missingCallsign: "必须包含双方呼号。", invalidRst: "RST 必须是三位有效报告，例如 559。", missing73: "结束电文缺少 73。", invalidAgn: "请求重发请发送 AGN K。" },
  },
  "zh-TW": {
    briefingKicker: "FIRST WATCH // 值守簡報", briefingTitle: "完成你的第一次通聯",
    briefingBody: "接收機進入發射臺後會自動守聽。請先發出完整 CQ，抄收遠方臺呼號，再交換 RST 與 73，最後儲存日誌。",
    privacy: "盲聽階段不會在介面上提前顯示遠方臺呼號。聽不清時發送 AGN K 請求重發。",
    guidance: "值守引導", full: "完整引導", fullHint: "顯示目前階段、標準範本與具體錯誤。", hints: "僅提示", hintsHint: "只顯示必要電文順序。", off: "關閉", offHint: "隱藏任務卡，保留原始臺站操作。",
    begin: "開始值守", skip: "略過引導", close: "關閉值守簡報",
    duty: "目前任務", step: "步驟", collapse: "收起任務卡", expand: "展開任務卡",
    preflight: "臺站檢查", power: "開啟電臺後開始守聽。", antenna: "請先在倉庫裝備天線。",
    cqTitle: "發送完整 CQ", cqBody: "按電鍵輸入呼叫，完成後按 F2。", cqHint: "CQ → DE → 本臺呼號 → K",
    listenTitle: "守聽遠方回應", listenBody: "請勿發射；接收機正在自動播放回應。", listenHint: "RX → 抄收遠方臺呼號",
    replyTitle: "交換報告並結束", replyBody: "REMOTE 代表你從聲音中抄收的遠方臺呼號，不要發送單字 REMOTE。聽不清可發送 AGN K。", replyHint: "遠方臺呼號 → DE → 本臺呼號 → RST → 559 → 73 → K",
    logTitle: "儲存通聯日誌", logBody: "通聯已完成。按 F3 儲存日誌並結算信用點。", logHint: "F3 → 日誌 → 信用點",
    failedTitle: "重新開始本次通聯", failedBody: "本次交換未完成。按 F3 重新開始。", complete: "第一次值守已完成",
    remote: "REMOTE", repeat: "請求重發：AGN K", clearRetry: "清空並重試", attempts: "嘗試次數",
    errors: { missingCq: "缺少 CQ。", missingDe: "缺少 DE。", missingPlayerCallsign: "缺少你的呼號。", wrongCqOrder: "順序應為 CQ、DE、本臺呼號、K。", wrongReplyOrder: "順序應為：遠方臺呼號、DE、本臺呼號、RST、報告、73、K。", missingK: "結尾缺少 K。", missingCallsign: "必須包含雙方呼號。", invalidRst: "RST 必須是三位有效報告，例如 559。", missing73: "結束電文缺少 73。", invalidAgn: "請以 AGN K 請求重發。" },
  },
  ja: {
    briefingKicker: "FIRST WATCH // 運用ブリーフィング", briefingTitle: "最初の交信を完了する",
    briefingBody: "交信卓へ入ると受信機は自動的にワッチを始めます。完全な CQ を送り、相手局のコールを聞き取り、RST と 73 を交換してログを保存します。",
    privacy: "ブラインド受信中は相手局のコールを画面に先出ししません。聞き取れない場合は AGN K で再送を依頼できます。",
    guidance: "運用ガイド", full: "フルガイド", fullHint: "現在の段階、標準例、詳しいエラーを表示。", hints: "ヒントのみ", hintsHint: "必要な電文の順番だけを表示。", off: "オフ", offHint: "任務カードを非表示にして通常運用。",
    begin: "運用開始", skip: "ガイドを省略", close: "ブリーフィングを閉じる",
    duty: "現在の任務", step: "ステップ", collapse: "任務カードを閉じる", expand: "任務カードを開く",
    preflight: "局内チェック", power: "無線機の電源を入れてワッチを開始。", antenna: "倉庫でアンテナを装備してください。",
    cqTitle: "完全な CQ を送信", cqBody: "電鍵で呼出しを入力し、完了後 F2。", cqHint: "CQ → DE → 自局コール → K",
    listenTitle: "相手局をワッチ", listenBody: "送信せず、受信機が自動再生する応答を聞き取ります。", listenHint: "RX → 相手局コールをコピー",
    replyTitle: "レポートを交換して終了", replyBody: "REMOTE は音からコピーした相手局コールの代用表示です。REMOTE という語は送信しません。聞き取れなければ AGN K。", replyHint: "相手局コール → DE → 自局コール → RST → 559 → 73 → K",
    logTitle: "交信ログを保存", logBody: "交信完了。F3 でログを保存しクレジットを精算します。", logHint: "F3 → ログ → クレジット",
    failedTitle: "交信を再開", failedBody: "交換を完了できませんでした。F3 で再開します。", complete: "最初の運用を完了",
    remote: "REMOTE", repeat: "再送要求：AGN K", clearRetry: "消去して再試行", attempts: "試行回数",
    errors: { missingCq: "CQ がありません。", missingDe: "DE がありません。", missingPlayerCallsign: "自局コールがありません。", wrongCqOrder: "CQ、DE、自局コール、K の順に送信します。", wrongReplyOrder: "相手局コール、DE、自局コール、RST、レポート、73、K の順に送信します。", missingK: "末尾に K が必要です。", missingCallsign: "両局のコールが必要です。", invalidRst: "RST は 559 など有効な3桁で送信します。", missing73: "終了電文に 73 がありません。", invalidAgn: "再送要求は AGN K で送信します。" },
  },
  en: {
    briefingKicker: "FIRST WATCH // DUTY BRIEFING", briefingTitle: "Complete your first contact",
    briefingBody: "The receiver opens automatically when you enter the station. Send a complete CQ, copy the remote callsign, exchange RST and 73, then save the log.",
    privacy: "The remote callsign is never shown early during blind copy. Send AGN K if you need the station to repeat.",
    guidance: "Duty guidance", full: "Full guidance", fullHint: "Show the current stage, exact pattern, and specific errors.", hints: "Hints only", hintsHint: "Show only the required message order.", off: "Off", offHint: "Hide the duty card and operate without assistance.",
    begin: "Begin watch", skip: "Skip guidance", close: "Close duty briefing",
    duty: "Current duty", step: "Step", collapse: "Collapse duty card", expand: "Expand duty card",
    preflight: "Station check", power: "Power on the radio to begin listening.", antenna: "Equip an antenna in the warehouse first.",
    cqTitle: "Send a complete CQ", cqBody: "Key the call, then press F2 when complete.", cqHint: "CQ → DE → YOUR CALL → K",
    listenTitle: "Listen for a remote reply", listenBody: "Do not transmit; the receiver is playing the response automatically.", listenHint: "RX → COPY REMOTE CALL",
    replyTitle: "Exchange reports and close", replyBody: "REMOTE stands for the callsign you copied by ear; do not transmit the word REMOTE. Send AGN K if you need a repeat.", replyHint: "REMOTE CALL → DE → YOUR CALL → RST → 559 → 73 → K",
    logTitle: "Save the QSO log", logBody: "The contact is complete. Press F3 to save the log and settle credits.", logHint: "F3 → LOG → CREDITS",
    failedTitle: "Restart this contact", failedBody: "The exchange was not completed. Press F3 to restart.", complete: "First watch complete",
    remote: "REMOTE", repeat: "Request repeat: AGN K", clearRetry: "Clear & retry", attempts: "Attempts",
    errors: { missingCq: "CQ is missing.", missingDe: "DE is missing.", missingPlayerCallsign: "Your callsign is missing.", wrongCqOrder: "Send CQ, DE, your callsign, then K.", wrongReplyOrder: "Send the remote call, DE, your call, RST, report, 73, then K.", missingK: "The message must end with K.", missingCallsign: "Both callsigns are required.", invalidRst: "RST must be a valid three-digit report such as 559.", missing73: "73 is missing from the closing message.", invalidAgn: "Use AGN K to request a repeat." },
  },
};

export function qsoCoachText(language) {
  return TEXT[language] ?? TEXT.en;
}

export function qsoErrorMessage(language, reason) {
  return qsoCoachText(language).errors[reason] ?? "";
}

function GuidanceChoices({ language, value, onChange }) {
  const t = qsoCoachText(language);
  return <div className="qso-guidance-choices" role="radiogroup" aria-label={t.guidance}>
    {QSO_GUIDANCE_LEVELS.map((level) => <button key={level} type="button" role="radio" aria-checked={value === level} className={value === level ? "selected" : ""} onClick={() => onChange(level)}>
      <span>{value === level && <Check size={16} weight="bold" />}</span><strong>{t[level]}</strong><small>{t[`${level}Hint`]}</small>
    </button>)}
  </div>;
}

export function QsoBriefingModal({ language, guidance, onStart, onSkip, onClose }) {
  const t = qsoCoachText(language);
  const [selected, setSelected] = useState(() => normalizeQsoGuidance(guidance));
  const dialogRef = useRef(null);
  const onCloseRef = useRef(onClose);
  useEffect(() => { onCloseRef.current = onClose; }, [onClose]);
  useEffect(() => {
    dialogRef.current?.focus();
    function handleKeyDown(event) {
      if (event.key !== "Escape") return;
      event.preventDefault();
      onCloseRef.current?.();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);
  return <div className="modal-backdrop qso-briefing-backdrop" data-testid="qso-briefing-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose?.()}>
    <section ref={dialogRef} tabIndex={-1} className="qso-briefing-modal" data-testid="qso-briefing-modal" role="dialog" aria-modal="true" aria-labelledby="qso-briefing-title">
      <header><div><span>{t.briefingKicker}</span><h2 id="qso-briefing-title"><ClipboardText size={25} weight="fill" />{t.briefingTitle}</h2></div><button className="icon-button" onClick={onClose} aria-label={t.close}><X size={21} weight="bold" /></button></header>
      <div className="qso-briefing-body"><div className="qso-briefing-copy"><Broadcast size={48} weight="duotone" /><p>{t.briefingBody}</p><aside><Headphones size={21} />{t.privacy}</aside></div><div><h3>{t.guidance}</h3><GuidanceChoices language={language} value={selected} onChange={setSelected} /></div></div>
      <footer><button className="qso-briefing-skip" onClick={onSkip}>{t.skip}</button><button className="primary-button" data-action="start-guided-watch" onClick={() => onStart(selected)}><Check size={19} weight="bold" />{t.begin}</button></footer>
    </section>
  </div>;
}

function coachState(qso, powered, antennaReady, saved, t) {
  if (!antennaReady) return { step: 0, title: t.preflight, body: t.antenna, hint: "ANTENNA → READY" };
  if (!powered) return { step: 0, title: t.preflight, body: t.power, hint: "POWER → ON" };
  if (qso.phase === "PLAYER_CQ") return { step: 1, title: t.cqTitle, body: t.cqBody, hint: t.cqHint };
  if (["WAITING_RESPONSE", "NPC_REPLY"].includes(qso.phase)) return { step: 2, title: t.listenTitle, body: t.listenBody, hint: t.listenHint };
  if (["PLAYER_RST_AND_73", "NPC_73_AND_SK"].includes(qso.phase)) return { step: 3, title: t.replyTitle, body: t.replyBody, hint: t.replyHint };
  if (qso.phase === "QSO_FAILED") return { step: 4, title: t.failedTitle, body: t.failedBody, hint: "F3 → RESTART" };
  return { step: 4, title: saved ? t.complete : t.logTitle, body: t.logBody, hint: t.logHint };
}

export function QsoDutyCoach({ language, guidance, qso, playerCallsign, powered, antennaReady, saved, onClearRetry }) {
  const level = normalizeQsoGuidance(guidance);
  const [expanded, setExpanded] = useState(true);
  if (level === "off") return null;
  const t = qsoCoachText(language);
  const state = coachState(qso, powered, antennaReady, saved, t);
  const revealedCall = qso.contactRevealed ? qso.npc.callsign : t.remote;
  const template = state.step === 1 ? `CQ CQ DE ${playerCallsign} ${playerCallsign} K`
    : state.step === 3 && qso.phase === "PLAYER_RST_AND_73" ? `${revealedCall} DE ${playerCallsign} RST 559 73 K`
      : null;
  const error = level === "full" && qso.lastError && qso.lastError !== "noResponse" ? qsoErrorMessage(language, qso.lastError) : "";
  const attempts = Math.max(0, Number(qso.attempts || 0));
  return <section className={`qso-duty-coach ${expanded ? "expanded" : "collapsed"} ${error ? "has-error" : ""}`} data-testid="qso-duty-coach" data-guidance={level} data-duty-step={state.step}>
    <button className="qso-duty-toggle" type="button" onClick={() => setExpanded((current) => !current)} aria-expanded={expanded} aria-label={expanded ? t.collapse : t.expand}>
      <span>{state.step ? `${t.step} ${state.step}/4` : "CHECK"}</span><strong>{state.title}</strong>{expanded ? <CaretDown size={16} /> : <CaretUp size={16} />}
    </button>
    {expanded && <div className="qso-duty-popover" aria-live="polite">
      <div>{level === "full" && <p>{state.body}</p>}{level === "full" && template ? <code data-testid="qso-duty-template">{template}</code> : <code>{state.hint}</code>}{state.step === 3 && !qso.contactRevealed && <small><Question size={14} />{t.repeat}</small>}</div>
      {error && <aside role="alert"><WarningCircle size={19} weight="fill" /><span>{error}<small>{t.attempts}: {attempts}</small></span><button type="button" data-action="clear-and-retry" onClick={onClearRetry}>{t.clearRetry}</button></aside>}
    </div>}
  </section>;
}

export { GuidanceChoices };
