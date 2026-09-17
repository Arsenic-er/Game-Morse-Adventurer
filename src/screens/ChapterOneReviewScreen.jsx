import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowRight, BookOpenText, Broadcast, FloppyDisk,
  Headphones, Radio, Repeat, SpeakerHigh,
} from "@phosphor-icons/react";
import { VisualNovelStage } from "../components/VisualNovelStage.jsx";
import { ReviewIncomingCaption } from "../components/ReviewIncomingCaption.jsx";
import { CwAudioEngine } from "../cw/audioEngine.js";
import { encodeTextToEvents } from "../cw/morse.js";
import { chapterMedia } from "../media/chapterMediaCatalog.js";
import { chapterSceneEffects } from "../media/chapterSceneEffects.js";
import { chapterOneReviewText } from "./chapterOneReviewText.js";

const PLAYER_CALL = "SIM1OP";
const DISTANT_CALL = "SIM6JP";
const PLAYER_CQ = `CQ CQ DE ${PLAYER_CALL} K`;
const DISTANT_REPLY = `${PLAYER_CALL} DE ${DISTANT_CALL} 599 K`;
const PLAYER_SIGNOFF = `${DISTANT_CALL} DE ${PLAYER_CALL} 599 73 SK`;

function Waveform({ active }) {
  return <span className="chapter-one-waveform" data-active={active} aria-hidden="true">
    {Array.from({ length: 18 }, (_, index) => <i key={index} style={{ "--wave-index": index }} />)}
  </span>;
}

function FrequencyRecord({ t, step, callSent, answerHeard, finalSent, toneActive }) {
  if (step < 2 || step > 3) return null;
  return <section className="chapter-one-frequency" aria-label={t.transcript}>
    <header>
      <span><Radio size={16} weight="fill" />21.060 MHz</span>
      <span className={toneActive ? "is-live" : ""}><Waveform active={toneActive} />{toneActive ? t.transmitting : t.receiving}</span>
    </header>
    <div className="chapter-one-transcript">
      <p className="noise"><span>RX</span>··· ··· ···</p>
      {(step > 2 || callSent) && <p><span>TX</span>{PLAYER_CQ}</p>}
      {step === 3 && answerHeard && <p className="remote"><span>RX</span>{DISTANT_REPLY}</p>}
      {step === 3 && finalSent && <p><span>TX</span>{PLAYER_SIGNOFF}</p>}
    </div>
  </section>;
}

function initialReviewBeat(maximum) {
  try {
    const queryBeat = new URLSearchParams(window.location.search).get("beat");
    const hashBeat = /^#beat=(\d+)$/.exec(window.location.hash)?.[1];
    const requested = Number(queryBeat ?? hashBeat);
    return (queryBeat !== null || hashBeat !== undefined) && Number.isInteger(requested) ? Math.min(maximum, Math.max(0, requested)) : 0;
  } catch {
    return 0;
  }
}

