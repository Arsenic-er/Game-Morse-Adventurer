import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft, ArrowRight, Broadcast, Check, Ear, Eye, EyeSlash,
  GearSix, Keyboard, Lightning, Play, Radio, SpeakerHigh, X,
} from "@phosphor-icons/react";
import { encodeTextToEvents } from "../cw/morse.js";
import { useCwCore } from "../cw/useCwCore.js";
import {
  PRACTICE_MODES, completePracticeSession, createPracticeSession, currentPracticeQuestion,
  evaluateReception, evaluateSending, isReceptionMode, isSendingMode, normalizePracticeStats,
  settlePracticeQuestion, summarizePracticeSession,
} from "./practiceEngine.js";

const ASSETS = {
  room: "./assets/radio-room-bg.png",
  manual: "./assets/manual-key.png",
  automatic: "./assets/automatic-key.png",
};

const TEXT = {
  "zh-CN": {
    title: "CW 练习台", back: "返回开始界面", settings: "设置", independent: "独立训练环境 · 不受传播影响",
    characterRx: "字符接收", callsignRx: "呼号接收", manualTx: "手键练习", paddleTx: "双桨练习",
    listen: "播放题目", answer: "输入抄收到的内容", submit: "提交成绩", next: "下一题", replay: "回放输入",
    visualOn: "关闭视觉辅助", visualOff: "开启视觉辅助", target: "训练目标", decoded: "当前解码",
    fixedSpeed: "系统速度", detectedSpeed: "识别速度", automaticSpeed: "自动键速度", correct: "正确", wrong: "不正确", waiting: "等待输入",
    attempts: "题数", correctCount: "正确题数", accuracy: "正确率", rhythm: "平均节奏", weak: "薄弱字符", noWeak: "暂无",
    manualHint: "按住空格键发报", paddleHint: "Z 点桨 / X 划桨", sim: "所有呼号均为程序生成的 SIM 虚构台站",
    session: "本次训练", lifetime: "累计记录", recordingTo: "成绩记录至", sessionOnly: "仅本次训练 · 选择存档后可保存成绩",
    endSession: "结束训练", summaryTitle: "训练总结", summarySubtitle: "本次练习已经结算", continueTraining: "继续训练", leavePractice: "返回开始界面",
  },
  "zh-TW": {
    title: "CW 練習臺", back: "返回開始介面", settings: "設定", independent: "獨立訓練環境 · 不受傳播影響",
    characterRx: "字元接收", callsignRx: "呼號接收", manualTx: "手鍵練習", paddleTx: "雙槳練習",
    listen: "播放題目", answer: "輸入抄收到的內容", submit: "提交成績", next: "下一題", replay: "重播輸入",
    visualOn: "關閉視覺輔助", visualOff: "開啟視覺輔助", target: "訓練目標", decoded: "目前解碼",
    fixedSpeed: "系統速度", detectedSpeed: "識別速度", automaticSpeed: "自動鍵速度", correct: "正確", wrong: "不正確", waiting: "等待輸入",
    attempts: "題數", correctCount: "正確題數", accuracy: "正確率", rhythm: "平均節奏", weak: "薄弱字元", noWeak: "暫無",
    manualHint: "按住空白鍵發報", paddleHint: "Z 點槳 / X 劃槳", sim: "所有呼號均為程式生成的 SIM 虛構臺站",
    session: "本次訓練", lifetime: "累計記錄", recordingTo: "成績儲存至", sessionOnly: "僅限本次訓練 · 選擇存檔後可儲存成績",
    endSession: "結束訓練", summaryTitle: "訓練總結", summarySubtitle: "本次練習已完成結算", continueTraining: "繼續訓練", leavePractice: "返回開始介面",
  },
  ja: {
    title: "CW 練習台", back: "開始画面へ戻る", settings: "設定", independent: "独立した練習環境・伝搬の影響なし",
    characterRx: "文字受信", callsignRx: "コール受信", manualTx: "縦振り練習", paddleTx: "パドル練習",
    listen: "課題を再生", answer: "受信内容を入力", submit: "採点", next: "次の課題", replay: "入力を再生",
    visualOn: "視覚補助を閉じる", visualOff: "視覚補助を開く", target: "練習目標", decoded: "現在の復号",
    fixedSpeed: "システム速度", detectedSpeed: "認識速度", automaticSpeed: "オートキー速度", correct: "正解", wrong: "不正解", waiting: "入力待ち",
    attempts: "課題数", correctCount: "正解数", accuracy: "正解率", rhythm: "平均リズム", weak: "苦手文字", noWeak: "なし",
    manualHint: "スペースを押して送信", paddleHint: "Z 短点 / X 長点", sim: "すべてのコールはプログラム生成の架空 SIM 局です",
    session: "今回の練習", lifetime: "通算記録", recordingTo: "記録先", sessionOnly: "このセッションのみ・セーブを選ぶと記録できます",
    endSession: "練習を終了", summaryTitle: "練習結果", summarySubtitle: "今回の練習を集計しました", continueTraining: "練習を続ける", leavePractice: "開始画面へ戻る",
  },
  en: {
    title: "CW Practice", back: "Back to title", settings: "Settings", independent: "Independent training · propagation disabled",
    characterRx: "Character RX", callsignRx: "Callsign RX", manualTx: "Straight key", paddleTx: "Paddle key",
    listen: "Play prompt", answer: "Type what you copied", submit: "Score attempt", next: "Next prompt", replay: "Replay input",
    visualOn: "Hide visual aid", visualOff: "Show visual aid", target: "Target", decoded: "Decoded",
    fixedSpeed: "System speed", detectedSpeed: "Detected speed", automaticSpeed: "Automatic key speed", correct: "Correct", wrong: "Not correct", waiting: "Waiting for input",
    attempts: "Attempts", correctCount: "Correct", accuracy: "Accuracy", rhythm: "Avg rhythm", weak: "Weak characters", noWeak: "None",
    manualHint: "Hold Space to key", paddleHint: "Z dot / X dash", sim: "All callsigns are program-generated fictional SIM stations",
    session: "This session", lifetime: "Lifetime record", recordingTo: "Recording to", sessionOnly: "Session only · select a save to keep results",
    endSession: "End session", summaryTitle: "Session summary", summarySubtitle: "This practice session has been scored", continueTraining: "Keep training", leavePractice: "Back to title",
  },
};

