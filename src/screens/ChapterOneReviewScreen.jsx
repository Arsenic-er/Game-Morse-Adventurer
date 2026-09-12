import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft, ArrowRight, BookOpenText, Broadcast, Eye, FloppyDisk,
  GearSix, Headphones, Radio, Repeat, SpeakerHigh, X,
} from "@phosphor-icons/react";
import { CwAudioEngine } from "../cw/audioEngine.js";
import { encodeTextToEvents } from "../cw/morse.js";
import { chapterMedia } from "../media/chapterMediaCatalog.js";
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

export function ChapterOneReviewScreen({ language, onBack, onSettings }) {
  const t = chapterOneReviewText(language);
  const media = chapterMedia(1);
  const [step, setStep] = useState(() => initialReviewBeat(t.beats.length - 1));
  const [artOpen, setArtOpen] = useState(false);
  const [callSent, setCallSent] = useState(false);
  const [answerHeard, setAnswerHeard] = useState(false);
  const [finalSent, setFinalSent] = useState(false);
  const [logged, setLogged] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [toneActive, setToneActive] = useState(false);
  const audioRef = useRef(null);
  const playbackTokenRef = useRef(0);
  const mountedRef = useRef(true);

  const beat = t.beats[step];
  const artwork = media?.[beat.asset];
  const progress = Math.round(((step + 1) / t.beats.length) * 100);
  const artLabel = t.artLabels[beat.asset];

  useEffect(() => () => {
    mountedRef.current = false;
    playbackTokenRef.current += 1;
    audioRef.current?.dispose();
  }, []);

  useEffect(() => {
    function handleKeyDown(event) {
      const interactiveTarget = event.target instanceof Element && event.target.closest("button, input, select, textarea");
      if (event.defaultPrevented || interactiveTarget) return;
      if (event.key === "Escape" && artOpen) {
        event.preventDefault();
        setArtOpen(false);
      } else if (event.key === "ArrowLeft" && !artOpen && !playing) {
        event.preventDefault();
        setStep((current) => Math.max(0, current - 1));
      } else if (event.key === "ArrowRight" && !artOpen && !playing) {
        event.preventDefault();
        setStep((current) => Math.min(t.beats.length - 1, current + 1));
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [artOpen, playing, t.beats.length]);

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
  }

  function goToStep(nextStep) {
    stopPlayback();
    setArtOpen(false);
    setStep(Math.min(t.beats.length - 1, Math.max(0, nextStep)));
  }

  async function playPhrase(text, onComplete) {
    stopPlayback();
    if (!audioRef.current) audioRef.current = new CwAudioEngine();
    const token = ++playbackTokenRef.current;
    setPlaying(true);
    try {
      await audioRef.current.play(encodeTextToEvents(text, { wpm: 22 }), {
        channel: { signalGain: 1, qsbDepth: text === DISTANT_REPLY ? .16 : .04, noiseGain: text === DISTANT_REPLY ? .08 : .02 },
        onTone: (active) => mountedRef.current && token === playbackTokenRef.current && setToneActive(active),
      });
      if (mountedRef.current && token === playbackTokenRef.current) onComplete?.();
    } finally {
      if (mountedRef.current && token === playbackTokenRef.current) {
        setPlaying(false);
        setToneActive(false);
      }
    }
  }

  function restart() {
    stopPlayback();
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

  return <main className="screen chapter-one-review-screen" data-review-beat={beat.id} data-tone-active={toneActive}>
    <header className="chapter-one-review-header">
      <button className="chapter-one-review-back" onClick={onBack}><ArrowLeft size={20} weight="bold" />{t.back}</button>
      <div className="chapter-one-review-title">
        <span>{t.chapter} / {t.slice}</span>
        <strong>{t.title}</strong>
      </div>
      <p className="chapter-one-review-safety"><FloppyDisk size={16} />{t.noSave}</p>
      <button className="chapter-one-review-settings" onClick={onSettings} aria-label={t.settings}><GearSix size={21} /></button>
    </header>

    <nav className="chapter-one-review-beats" aria-label={t.slice}>
      {t.beats.map((item, index) => <button
        key={item.id}
        className={index === step ? "selected" : index < step ? "visited" : ""}
        aria-current={index === step ? "step" : undefined}
        onClick={() => goToStep(index)}
      >
        <span>{String(index + 1).padStart(2, "0")}</span>
        <strong>{item.tab}</strong>
      </button>)}
      <span className="chapter-one-review-progress" style={{ "--review-progress": `${progress}%` }} />
    </nav>

    <section className="chapter-one-review-layout">
      <figure className={`chapter-one-review-art is-${beat.asset}`}>
        <img key={`${beat.id}:${beat.asset}`} src={artwork} alt={`${artLabel}：${beat.caption}`} />
        <span className="chapter-one-art-index">{artLabel} // 01</span>
        <button className="chapter-one-art-open" onClick={() => setArtOpen(true)}><Eye size={18} />{t.viewArt}</button>
        <figcaption><BookOpenText size={17} /><span>{beat.caption}</span></figcaption>
      </figure>

      <article className="chapter-one-review-narrative">
        <header>
          <span>{beat.eyebrow}</span>
          <h1>{beat.title}</h1>
        </header>
        <div className="chapter-one-story-copy">
          {beat.paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
        </div>

        <FrequencyRecord t={t} step={step} callSent={callSent} answerHeard={answerHeard} finalSent={finalSent} toneActive={toneActive} />

        {step === 4 && <section className={`chapter-one-logbook ${logged ? "is-written" : ""}`}>
          <header><BookOpenText size={18} /><span>LOGBOOK / PAGE 001</span></header>
          <dl>{recordRows.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
          <p>{logged ? t.qsoLogged : t.reviewNote}</p>
        </section>}

        <footer className="chapter-one-review-actions">
          <button onClick={() => goToStep(step - 1)} disabled={step === 0 || playing}><ArrowLeft size={18} />{t.previous}</button>
          <button className="primary" onClick={primary.onClick} disabled={playing}>{primary.icon}{primary.label}</button>
        </footer>
        <small className="chapter-one-review-note">{t.reviewMode} // {t.reviewNote}</small>
      </article>
    </section>

    {artOpen && <div className="chapter-one-art-lightbox" role="dialog" aria-modal="true" aria-label={t.viewArt}>
      <header><span>{artLabel} // {beat.tab}</span><button onClick={() => setArtOpen(false)} aria-label={t.closeArt}><X size={22} /></button></header>
      <img src={artwork} alt={`${artLabel}：${beat.caption}`} />
      <p>{beat.caption}</p>
    </div>}
  </main>;
}