export function ChapterOneReviewScreen({ language, onBack, onSettings, inputBlocked = false }) {
  const t = chapterOneReviewText(language);
  const media = chapterMedia(1);
  const [step, setStep] = useState(() => initialReviewBeat(t.beats.length - 1));
  const [callSent, setCallSent] = useState(false);
  const [answerHeard, setAnswerHeard] = useState(false);
  const [finalSent, setFinalSent] = useState(false);
  const [logged, setLogged] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [toneActive, setToneActive] = useState(false);
  const [reviewIncoming, setReviewIncoming] = useState("");
  const [captionExpanded, setCaptionExpanded] = useState(true);
  const [incomingStatus, setIncomingStatus] = useState("waiting");
  const [audioError, setAudioError] = useState(false);
  const audioRef = useRef(null);
  const playbackTokenRef = useRef(0);
  const mountedRef = useRef(true);

  const beat = t.beats[step];
  const artwork = media?.[beat.asset];
  const artLabel = t.artLabels[beat.asset];

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      playbackTokenRef.current += 1;
      audioRef.current?.dispose();
      audioRef.current = null;
    };
  }, []);

  useEffect(() => { if (inputBlocked) stopPlayback(); }, [inputBlocked]);

  const recordRows = useMemo(() => [
    ["UTC", "18:21"],
    ["CALL", DISTANT_CALL],
    ["RST", "599 / 599"],
    ["NOTE", "FIRST CONTACT · HEARD"],
  ], []);

  function stopPlayback() {
    playbackTokenRef.current += 1;
    audioRef.current?.stopPlayback();
    setPlaying(false);
    setToneActive(false);
    setIncomingStatus(status => status === "receiving" ? "paused" : status);
  }

  function goToStep(nextStep) {
    stopPlayback();
    setReviewIncoming("");
    setIncomingStatus("waiting");
    setAudioError(false);
    setStep(Math.min(t.beats.length - 1, Math.max(0, nextStep)));
  }

  async function playPhrase(text, onComplete) {
    stopPlayback();
    if (!audioRef.current) audioRef.current = new CwAudioEngine();
    const token = ++playbackTokenRef.current;
    setPlaying(true);
    setAudioError(false);
    if (text === DISTANT_REPLY) {
      setReviewIncoming(text);
      setIncomingStatus("receiving");
    }
    try {
      await audioRef.current.play(encodeTextToEvents(text, { wpm: 22 }).events, {
        channel: { signalGain: 1, qsbDepth: text === DISTANT_REPLY ? .16 : .04, noiseGain: text === DISTANT_REPLY ? .08 : .02 },
        onTone: (active) => mountedRef.current && token === playbackTokenRef.current && setToneActive(active),
      });
      if (mountedRef.current && token === playbackTokenRef.current) {
        if (text === DISTANT_REPLY) setIncomingStatus("received");
        onComplete?.();
      }
    } catch {
      if (mountedRef.current && token === playbackTokenRef.current) {
        setAudioError(true);
        if (text === DISTANT_REPLY) setIncomingStatus("paused");
      }
    } finally {
      if (mountedRef.current && token === playbackTokenRef.current) {
        setPlaying(false);
        setToneActive(false);
      }
    }
  }

  function restart() {
    stopPlayback();
    setReviewIncoming("");
    setIncomingStatus("waiting");
    setAudioError(false);
    setCallSent(false);
    setAnswerHeard(false);
    setFinalSent(false);
    setLogged(false);
    setStep(0);
  }

  function primaryAction() {
    if (step === 0 || step === 1) return {
      label: beat.next ?? t.next,
      icon: <ArrowRight size={19} weight="bold" />,
      onClick: () => goToStep(step + 1),
    };
    if (step === 2 && !callSent) return {
      label: t.callAction,
      icon: <Broadcast size={19} weight="fill" />,
      onClick: () => playPhrase(PLAYER_CQ, () => setCallSent(true)),
    };
    if (step === 2) return {
      label: t.waitAction,
      icon: <Headphones size={19} weight="fill" />,
      onClick: () => goToStep(3),
    };
    if (step === 3 && !answerHeard) return {
      label: t.listenAction,
      icon: <SpeakerHigh size={19} weight="fill" />,
      onClick: () => playPhrase(DISTANT_REPLY, () => setAnswerHeard(true)),
    };
    if (step === 3 && !finalSent) return {
      label: t.replyAction,
      icon: <Broadcast size={19} weight="fill" />,
      onClick: () => playPhrase(PLAYER_SIGNOFF, () => setFinalSent(true)),
    };
    if (step === 3) return {
      label: t.logAction,
      icon: <FloppyDisk size={19} weight="fill" />,
      onClick: () => { setLogged(true); goToStep(4); },
    };
    if (!logged) return {
      label: t.logAction,
      icon: <FloppyDisk size={19} weight="fill" />,
      onClick: () => setLogged(true),
    };
    return { label: t.restart, icon: <Repeat size={19} weight="bold" />, onClick: restart };
  }

  const primary = primaryAction();

  return <VisualNovelStage language={language} beat={beat} artwork={artwork} background={media[beat.asset === "portrait" ? "scene" : beat.asset]}
    sceneLayers={beat.asset === "illustration" ? [] : chapterSceneEffects(1).layers}
    artLabel={artLabel} chapter={t.chapter} title={t.title} mode={t.slice} safety={t.noSave}
    backLabel={t.back} settingsLabel={t.settings} artViewLabel={t.viewArt} onBack={onBack} onSettings={onSettings}
    primaryLabel={audioError ? (language === "zh-TW" ? "播放失敗 · 點擊重試" : language.startsWith("zh") ? "播放失败 · 点击重试" : "Playback failed · Retry") : primary.label} onPrimary={primary.onClick} inputBlocked={inputBlocked} busy={playing}
    overlay={(step === 2 || step === 3) && <ReviewIncomingCaption language={language} text={reviewIncoming} status={incomingStatus} expanded={captionExpanded} onToggle={() => setCaptionExpanded(value => !value)} />}
    data-review-beat={beat.id} data-tone-active={toneActive} primaryAction="chapter-one-review-primary"
    toolbar={<select className="vn-scene-select" aria-label={t.slice} value={step} disabled={playing} onChange={event => goToStep(Number(event.target.value))}>
      {t.beats.map((item, index) => <option key={item.id} value={index}>{String(index + 1).padStart(2, "0")} · {item.tab}</option>)}
    </select>}>
    <p>{t.reviewNote}</p>
    {audioError && <p role="alert">{language.startsWith("zh") ? "音频未能播放，请关闭此面板后再次点击播放按钮。" : "Audio could not play. Close this panel and retry the playback button."}</p>}
    <FrequencyRecord t={t} step={step} callSent={callSent} answerHeard={answerHeard} finalSent={finalSent} toneActive={toneActive} />
    {step === 4 && <section className={`chapter-one-logbook ${logged ? "is-written" : ""}`}>
      <header><BookOpenText size={18} /><span>LOGBOOK / PAGE 001</span></header>
      <dl>{recordRows.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
      <p>{logged ? t.qsoLogged : t.reviewNote}</p>
    </section>}
  </VisualNovelStage>;
}