const MODE_ICONS = {
  [PRACTICE_MODES.CHARACTER_RX]: Ear,
  [PRACTICE_MODES.CALLSIGN_RX]: Radio,
  [PRACTICE_MODES.MANUAL_TX]: Lightning,
  [PRACTICE_MODES.PADDLE_TX]: Keyboard,
};

function IconButton({ label, children, ...props }) {
  return <button className="icon-button" aria-label={label} title={label} {...props}>{children}</button>;
}

function recordForMode(persistentStats, mode) {
  const source = persistentStats?.modes?.[mode] ?? persistentStats?.[mode] ?? null;
  const stats = normalizePracticeStats(source?.stats ?? source);
  const recentTargets = Array.isArray(source?.recentTargets) ? source.recentTargets : [];
  return { stats, recentTargets };
}

function weaknessDelta(current = {}, baseline = {}) {
  return Object.fromEntries(Object.entries(current)
    .map(([character, count]) => [character, Math.max(0, Number(count) - Number(baseline[character] ?? 0))])
    .filter(([, count]) => count > 0));
}

function sessionSummary(session, baselineWeaknesses) {
  const summary = summarizePracticeSession(session);
  const weaknesses = weaknessDelta(summary.weaknesses, baselineWeaknesses);
  return {
    ...summary,
    weaknesses,
    weakCharacters: Object.entries(weaknesses)
      .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
      .map(([character, misses]) => ({ character, misses })),
  };
}

function createSessionRun(mode, persistentStats, overrides = {}) {
  const record = recordForMode(persistentStats, mode);
  const weaknesses = overrides.weaknesses ?? record.stats.weaknesses;
  const recentTargets = overrides.recentTargets ?? record.recentTargets;
  const startedAt = new Date().toISOString();
  return {
    baselineWeaknesses: { ...weaknesses },
    session: createPracticeSession({
      mode,
      startedAt,
      seed: `${mode}:${startedAt}:${Math.random().toString(36).slice(2, 10)}`,
      weaknesses,
      recentTargets,
    }),
  };
}

