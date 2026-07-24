import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft, ArrowRight, Broadcast, Check, Ear, Eye, EyeSlash,
  GearSix, Keyboard, Lightning, Play, Radio, SpeakerHigh, X,
} from "@phosphor-icons/react";
import { encodeTextToEvents } from "../cw/morse.js";
import { useCwCore } from "../cw/useCwCore.js";
import {
  PRACTICE_MODES, emptyPracticeStats, evaluateReception, evaluateSending,
  isReceptionMode, isSendingMode, practiceTargetFor, updatePracticeStats,
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
    attempts: "题数", accuracy: "正确率", rhythm: "平均节奏", weak: "薄弱字符", noWeak: "暂无",
    manualHint: "按住空格键发报", paddleHint: "Z 点桨 / X 划桨", sim: "所有呼号均为程序生成的 SIM 虚构台站",
  },
  "zh-TW": {
    title: "CW 練習臺", back: "返回開始介面", settings: "設定", independent: "獨立訓練環境 · 不受傳播影響",
    characterRx: "字元接收", callsignRx: "呼號接收", manualTx: "手鍵練習", paddleTx: "雙槳練習",
    listen: "播放題目", answer: "輸入抄收到的內容", submit: "提交成績", next: "下一題", replay: "重播輸入",
    visualOn: "關閉視覺輔助", visualOff: "開啟視覺輔助", target: "訓練目標", decoded: "目前解碼",
    fixedSpeed: "系統速度", detectedSpeed: "識別速度", automaticSpeed: "自動鍵速度", correct: "正確", wrong: "不正確", waiting: "等待輸入",
    attempts: "題數", accuracy: "正確率", rhythm: "平均節奏", weak: "薄弱字元", noWeak: "暫無",
    manualHint: "按住空白鍵發報", paddleHint: "Z 點槳 / X 劃槳", sim: "所有呼號均為程式生成的 SIM 虛構臺站",
  },
  ja: {
    title: "CW 練習台", back: "開始画面へ戻る", settings: "設定", independent: "独立した練習環境・伝搬の影響なし",
    characterRx: "文字受信", callsignRx: "コール受信", manualTx: "縦振り練習", paddleTx: "パドル練習",
    listen: "課題を再生", answer: "受信内容を入力", submit: "採点", next: "次の課題", replay: "入力を再生",
    visualOn: "視覚補助を閉じる", visualOff: "視覚補助を開く", target: "練習目標", decoded: "現在の復号",
    fixedSpeed: "システム速度", detectedSpeed: "認識速度", automaticSpeed: "オートキー速度", correct: "正解", wrong: "不正解", waiting: "入力待ち",
    attempts: "課題数", accuracy: "正確率", rhythm: "平均リズム", weak: "苦手文字", noWeak: "なし",
    manualHint: "スペースを押して送信", paddleHint: "Z 短点 / X 長点", sim: "すべてのコールはプログラム生成の架空 SIM 局です",
  },
  en: {
    title: "CW Practice", back: "Back to title", settings: "Settings", independent: "Independent training · propagation disabled",
    characterRx: "Character RX", callsignRx: "Callsign RX", manualTx: "Straight key", paddleTx: "Paddle key",
    listen: "Play prompt", answer: "Type what you copied", submit: "Score attempt", next: "Next prompt", replay: "Replay input",
    visualOn: "Hide visual aid", visualOff: "Show visual aid", target: "Target", decoded: "Decoded",
    fixedSpeed: "System speed", detectedSpeed: "Detected speed", automaticSpeed: "Automatic key speed", correct: "Correct", wrong: "Not correct", waiting: "Waiting for input",
    attempts: "Attempts", accuracy: "Accuracy", rhythm: "Avg rhythm", weak: "Weak characters", noWeak: "None",
    manualHint: "Hold Space to key", paddleHint: "Z dot / X dash", sim: "All callsigns are program-generated fictional SIM stations",
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

export function PracticeScreen({ language, automaticKeyWpm = 18, onBack, onSettings, inputBlocked = false }) {
  const t = TEXT[language] ?? TEXT.en;
  const [mode, setMode] = useState(PRACTICE_MODES.CHARACTER_RX);
  const [roundIndex, setRoundIndex] = useState(0);
  const [answer, setAnswer] = useState("");
  const [visualAid, setVisualAid] = useState(false);
  const [result, setResult] = useState(null);
  const [statsByMode, setStatsByMode] = useState(() => Object.fromEntries(Object.values(PRACTICE_MODES).map((id) => [id, emptyPracticeStats()])));
  const stats = statsByMode[mode];
  const target = useMemo(() => practiceTargetFor(mode, roundIndex, stats.weaknesses), [mode, roundIndex, stats.weaknesses]);
  const cw = useCwCore({ targetText: target, automaticWpm: automaticKeyWpm });
  const receiving = isReceptionMode(mode);
  const sending = isSendingMode(mode);
  const manual = mode === PRACTICE_MODES.MANUAL_TX;
  const receiveWpm = mode === PRACTICE_MODES.CHARACTER_RX ? 14 : 16;
  const morse = useMemo(() => encodeTextToEvents(target, { wpm: receiveWpm }).morse, [receiveWpm, target]);

  useEffect(() => {
    cw.clearInput();
    setAnswer("");
    setResult(null);
  }, [mode, roundIndex]);

  useEffect(() => {
    if (!sending) return undefined;
    function onDown(event) {
      if (inputBlocked || event.repeat) return;
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
  }, [cw.beginAutomatic, cw.beginManual, cw.endAutomatic, cw.endManual, cw.stopAll, inputBlocked, manual, sending]);

  function changeMode(nextMode) {
    setMode(nextMode);
    setRoundIndex(0);
    setResult(null);
    setAnswer("");
  }

  function scoreAttempt() {
    const nextResult = receiving ? evaluateReception(answer, target) : evaluateSending(cw.analysis, target);
    setResult(nextResult);
    setStatsByMode((current) => ({ ...current, [mode]: updatePracticeStats(current[mode], nextResult) }));
  }

  function nextPrompt() {
    setRoundIndex((current) => current + 1);
  }

  function pointerDown(event) {
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
  const weakEntries = Object.entries(stats.weaknesses).sort((left, right) => right[1] - left[1]).slice(0, 5);

  return (
    <main
      className="screen practice-screen"
      data-pulse-count={cw.analysis.pulseCount}
      data-keyer-wpm={automaticKeyWpm}
      style={{ "--room": `url(${ASSETS.room})` }}
    >
      <header className="practice-topbar station-topbar">
        <div className="practice-title"><Radio size={20} weight="fill" /><strong>{t.title}</strong><span>{t.independent}</span></div>
        <div className="top-actions"><IconButton label={t.back} onClick={onBack}><ArrowLeft size={21} /></IconButton><IconButton label={t.settings} onClick={onSettings}><GearSix size={21} /></IconButton></div>
      </header>

      <div className="practice-layout">
        <aside className="practice-sidebar metal-panel">
          <div className="panel-title"><span>MODE</span><b>M2 / TRAIN</b></div>
          <nav aria-label="Practice modes">
            {Object.values(PRACTICE_MODES).map((id) => {
              const ModeIcon = MODE_ICONS[id];
              return <button key={id} className={mode === id ? "selected" : ""} onClick={() => changeMode(id)}><ModeIcon size={22} weight="fill" /><span>{modeLabels[id]}</span></button>;
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
              <button className="primary-button" onClick={() => cw.playIncoming(target, receiveWpm)} disabled={cw.isPlaying}><SpeakerHigh size={21} weight="fill" />{t.listen}</button>
              <input aria-label={t.answer} value={answer} onChange={(event) => setAnswer(event.target.value.toUpperCase())} onKeyDown={(event) => event.key === "Enter" && scoreAttempt()} placeholder={t.answer} autoComplete="off" spellCheck="false" />
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
            <button className="primary-button" onClick={scoreAttempt} disabled={receiving ? !answer.trim() : !cw.analysis.pulseCount}><Check size={20} weight="bold" />{t.submit}</button>
            <button onClick={nextPrompt}><ArrowRight size={20} />{t.next}</button>
          </footer>

          <div className={`practice-result ${result ? (result.correct ? "correct" : "wrong") : ""}`} aria-live="polite">
            {result ? <><strong>{result.correct ? t.correct : t.wrong}</strong><span>{t.target}: {result.target} // {t.decoded}: {result.answer || "---"}</span></> : <span>{t.waiting}</span>}
          </div>
        </section>

        <aside className="practice-stats metal-panel">
          <div className="panel-title"><span>SESSION</span><b>LIVE</b></div>
          <dl>
            <div><dt>{t.attempts}</dt><dd>{stats.attempts}</dd></div>
            <div><dt>{t.accuracy}</dt><dd>{stats.accuracy}%</dd></div>
            <div><dt>{t.rhythm}</dt><dd>{stats.averageRhythm}%</dd></div>
          </dl>
          <section><h2>{t.weak}</h2>{weakEntries.length ? <div className="weak-list">{weakEntries.map(([character, count]) => <span key={character}><b>{character}</b><i>{count}</i></span>)}</div> : <p>{t.noWeak}</p>}</section>
          <div className="practice-light"><i className={cw.isTransmitting ? "on" : ""} /><span>{cw.isTransmitting ? "TX" : receiving && cw.isPlaying ? "RX" : "READY"}</span></div>
        </aside>
      </div>
    </main>
  );
}