export function PracticeScreen({
  language,
  automaticKeyWpm = 18,
  persistentStats = null,
  recordingCallsign = "",
  onRecordAttempt,
  onSessionComplete,
  onBack,
  onSettings,
  inputBlocked = false,
}) {
  const t = TEXT[language] ?? TEXT.en;
  const [run, setRun] = useState(() => createSessionRun(PRACTICE_MODES.CHARACTER_RX, persistentStats));
  const [answer, setAnswer] = useState("");
  const [visualAid, setVisualAid] = useState(false);
  const [result, setResult] = useState(null);
  const [summaryState, setSummaryState] = useState(null);
  const notifiedQuestionIdsRef = useRef(new Set());
  const session = run.session;
  const mode = session.mode;
  const question = useMemo(() => currentPracticeQuestion(session), [session]);
  const displayedQuestion = result?.question ?? question;
  const target = displayedQuestion?.target ?? "";
  const sessionStats = session.stats;
  const lifetimeRecord = useMemo(() => recordForMode(persistentStats, mode), [mode, persistentStats]);
  const lifetimeStats = lifetimeRecord.stats;
  const sessionWeaknesses = weaknessDelta(sessionStats.weaknesses, run.baselineWeaknesses);
  const sessionWeakEntries = Object.entries(sessionWeaknesses).sort((left, right) => right[1] - left[1]).slice(0, 5);
  const lifetimeWeakEntries = Object.entries(lifetimeStats.weaknesses).sort((left, right) => right[1] - left[1]).slice(0, 5);
  const cw = useCwCore({ targetText: target, automaticWpm: automaticKeyWpm });
  const receiving = isReceptionMode(mode);
  const sending = isSendingMode(mode);
  const manual = mode === PRACTICE_MODES.MANUAL_TX;
  const receiveWpm = mode === PRACTICE_MODES.CHARACTER_RX ? 14 : 16;
  const morse = useMemo(() => encodeTextToEvents(target, { wpm: receiveWpm }).morse, [receiveWpm, target]);
  const resultState = result ? (result.correct ? "correct" : "wrong") : "waiting";

  useEffect(() => {
    cw.clearInput();
    setAnswer("");
  }, [cw.clearInput, displayedQuestion?.id]);

  useEffect(() => {
    if (!sending) return undefined;
    function onDown(event) {
      if (inputBlocked || result || session.completedAt || event.repeat) return;
      if (["Space", "KeyZ", "KeyX"].includes(event.code)) event.preventDefault();
      if (manual && event.code === "Space") cw.beginManual();
      if (!manual && event.code === "KeyZ") cw.beginAutomatic(".");
      if (!manual && event.code === "KeyX") cw.beginAutomatic("-");
    }
    function onUp(event) {
      if (manual && event.code === "Space") {
        event.preventDefault();
        cw.endManual();
      }
      if (!manual && event.code === "KeyZ") {
        event.preventDefault();
        cw.endAutomatic(".");
      }
      if (!manual && event.code === "KeyX") {
        event.preventDefault();
        cw.endAutomatic("-");
      }
    }
    function onBlur() { cw.stopAll(); }
    window.addEventListener("keydown", onDown);
    window.addEventListener("keyup", onUp);
    window.addEventListener("blur", onBlur);
    return () => {
      window.removeEventListener("keydown", onDown);
      window.removeEventListener("keyup", onUp);
      window.removeEventListener("blur", onBlur);
      cw.stopAll();
    };
  }, [cw.beginAutomatic, cw.beginManual, cw.endAutomatic, cw.endManual, cw.stopAll, inputBlocked, manual, result, sending, session.completedAt]);

  function completedPayload(sourceSession, reason) {
    const completed = completePracticeSession(sourceSession);
    return {
      mode: completed.mode,
      reason,
      session: completed,
      summary: sessionSummary(completed, run.baselineWeaknesses),
      recentTargets: completed.recentTargets,
    };
  }

  function notifyCompletion(sourceSession, reason) {
    if (!sourceSession.completedAt && sourceSession.stats.attempts > 0) {
      onSessionComplete?.(completedPayload(sourceSession, reason).summary);
    }
  }

  function changeMode(nextMode) {
    if (nextMode === mode) return;
    cw.stopAll();
    notifyCompletion(session, "mode-change");
    setRun(createSessionRun(nextMode, persistentStats));
    notifiedQuestionIdsRef.current = new Set();
    setResult(null);
    setAnswer("");
    setSummaryState(null);
  }

  function scoreAttempt() {
    if (!question || result || session.completedAt || notifiedQuestionIdsRef.current.has(question.id)) return;
    notifiedQuestionIdsRef.current.add(question.id);
    const nextResult = receiving ? evaluateReception(answer, question.target) : evaluateSending(cw.analysis, question.target);
    const nextSession = settlePracticeQuestion(session, question.id, nextResult);
    if (nextSession.questionIndex === session.questionIndex) {
      notifiedQuestionIdsRef.current.delete(question.id);
      return;
    }
    const scoredResult = { ...nextResult, question };
    setRun((current) => ({ ...current, session: nextSession }));
    setResult(scoredResult);
    onRecordAttempt?.(mode, {
      ...nextResult,
      question,
      questionId: question.id,
      target: question.target,
      recentTargets: nextSession.recentTargets,
    });
  }

  function nextPrompt() {
    if (!result || session.completedAt) return;
    setResult(null);
  }

  function endSession() {
    cw.stopAll();
    const completed = completePracticeSession(session);
    const payload = {
      mode,
      reason: "ended",
      session: completed,
      summary: sessionSummary(completed, run.baselineWeaknesses),
      recentTargets: completed.recentTargets,
    };
    setRun((current) => ({ ...current, session: completed }));
    setSummaryState(payload);
    if (!session.completedAt) onSessionComplete?.(payload.summary);
  }

  function continueTraining() {
    const latestWeaknesses = { ...session.stats.weaknesses };
    setRun(createSessionRun(mode, persistentStats, {
      weaknesses: latestWeaknesses,
      recentTargets: session.recentTargets,
    }));
    notifiedQuestionIdsRef.current = new Set();
    setResult(null);
    setSummaryState(null);
  }

  function leavePractice() {
    cw.stopAll();
    notifyCompletion(session, "back");
    onBack();
  }

  function pointerDown(event) {
    if (result || session.completedAt) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    if (manual) {
      cw.beginManual();
      return;
    }
    const bounds = event.currentTarget.getBoundingClientRect();
    cw.beginAutomatic(event.clientX < bounds.left + bounds.width / 2 ? "." : "-");
  }

  function pointerEnd() {
    if (manual) {
      cw.endManual();
      return;
    }
    cw.endAutomatic(".");
    cw.endAutomatic("-");
  }

  const modeLabels = {
    [PRACTICE_MODES.CHARACTER_RX]: t.characterRx,
    [PRACTICE_MODES.CALLSIGN_RX]: t.callsignRx,
    [PRACTICE_MODES.MANUAL_TX]: t.manualTx,
    [PRACTICE_MODES.PADDLE_TX]: t.paddleTx,
  };

  return (
    <main
      className="screen practice-screen"
      data-practice-mode={mode}
      data-practice-question-id={displayedQuestion?.id ?? ""}
      data-practice-target={window.cwgameSystem?.qaCapture ? target : undefined}
      data-practice-attempts={sessionStats.attempts}
      data-practice-lifetime-attempts={lifetimeStats.attempts}
      data-practice-result={resultState}
      data-practice-recording={recordingCallsign ? "save" : "session"}
      data-pulse-count={cw.analysis.pulseCount}
      data-keyer-wpm={automaticKeyWpm}
      style={{ "--room": `url(${ASSETS.room})` }}
    >
      <header className="practice-topbar station-topbar">
        <div className="practice-title">
          <Radio size={20} weight="fill" />
          <strong>{t.title}</strong>
          <span>{t.independent}</span>
          <small className={`practice-recording-status ${recordingCallsign ? "persistent" : "session-only"}`}>
            {recordingCallsign ? `${t.recordingTo}: ${recordingCallsign}` : t.sessionOnly}
          </small>
        </div>
        <div className="top-actions"><IconButton label={t.back} data-action="practice-back" onClick={leavePractice}><ArrowLeft size={21} /></IconButton><IconButton label={t.settings} onClick={onSettings}><GearSix size={21} /></IconButton></div>
      </header>

      <div className="practice-layout">
        <aside className="practice-sidebar metal-panel">
          <div className="panel-title"><span>MODE</span><b>M2 / TRAIN</b></div>
          <nav aria-label="Practice modes">
            {Object.values(PRACTICE_MODES).map((id) => {
              const ModeIcon = MODE_ICONS[id];
              return <button key={id} data-practice-mode-option={id} className={mode === id ? "selected" : ""} onClick={() => changeMode(id)}><ModeIcon size={22} weight="fill" /><span>{modeLabels[id]}</span></button>;
            })}
          </nav>
          <div className="practice-policy"><Radio size={18} /><span>{t.sim}</span></div>
        </aside>

        <section className="practice-workspace metal-panel">
          <header><span className="panel-kicker">{receiving ? "RX / COPY" : "TX / KEYING"}</span><h1>{modeLabels[mode]}</h1></header>
          <div className="practice-prompt">
            <span>{t.target}</span>
            <strong>{receiving && !visualAid && !result ? "?".repeat(Math.min(target.length, 6)) : target}</strong>
            {visualAid && <code>{morse}</code>}
            <small>{receiving ? `${t.fixedSpeed}: ${receiveWpm} WPM` : manual ? `${t.detectedSpeed}: ${cw.analysis.wpm} WPM` : `${t.automaticSpeed}: ${automaticKeyWpm} WPM`}</small>
          </div>

          {receiving ? (
            <div className="reception-controls">
              <button className="primary-button" data-action="practice-listen" onClick={() => cw.playIncoming(target, receiveWpm)} disabled={cw.isPlaying || session.completedAt}><SpeakerHigh size={21} weight="fill" />{t.listen}</button>
              <input data-testid="practice-answer" aria-label={t.answer} value={answer} disabled={Boolean(result || session.completedAt)} onChange={(event) => setAnswer(event.target.value.toUpperCase())} onKeyDown={(event) => event.key === "Enter" && scoreAttempt()} placeholder={t.answer} autoComplete="off" spellCheck="false" />
            </div>
          ) : (
            <div className="practice-key-area">
              <img src={manual ? ASSETS.manual : ASSETS.automatic} alt={manual ? t.manualTx : t.paddleTx} onPointerDown={pointerDown} onPointerUp={pointerEnd} onPointerCancel={pointerEnd} onLostPointerCapture={pointerEnd} draggable="false" />
              <div><strong>{manual ? t.manualHint : t.paddleHint}</strong><span>{t.decoded}: {cw.analysis.decoded || "---"}</span><span>{t.rhythm}: {cw.analysis.rhythm}%</span></div>
            </div>
          )}

          <footer className="practice-actions">
            <button onClick={() => setVisualAid((current) => !current)}>{visualAid ? <EyeSlash size={19} /> : <Eye size={19} />}{visualAid ? t.visualOn : t.visualOff}</button>
            {sending && <button onClick={cw.replayInput} disabled={!cw.analysis.pulseCount || cw.isPlaying}><Broadcast size={19} />{t.replay}</button>}
            <button className="primary-button" data-action="practice-submit" onClick={scoreAttempt} disabled={Boolean(result || session.completedAt || (receiving ? !answer.trim() : !cw.analysis.pulseCount))}><Check size={20} weight="bold" />{t.submit}</button>
            <button data-action="practice-next" onClick={nextPrompt} disabled={!result || session.completedAt}><ArrowRight size={20} />{t.next}</button>
            <button data-action="practice-end" onClick={endSession}><X size={19} />{t.endSession}</button>
          </footer>

          <div className={`practice-result ${result ? (result.correct ? "correct" : "wrong") : ""}`} aria-live="polite">
            {result ? <><strong>{result.correct ? t.correct : t.wrong}</strong><span>{t.target}: {result.target} // {t.decoded}: {result.answer || "---"}</span></> : <span>{t.waiting}</span>}
          </div>
        </section>

        <aside className="practice-stats metal-panel">
          <div className="panel-title"><span>{t.session}</span><b>LIVE</b></div>
          <dl className="practice-session-stats">
            <div><dt>{t.attempts}</dt><dd>{sessionStats.attempts}</dd></div>
            <div><dt>{t.accuracy}</dt><dd>{sessionStats.accuracy}%</dd></div>
            <div><dt>{t.rhythm}</dt><dd>{sessionStats.averageRhythm}%</dd></div>
          </dl>
          <section className="practice-session-weaknesses"><h2>{t.session} · {t.weak}</h2>{sessionWeakEntries.length ? <div className="weak-list">{sessionWeakEntries.map(([character, count]) => <span key={character}><b>{character}</b><i>{count}</i></span>)}</div> : <p>{t.noWeak}</p>}</section>
          <section className="practice-lifetime-stats" data-testid="practice-lifetime-stats">
            <h2>{t.lifetime}</h2>
            <dl>
              <div><dt>{t.attempts}</dt><dd>{lifetimeStats.attempts}</dd></div>
              <div><dt>{t.accuracy}</dt><dd>{lifetimeStats.accuracy}%</dd></div>
            </dl>
            <h2>{t.weak}</h2>
            {lifetimeWeakEntries.length ? <div className="weak-list">{lifetimeWeakEntries.map(([character, count]) => <span key={character}><b>{character}</b><i>{count}</i></span>)}</div> : <p>{t.noWeak}</p>}
          </section>
          <div className="practice-light"><i className={cw.isTransmitting ? "on" : ""} /><span>{cw.isTransmitting ? "TX" : receiving && cw.isPlaying ? "RX" : "READY"}</span></div>
        </aside>
      </div>

      {summaryState && (
        <div className="practice-summary-backdrop" data-testid="practice-summary-backdrop">
          <section
            className="practice-summary-modal metal-panel"
            data-testid="practice-summary-modal"
            data-summary-mode={summaryState.mode}
            data-summary-attempts={summaryState.summary.questionCount}
            data-summary-correct={summaryState.summary.correctCount}
            role="dialog"
            aria-modal="true"
            aria-labelledby="practice-summary-title"
          >
            <header>
              <div><span>SESSION COMPLETE</span><h2 id="practice-summary-title">{t.summaryTitle}</h2><p>{t.summarySubtitle}</p></div>
              <IconButton label={t.continueTraining} data-action="practice-summary-close" onClick={continueTraining}><X size={20} weight="bold" /></IconButton>
            </header>
            <dl className="practice-summary-metrics">
              <div><dt>{t.attempts}</dt><dd>{summaryState.summary.questionCount}</dd></div>
              <div><dt>{t.correctCount}</dt><dd>{summaryState.summary.correctCount}</dd></div>
              <div><dt>{t.accuracy}</dt><dd>{summaryState.summary.averageAccuracy}%</dd></div>
              <div><dt>{t.rhythm}</dt><dd>{summaryState.summary.averageRhythm}%</dd></div>
            </dl>
            <section className="practice-summary-weaknesses">
              <h3>{t.weak}</h3>
              {summaryState.summary.weakCharacters.length
                ? <div className="weak-list">{summaryState.summary.weakCharacters.slice(0, 8).map(({ character, misses }) => <span key={character}><b>{character}</b><i>{misses}</i></span>)}</div>
                : <p>{t.noWeak}</p>}
            </section>
            <footer>
              <button data-action="practice-summary-back" onClick={leavePractice}><ArrowLeft size={19} />{t.leavePractice}</button>
              <button className="primary-button" data-action="practice-summary-continue" onClick={continueTraining}><ArrowRight size={19} />{t.continueTraining}</button>
            </footer>
          </section>
        </div>
      )}
    </main>
  );
}
